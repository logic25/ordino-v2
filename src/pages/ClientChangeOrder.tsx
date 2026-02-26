import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, CheckCircle2, PenLine, Printer, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

export default function ClientChangeOrderPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientTitle, setClientTitle] = useState("");
  const [signed, setSigned] = useState(false);
  const [savedSignatureData, setSavedSignatureData] = useState<string | null>(null);
  const [copyEmail, setCopyEmail] = useState("");
  const [copySent, setCopySent] = useState(false);
  const [autoSendStatus, setAutoSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [depositPaying, setDepositPaying] = useState(false);
  const [depositPaid, setDepositPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");

  // Fetch CO by public token (no joins — anon can only read change_orders)
  const { data: co, isLoading, error } = useQuery({
    queryKey: ["public-co", token],
    queryFn: async () => {
      if (!token) throw new Error("No token");
      const { data, error } = await (supabase as any)
        .from("change_orders")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Change order not found");
      return data as any;
    },
    enabled: !!token,
  });

  // Fetch company info (graceful — returns null if RLS blocks)
  const { data: company } = useQuery({
    queryKey: ["public-co-company", co?.company_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("companies")
        .select("name, address, phone, email, website, logo_url, settings")
        .eq("id", co.company_id)
        .maybeSingle();
      if (!data) return null;
      const s = (data.settings || {}) as any;
      return {
        name: data.name,
        address: s.company_address?.trim() || data.address || "",
        phone: s.company_phone?.trim() || data.phone || "",
        email: s.company_email?.trim() || data.email || "",
        logo_url: s.company_logo_url?.trim() || data.logo_url || "",
      };
    },
    enabled: !!co?.company_id,
    retry: false,
  });

  // Fetch project + client info (graceful)
  const { data: projectData } = useQuery({
    queryKey: ["public-co-project", co?.project_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("projects")
        .select("project_number, property_id, properties(address, borough), client_id, clients!projects_client_id_fkey(name)")
        .eq("id", co.project_id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!co?.project_id,
    retry: false,
  });

  const project = projectData || null;
  const clientInfo = projectData?.clients || null;

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!canvasRef.current || !token) throw new Error("Missing data");
      const sigData = canvasRef.current.toDataURL("image/png");
      setSavedSignatureData(sigData);
      const { error } = await (supabase as any)
        .from("change_orders")
        .update({
          client_signature_data: sigData,
          client_signer_name: clientName,
          client_signed_at: new Date().toISOString(),
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("public_token", token);
      if (error) throw error;
    },
    onSuccess: async () => {
      setSigned(true);
      queryClient.invalidateQueries({ queryKey: ["public-co", token] });
      toast({ title: "Change Order Signed!", description: "Thank you for approving. The team has been notified." });

      // Auto-send signed copy to the email the CO was sent to
      if (co?.sent_to_email) {
        setAutoSendStatus("sending");
        try {
          const coNum = co.co_number || "Change Order";
          const totalStr = fmt(co.amount);
          await supabase.functions.invoke("gmail-send", {
            body: {
              to: co.sent_to_email,
              subject: `Your Signed Change Order — ${coNum}`,
              html_body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#1c2127;">Change Order ${coNum} — Approved</h2>
                <p>Thank you for signing. Here is a summary for your records:</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Change Order</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${coNum}</td></tr>
                  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Title</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${co.title}</td></tr>
                  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Total</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${totalStr}</td></tr>
                  <tr><td style="padding:8px;color:#64748b;">Signed by</td><td style="padding:8px;font-weight:600;">${clientName}</td></tr>
                </table>
                <p style="color:#64748b;font-size:13px;">If you need a printable copy, please revisit the original link.</p>
              </div>`,
            },
          });
          setAutoSendStatus("sent");
        } catch {
          setAutoSendStatus("failed");
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Canvas setup
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  }, [co]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearSig = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setHasSignature(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !co) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Change Order Not Found</h1>
          <p className="text-muted-foreground">This link may have expired or the change order no longer exists.</p>
        </div>
      </div>
    );
  }

  const lineItems = Array.isArray(co.line_items) && co.line_items.length > 0
    ? co.line_items
    : (co.linked_service_names || []).map((name: string, i: number) => ({
        name,
        amount: i === 0 ? co.amount : 0,
        description: co.description || undefined,
      }));

  const isCredit = co.amount < 0;
  const alreadySigned = !!co.client_signed_at || signed;
  const internalSigned = !!co.internal_signed_at;
  const canClientSign = internalSigned && !alreadySigned;
  const projectAddress = project?.properties?.address || "";
  const projectNumber = project?.project_number || "";

  const amber = "hsl(38, 92%, 50%)";
  const charcoal = "#1c2127";
  const slate = "#64748b";

  return (
    <div className="min-h-screen bg-[#f1f5f9] print:bg-white">
      <div className="max-w-[720px] mx-auto py-6 px-4 print:max-w-none print:p-0">
        {/* Already signed confirmation */}
        {alreadySigned && (
          <div className="space-y-4 mb-6 print:hidden">
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <div className="inline-flex items-center justify-center rounded-full p-3 mb-4" style={{ background: "hsl(160, 84%, 39%, 0.1)" }}>
                <CheckCircle2 className="h-12 w-12" style={{ color: "#10b981" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: charcoal }}>Change Order Approved!</h2>
              <p className="text-sm max-w-md mx-auto" style={{ color: slate }}>
                Thank you for signing <strong>{co.co_number}</strong>. The team has been notified.
              </p>
            </div>

            {/* Auto-send status */}
            {autoSendStatus === "sending" && (
              <div className="bg-white shadow-md rounded-lg p-4 flex items-center gap-3" style={{ borderLeft: `4px solid ${amber}` }}>
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: amber }} />
                <span className="text-sm" style={{ color: slate }}>Sending signed copy to {co.sent_to_email}...</span>
              </div>
            )}
            {autoSendStatus === "sent" && (
              <div className="bg-white shadow-md rounded-lg p-4 flex items-center gap-3" style={{ borderLeft: "4px solid #10b981" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "#10b981" }} />
                <span className="text-sm" style={{ color: charcoal }}>Signed copy sent to <strong>{co.sent_to_email}</strong></span>
              </div>
            )}
            {autoSendStatus === "failed" && (
              <div className="bg-white shadow-md rounded-lg p-4 flex items-center gap-3" style={{ borderLeft: "4px solid #ef4444" }}>
                <Mail className="h-4 w-4" style={{ color: "#ef4444" }} />
                <span className="text-sm" style={{ color: slate }}>Failed to auto-send copy. Use the Print button for your records.</span>
              </div>
            )}

            {/* Deposit Payment Section */}
            {co.deposit_percentage > 0 && !depositPaid && !co.deposit_paid_at && (
              <div className="bg-white shadow-md rounded-lg p-6" style={{ borderLeft: `4px solid ${amber}` }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-full p-2" style={{ background: "hsl(38, 92%, 50%, 0.1)" }}>
                    <Mail className="h-5 w-5" style={{ color: amber }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: charcoal }}>Deposit Required</div>
                    <div className="text-xs" style={{ color: slate }}>
                      {co.deposit_percentage}% deposit — {fmt(Math.abs(co.amount) * co.deposit_percentage / 100)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg border transition-colors ${paymentMethod === "card" ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    onClick={() => setPaymentMethod("card")}
                  >
                    Credit Card
                  </button>
                  <button
                    className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg border transition-colors ${paymentMethod === "ach" ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    onClick={() => setPaymentMethod("ach")}
                  >
                    ACH Transfer
                  </button>
                </div>

                {paymentMethod === "card" ? (
                  <div className="space-y-3 mb-4">
                    <Input placeholder="Card Number" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="MM / YY" />
                      <Input placeholder="CVC" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    <Input placeholder="Routing Number" />
                    <Input placeholder="Account Number" />
                  </div>
                )}

                <Button
                  className="w-full"
                  style={{ background: amber, color: "#fff" }}
                  disabled={depositPaying}
                  onClick={async () => {
                    setDepositPaying(true);
                    try {
                      await (supabase as any)
                        .from("change_orders")
                        .update({ deposit_paid_at: new Date().toISOString() })
                        .eq("public_token", token);
                      setDepositPaid(true);
                      toast({ title: "Deposit received!", description: `Payment of ${fmt(Math.abs(co.amount) * co.deposit_percentage / 100)} processed.` });
                    } catch {
                      toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
                    } finally {
                      setDepositPaying(false);
                    }
                  }}
                >
                  {depositPaying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Pay Deposit — {fmt(Math.abs(co.amount) * co.deposit_percentage / 100)}
                </Button>
              </div>
            )}

            {/* Deposit paid receipt */}
            {(depositPaid || co.deposit_paid_at) && co.deposit_percentage > 0 && (
              <div className="bg-white shadow-md rounded-lg p-5" style={{ borderLeft: "4px solid #10b981" }}>
                <div className="flex items-center gap-3">
                  <div className="rounded-full p-2" style={{ background: "hsl(160, 84%, 39%, 0.1)" }}>
                    <CheckCircle2 className="h-5 w-5" style={{ color: "#10b981" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: charcoal }}>Deposit Received</div>
                    <div className="text-xs" style={{ color: slate }}>
                      {fmt(Math.abs(co.amount) * co.deposit_percentage / 100)} ({co.deposit_percentage}%) has been processed.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CO Document */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden print:shadow-none print:rounded-none">
          {/* Header */}
          <div style={{ background: charcoal, color: "#fff", padding: "24px 32px" }} className="print:bg-white print:text-black">
            <div className="flex justify-between items-start">
              <div>
                {company?.logo_url && (
                  <img src={company.logo_url} alt="Logo" className="h-10 mb-2" style={{ objectFit: "contain" }} />
                )}
                <h1 className="text-lg font-bold">{company?.name || "Company"}</h1>
                {company?.address && <p className="text-xs opacity-80">{company.address}</p>}
                {company?.phone && <p className="text-xs opacity-80">P: {company.phone}</p>}
                {company?.email && <p className="text-xs opacity-80">{company.email}</p>}
              </div>
              <div className="text-right">
                <h2 className="text-xl font-extrabold tracking-wide">CHANGE ORDER</h2>
                <p className="text-sm mt-1 opacity-80">{co.co_number}</p>
                <p className="text-xs opacity-60 mt-1">Date: {fmtDate(co.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "24px 32px" }}>
            {/* Project / Client Row */}
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: slate }}>Project</div>
                {projectNumber && <div className="text-sm font-semibold">{projectNumber}</div>}
                {projectAddress && <div className="text-sm" style={{ color: slate }}>{projectAddress}</div>}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: slate }}>Client</div>
                <div className="text-sm font-semibold">{clientInfo?.name || "—"}</div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: slate }}>Description</div>
              <h3 className="text-base font-bold" style={{ color: charcoal }}>{co.title}</h3>
              {co.description && <p className="text-sm mt-1" style={{ color: slate }}>{co.description}</p>}
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{ color: slate }}>
                  <span>Service</span>
                  <span>Amount</span>
                </div>
                {lineItems.map((item: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] px-4 py-3 border-t">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: charcoal }}>{item.name}</div>
                      {item.description && <div className="text-xs mt-0.5" style={{ color: slate }}>{item.description}</div>}
                    </div>
                    <div className="text-sm font-semibold text-right" style={{ color: charcoal }}>
                      {isCredit ? `-${fmt(Math.abs(item.amount))}` : fmt(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end mb-6">
              <div className="flex items-center gap-4 px-4 py-2 rounded-lg" style={{ background: isCredit ? "#fef2f2" : "#f0fdf4" }}>
                <span className="text-sm font-bold">{isCredit ? "Total Credit:" : "Total:"}</span>
                <span className="text-lg font-extrabold" style={{ color: isCredit ? "#dc2626" : "#16a34a" }}>
                  {isCredit ? `-${fmt(Math.abs(co.amount))}` : fmt(co.amount)}
                </span>
              </div>
            </div>

            {/* Reason */}
            {co.reason && (
              <div className="mb-6 p-4 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: slate }}>Reason for Change</div>
                <p className="text-sm" style={{ color: charcoal }}>{co.reason}</p>
              </div>
            )}

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 mt-8">
              {/* Internal Signature */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: slate }}>Company Authorization</div>
                {co.internal_signature_data ? (
                  <img src={co.internal_signature_data} alt="Internal signature" className="h-12 object-contain mb-1" />
                ) : (
                  <div className="h-12 border-b-2 border-gray-800 mb-1" />
                )}
                {co.internal_signed_at && (
                  <div className="text-xs" style={{ color: slate }}>Signed {fmtDate(co.internal_signed_at)}</div>
                )}
              </div>

              {/* Client Signature */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: slate }}>Client Approval</div>
                {(co.client_signature_data || savedSignatureData) ? (
                  <>
                    <img src={co.client_signature_data || savedSignatureData!} alt="Client signature" className="h-12 object-contain mb-1" />
                    <div className="text-xs font-medium" style={{ color: charcoal }}>{co.client_signer_name || clientName}</div>
                    <div className="text-xs" style={{ color: slate }}>Signed {fmtDate(co.client_signed_at || new Date().toISOString())}</div>
                  </>
                ) : (
                  <div className="h-12 border-b-2 border-gray-800 mb-1" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (print/download) */}
        <div className="mt-4 flex gap-2 justify-center print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>

        {/* Online Signature Section */}
        {canClientSign && (
          <div className="bg-white shadow-md rounded-lg mt-6 p-6 print:hidden">
            <div className="flex items-center gap-2 mb-4">
              <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
              <h3 className="text-base font-bold" style={{ color: charcoal }}>Sign to Approve</h3>
            </div>

            <p className="text-sm mb-2" style={{ color: slate }}>
              By signing below, you approve this change order and authorize the additional work described above.
              Alternatively, you may <button className="underline font-medium" style={{ color: amber }} onClick={() => window.print()}>print this page</button> and sign manually.
            </p>
            <p className="text-xs italic mb-4" style={{ color: slate }}>
              By signing this Change Order, you acknowledge that all terms and conditions of the original proposal/contract remain in full effect.
              This Change Order modifies only the scope and fees described above.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div>
                <Label htmlFor="co-signer-name" className="text-xs font-semibold">Full Name *</Label>
                <Input
                  id="co-signer-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <Label htmlFor="co-signer-title" className="text-xs font-semibold">Title (optional)</Label>
                <Input
                  id="co-signer-title"
                  value={clientTitle}
                  onChange={(e) => setClientTitle(e.target.value)}
                  placeholder="e.g. Property Owner"
                />
              </div>
            </div>

            <div className="mb-3">
              <Label className="text-xs font-semibold">Signature *</Label>
              <div className="relative mt-1 border rounded-lg overflow-hidden bg-white" style={{ borderColor: "#e2e8f0" }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  className="w-full touch-none cursor-crosshair"
                  style={{ display: "block" }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-sm" style={{ color: "#cbd5e1" }}>Draw your signature here</span>
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-1">
                <Button variant="ghost" size="sm" onClick={clearSig} disabled={!hasSignature}>
                  <RotateCcw className="h-3 w-3 mr-1" /> Clear
                </Button>
              </div>
            </div>

            <Button
              onClick={() => signMutation.mutate()}
              disabled={!hasSignature || !clientName.trim() || signMutation.isPending}
              className="w-full"
              style={{ background: amber, color: "#fff" }}
            >
              {signMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PenLine className="h-4 w-4 mr-2" />
              )}
              Sign & Approve Change Order
            </Button>
          </div>
        )}

        {/* Not ready to sign notice */}
        {!internalSigned && !alreadySigned && (
          <div className="bg-white shadow-md rounded-lg mt-6 p-6 text-center print:hidden">
            <p className="text-sm" style={{ color: slate }}>
              This change order is awaiting internal authorization before it can be signed.
              You may print this page for your records in the meantime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
