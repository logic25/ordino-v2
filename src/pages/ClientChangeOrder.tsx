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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach" | "check">("card");

  // Fetch CO + company + project via edge function (no anon RLS needed)
  const { data: coBundle, isLoading, error } = useQuery({
    queryKey: ["public-co", token],
    queryFn: async () => {
      if (!token) throw new Error("No token");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-co?token=${encodeURIComponent(token)}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      return await res.json();
    },
    enabled: !!token,
  });

  const co = coBundle?.co as any;
  const company = coBundle?.company as any;
  const projectData = coBundle?.project as any;

  const project = projectData || null;
  const clientInfo = projectData?.clients || null;

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!canvasRef.current || !token) throw new Error("Missing data");
      const sigData = canvasRef.current.toDataURL("image/png");
      setSavedSignatureData(sigData);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-co?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sign",
            client_signature_data: sigData,
            client_signer_name: clientName,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Sign failed" }));
        throw new Error(err.error || "Sign failed");
      }
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
  const borderColor = "#e5e7eb";

  return (
    <div className="min-h-screen bg-[#f1f5f9] print:bg-white">
      <style>{`
        @media print {
          @page { margin: 0.4in; size: letter; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-header-banner { background: ${charcoal} !important; color: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-header-banner * { color: #fff !important; }
          .co-header-banner .co-amber-label { color: ${amber} !important; }
          .co-accent-bar { background: ${amber} !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-total-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-reason-box { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-info-card { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .co-sig-card { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
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
                  <button
                    className={`flex-1 text-sm font-medium py-2 px-3 rounded-lg border transition-colors ${paymentMethod === "check" ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    onClick={() => setPaymentMethod("check")}
                  >
                    Check
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
                ) : paymentMethod === "ach" ? (
                  <div className="space-y-3 mb-4">
                    <Input placeholder="Routing Number" />
                    <Input placeholder="Account Number" />
                  </div>
                ) : (
                  <div className="space-y-3 mb-4">
                    <div className="rounded-lg p-4" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                      <div className="text-sm font-bold mb-2" style={{ color: charcoal }}>Mail your check to:</div>
                      <div className="text-sm" style={{ color: charcoal, lineHeight: 1.6 }}>
                        <strong>{company?.name || "Company"}</strong><br />
                        {company?.address || "Company Address"}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: slate }}>
                      Make payable to: <strong>{company?.name || "Company"}</strong><br />
                      Reference: <strong>{co.co_number}</strong>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  style={{ background: amber, color: "#fff" }}
                  disabled={depositPaying}
                  onClick={async () => {
                    setDepositPaying(true);
                    try {
                      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
                      const res = await fetch(
                        `https://${projectId}.supabase.co/functions/v1/public-co?token=${encodeURIComponent(token!)}`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "deposit" }),
                        }
                      );
                      if (!res.ok) throw new Error("Deposit failed");
                      setDepositPaid(true);
                      toast({ title: paymentMethod === "check" ? "Check payment noted!" : "Deposit received!", description: `Payment of ${fmt(Math.abs(co.amount) * co.deposit_percentage / 100)} ${paymentMethod === "check" ? "will be processed upon receipt." : "processed."}` });
                    } catch {
                      toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
                    } finally {
                      setDepositPaying(false);
                    }
                  }}
                >
                  {depositPaying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {paymentMethod === "check" ? `I'll Send a Check — ${fmt(Math.abs(co.amount) * co.deposit_percentage / 100)}` : `Pay Deposit — ${fmt(Math.abs(co.amount) * co.deposit_percentage / 100)}`}
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
          <div className="co-header-banner" style={{ background: charcoal, color: "#fff", padding: "28px 36px" }}>
            <div className="flex justify-between items-start">
              <div>
                {company?.logo_url && (
                  <img src={company.logo_url} alt="Logo" className="h-10 mb-3" style={{ objectFit: "contain" }} />
                )}
                <h1 className="text-lg font-bold tracking-tight">{company?.name || "Company"}</h1>
                {company?.address && <p className="text-xs co-header-opacity" style={{ opacity: 0.8 }}>{company.address}</p>}
                {company?.phone && <p className="text-xs co-header-opacity" style={{ opacity: 0.8 }}>Tel: {company.phone}</p>}
                {company?.email && <p className="text-xs co-header-opacity" style={{ opacity: 0.8 }}>{company.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: amber }}>Change Order</p>
                <p className="text-xl font-extrabold mt-1">{co.co_number}</p>
                <p className="text-xs co-header-opacity mt-2" style={{ opacity: 0.7 }}>{fmtDate(co.created_at)}</p>
                {co.requested_by && <p className="text-xs co-header-opacity" style={{ opacity: 0.7 }}>Requested by: {co.requested_by}</p>}
              </div>
            </div>
          </div>

          {/* Amber accent bar */}
          <div className="co-accent-bar" style={{ height: 4, background: amber }} />

          {/* Body */}
          <div style={{ padding: "28px 36px" }}>
            {/* Project / Client info cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="co-info-card rounded-md p-4" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] mb-2" style={{ color: slate }}>Project Details</div>
                {projectNumber && (
                  <div className="text-sm mb-0.5"><span className="font-bold">Project:</span> {projectNumber}</div>
                )}
                {projectAddress && (
                  <div className="text-sm"><span className="font-bold">Address:</span> {projectAddress}</div>
                )}
              </div>
              <div className="co-info-card rounded-md p-4" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                <div className="text-[10px] font-bold uppercase tracking-[1.2px] mb-2" style={{ color: slate }}>Client</div>
                <div className="text-sm font-bold">{clientInfo?.name || "—"}</div>
              </div>
            </div>

            {/* Section heading with amber bar */}
            <div className="flex items-center gap-3 mb-4 mt-2">
              <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
              <h3 className="text-base font-bold" style={{ color: charcoal }}>{co.title}</h3>
            </div>

            {/* Line Items */}
            <div className="mb-5">
              {lineItems.map((item: any, i: number) => (
                <div key={i} className="py-3" style={{ borderBottom: i < lineItems.length - 1 ? "0.5px solid #e2e8f0" : "none" }}>
                  <div className="flex justify-between items-baseline">
                    <div className="text-sm font-bold" style={{ color: charcoal }}>{item.name}</div>
                    <div className="text-sm font-bold" style={{ color: charcoal }}>
                      {isCredit ? `-${fmt(Math.abs(item.amount))}` : fmt(item.amount)}
                    </div>
                  </div>
                  {item.description && <div className="text-xs mt-1" style={{ color: slate, lineHeight: 1.5 }}>{item.description}</div>}
                </div>
              ))}
            </div>

            {/* Total bar */}
            <div className="co-total-box flex justify-between items-center rounded-md px-5 py-3 mt-5" style={{ background: charcoal }}>
              <span className="text-sm font-bold uppercase tracking-wider text-white">
                {isCredit ? "Total Credit" : "Total"}
              </span>
              <span className="text-lg font-extrabold text-white">
                {isCredit ? `-${fmt(Math.abs(co.amount))}` : fmt(co.amount)}
              </span>
            </div>

            {/* Deposit callout */}
            {co.deposit_percentage > 0 && (
              <div className="co-total-box flex justify-between items-center rounded-md px-5 py-2.5 mt-2.5" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <span className="text-sm font-bold" style={{ color: "#92400e" }}>
                  Deposit Due Upon Signing ({co.deposit_percentage}%)
                </span>
                <span className="text-base font-bold" style={{ color: "#92400e" }}>
                  {fmt(Math.abs(co.amount) * co.deposit_percentage / 100)}
                </span>
              </div>
            )}

            {/* Terms Reference */}
            <div className="my-5 text-xs italic" style={{ color: slate, lineHeight: 1.5 }}>
              By signing this Change Order, you acknowledge that all terms and conditions of the original proposal/contract remain in full effect. This Change Order modifies only the scope and fees described above.
            </div>

            {/* Reason */}
            {co.reason && (
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-3 mt-6">
                  <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                  <h4 className="text-sm font-bold" style={{ color: charcoal }}>Reason for Change</h4>
                </div>
                <p className="text-sm co-reason-box" style={{ color: "#475569", lineHeight: 1.55 }}>{co.reason}</p>
              </div>
            )}

            {/* Signature Section */}
            <div className="mt-8">
              <p className="text-xs font-bold mb-1" style={{ color: slate }}>Please sign the designated space provided below and return a copy</p>
              <div className="flex items-center gap-3 mb-4">
                <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                <h4 className="text-sm font-bold" style={{ color: charcoal }}>Agreed to and accepted by</h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Internal Signature */}
                <div className="co-sig-card rounded-md p-4" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                  <div className="text-sm font-bold mb-5" style={{ color: charcoal }}>
                    {company?.name || "Company"}
                  </div>
                  {co.internal_signature_data ? (
                    <img src={co.internal_signature_data} alt="Internal signature" className="h-7 object-contain mb-1" />
                  ) : (
                    <div className="h-7 border-b-2 mb-1" style={{ borderColor: charcoal }} />
                  )}
                  {co.internal_signed_at && (
                    <>
                      <div className="text-xs mt-1" style={{ color: slate }}>
                        By: {co.internal_signer_name || "—"}
                      </div>
                      <div className="text-xs" style={{ color: slate }}>Date: {fmtDate(co.internal_signed_at)}</div>
                    </>
                  )}
                </div>

                {/* Client Signature */}
                <div className="co-sig-card rounded-md p-4" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                  <div className="text-sm font-bold mb-5" style={{ color: charcoal }}>
                    {clientInfo?.name || "Client"}
                  </div>
                  {(co.client_signature_data || savedSignatureData) ? (
                    <>
                      <img src={co.client_signature_data || savedSignatureData!} alt="Client signature" className="h-7 object-contain mb-1" />
                      <div className="text-xs mt-1" style={{ color: slate }}>
                        By: {co.client_signer_name || clientName}
                      </div>
                      <div className="text-xs" style={{ color: slate }}>Date: {fmtDate(co.client_signed_at || new Date().toISOString())}</div>
                    </>
                  ) : (
                    <div className="h-7 border-b-2 mb-1" style={{ borderColor: charcoal }} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-9 pb-5 pt-3" style={{ borderTop: "0.5px solid #e2e8f0" }}>
            <p className="text-center text-[10px]" style={{ color: slate }}>
              {company?.address || ""}
              {company?.phone ? `  ·  Tel: ${company.phone}` : ""}
              {company?.email ? `  ·  ${company.email}` : ""}
            </p>
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
