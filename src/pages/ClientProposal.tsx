import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, CheckCircle2, PenLine, CreditCard, Building2, FileText, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ClientProposalPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientTitle, setClientTitle] = useState("");
  const [signed, setSigned] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<"card" | "ach" | null>(null);

  // Fetch proposal by public token
  const { data: proposal, isLoading, error } = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: async () => {
      if (!token) throw new Error("No token");

      const { data, error } = await supabase
        .from("proposals")
        .select(`
          *,
          properties (id, address, borough),
          items:proposal_items(*),
          milestones:proposal_milestones(*)
        `)
        .eq("public_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Proposal not found");
      return data as any;
    },
    enabled: !!token,
  });

  // Fetch company info for the proposal
  const { data: company } = useQuery({
    queryKey: ["public-company", proposal?.company_id],
    queryFn: async () => {
      if (!proposal?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("name, address, phone, email, website, logo_url, settings")
        .eq("id", proposal.company_id)
        .single();
      if (!data) return null;
      const s = (data.settings || {}) as any;
      return {
        name: data.name,
        address: s.company_address || data.address || "",
        phone: s.company_phone || data.phone || "",
        fax: s.company_fax || "",
        email: s.company_email || data.email || "",
        website: s.company_website || data.website || "",
        logo_url: s.company_logo_url || data.logo_url || "",
      };
    },
    enabled: !!proposal?.company_id,
  });

  // Fetch linked RFI to get the PIS access token
  const { data: rfiToken } = useQuery({
    queryKey: ["public-rfi-token", proposal?.id],
    queryFn: async () => {
      if (!proposal?.id) return null;
      const { data } = await supabase
        .from("rfi_requests")
        .select("access_token")
        .eq("proposal_id", proposal.id)
        .maybeSingle();
      return (data as any)?.access_token || null;
    },
    enabled: !!proposal?.id,
  });

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!canvasRef.current || !token) throw new Error("Missing data");
      const sigData = canvasRef.current.toDataURL("image/png");
      const { error } = await supabase
        .from("proposals")
        .update({
          client_signature_data: sigData,
          client_signed_name: clientName,
          client_signed_title: clientTitle,
          client_signed_at: new Date().toISOString(),
          status: "signed_client",
        } as any)
        .eq("public_token", token);
      if (error) throw error;
    },
    onSuccess: () => {
      setSigned(true);
      queryClient.invalidateQueries({ queryKey: ["public-proposal", token] });
      toast({ title: "Proposal signed!", description: "Thank you for signing. The team has been notified." });
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
  }, [proposal]);

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

  const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

  const interpolate = (text: string | null | undefined): string => {
    if (!text) return "";
    const tAmt = Number(proposal?.total_amount || proposal?.subtotal || 0);
    const dPct = Number(proposal?.deposit_percentage || 0);
    const dAmt = Number(proposal?.deposit_required || 0) || (dPct > 0 ? tAmt * (dPct / 100) : 0);
    return text
      .replace(/\$[\{\[]retainer_amount[\}\]]|\$[\{\[]deposit_amount[\}\]]/gi, fmt(dAmt))
      .replace(/\$[\{\[]total_amount[\}\]]/gi, fmt(tAmt))
      .replace(/\$[\{\[]deposit_percentage[\}\]]/gi, `${dPct}%`)
      .replace(/\$[\{\[]company_name[\}\]]/gi, company?.name || "")
      .replace(/\$[\{\[]client_name[\}\]]/gi, proposal?.client_name || "Client");
  };

  const parseBullets = (desc: string | null): string[] => {
    if (!desc) return [];
    return desc.split(/\n|•|·/).map(s => s.replace(/^-\s*/, '').trim()).filter(s => s.length > 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Proposal Not Found</h1>
          <p className="text-muted-foreground">This link may have expired or the proposal no longer exists.</p>
        </div>
      </div>
    );
  }

  const items = proposal.items || [];
  const nonOptional = items.filter((i: any) => !i.is_optional);
  const optional = items.filter((i: any) => i.is_optional);
  const nonOptionalTotal = nonOptional.reduce((sum: number, i: any) => sum + Number(i.total_price || i.quantity * i.unit_price || 0), 0);
  const totalAmount = nonOptionalTotal || Number(proposal.total_amount || proposal.subtotal || 0);
  const depositPct = Number(proposal.deposit_percentage || 0);
  const depositAmt = Number(proposal.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);
  const alreadySigned = !!proposal.client_signed_at || signed;

  const amber = "hsl(38, 92%, 50%)";
  const charcoal = "#1c2127";
  const slate = "#64748b";

  return (
    <div className="min-h-screen bg-[#f1f5f9]">
      {/* Top bar */}
      <div style={{ background: charcoal, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt="" style={{ height: 28, filter: "brightness(0) invert(1)" }} />
          ) : (
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "14pt" }}>{company?.name}</span>
          )}
        </div>
        <div style={{ color: "#94a3b8", fontSize: "9pt" }}>
          Proposal #{proposal.proposal_number}
        </div>
      </div>
      <div style={{ height: 3, background: amber }} />

      {/* Proposal content */}
      <div className="max-w-[740px] mx-auto py-8 px-4">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden" style={{ color: charcoal }}>

          {/* Header */}
          <div style={{ padding: "32px 40px 24px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "18pt", fontWeight: 800, marginBottom: 4 }}>{proposal.client_name || proposal.title || "Proposal"}</h1>
                <p style={{ fontSize: "10pt", color: slate }}>{proposal.properties?.address}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "22pt", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totalAmount)}</div>
                <div style={{ fontSize: "9pt", color: slate, marginTop: 2 }}>Contract Total</div>
              </div>
            </div>
          </div>

          {/* Services */}
          <div style={{ padding: "28px 40px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 4, height: 24, background: amber, borderRadius: 2 }} />
              <h2 style={{ fontSize: "14pt", fontWeight: 800, margin: 0 }}>Scope of Work</h2>
            </div>

            {nonOptional.map((item: any, i: number) => {
              const bullets = parseBullets(item.description);
              const price = Number(item.total_price || item.quantity * item.unit_price);
              return (
                <div key={i} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: i < nonOptional.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: "11pt", fontWeight: 700 }}>{item.name}</span>
                    <span style={{ fontSize: "11pt", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(price)}</span>
                  </div>
                  {bullets.length > 0 && (
                    <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0, fontSize: "9.5pt", color: slate, lineHeight: 1.6 }}>
                      {bullets.map((b, bi) => (
                        <li key={bi} style={{ paddingLeft: 14, position: "relative" }}>
                          <span style={{ position: "absolute", left: 0, color: amber, fontWeight: 700 }}>›</span>{b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            {optional.length > 0 && (
              <>
                <h3 style={{ fontSize: "11pt", fontWeight: 700, color: slate, margin: "20px 0 12px" }}>Optional Services</h3>
                {optional.map((item: any, i: number) => {
                  const price = Number(item.total_price || item.quantity * item.unit_price);
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, opacity: 0.8 }}>
                      <span style={{ fontSize: "10pt" }}>{item.name} <span style={{ fontSize: "8pt", color: slate, background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>OPTIONAL</span></span>
                      <span style={{ fontSize: "10pt", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(price)}</span>
                    </div>
                  );
                })}
              </>
            )}

            {/* Total bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: charcoal, color: "#fff", padding: "12px 18px", borderRadius: 6, marginTop: 24 }}>
              <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontSize: "10pt" }}>Total</span>
              <span style={{ fontSize: "14pt", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totalAmount)}</span>
            </div>

            {depositAmt > 0 && (
              <div style={{ marginTop: 10, padding: "10px 18px", background: "rgba(245, 158, 11, 0.08)", borderLeft: `3px solid ${amber}`, borderRadius: "0 6px 6px 0", fontSize: "9.5pt" }}>
                <strong>Retainer Due Upon Signing:</strong> {fmt(depositAmt)}
                {depositPct > 0 && <span style={{ color: slate }}> ({depositPct}% of total)</span>}
              </div>
            )}
          </div>

          {/* Terms */}
          {(proposal.payment_terms || proposal.terms_conditions) && (
            <div style={{ padding: "0 40px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                <h2 style={{ fontSize: "12pt", fontWeight: 800, margin: 0 }}>Terms & Conditions</h2>
              </div>
              {proposal.payment_terms && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 3 }}>Payment Terms</h4>
                  <p style={{ fontSize: "9pt", color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{interpolate(proposal.payment_terms)}</p>
                </div>
              )}
              {proposal.terms_conditions && (
                <div>
                  {proposal.terms_conditions.split(/\n\n+/).map((block: string, bi: number) => {
                    const lines = block.split('\n');
                    const heading = lines[0]?.endsWith(':') ? lines[0] : null;
                    const body = heading ? lines.slice(1).join('\n') : block;
                    return (
                      <div key={bi} style={{ marginBottom: 14 }}>
                        {heading && <h4 style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 3 }}>{heading}</h4>}
                        <p style={{ fontSize: "9pt", color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>{interpolate(body)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Company signature (already signed) */}
          {proposal.internal_signature_data && (
            <div style={{ padding: "0 40px 20px" }}>
              <div style={{ padding: "16px 20px", background: "#f8f9fa", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "9pt", fontWeight: 700, color: slate, marginBottom: 8 }}>Signed by {company?.name}</div>
                <img src={proposal.internal_signature_data} alt="Company Signature" style={{ height: 36, objectFit: "contain" }} />
                <div style={{ fontSize: "8.5pt", color: slate, marginTop: 6 }}>
                  Date: {fmtDate(proposal.internal_signed_at)}
                </div>
              </div>
            </div>
          )}

          {/* Client Signature Section */}
          <div style={{ padding: "20px 40px 36px", borderTop: "1px solid #e2e8f0" }}>
            {alreadySigned ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: "#10b981" }} />
                <h3 className="text-lg font-bold mb-1">Proposal Signed</h3>
                <p className="text-sm" style={{ color: slate }}>
                  Thank you! This proposal was signed on {fmtDate(proposal.client_signed_at)}.
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                  <h2 style={{ fontSize: "12pt", fontWeight: 800, margin: 0 }}>Your Signature</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="client-name" className="text-xs font-medium" style={{ color: slate }}>Full Name *</Label>
                    <Input id="client-name" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Your full name" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="client-title" className="text-xs font-medium" style={{ color: slate }}>Title</Label>
                    <Input id="client-title" value={clientTitle} onChange={e => setClientTitle(e.target.value)} placeholder="e.g. Property Manager" className="mt-1" />
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-medium" style={{ color: slate }}>Signature *</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={clearSig} className="h-7 text-xs">
                      <RotateCcw className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  </div>
                  <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white" style={{ borderColor: "#e2e8f0" }}>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={160}
                      className="w-full cursor-crosshair touch-none"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: slate }}>Draw your signature above</p>
                </div>

                <Button
                  onClick={() => signMutation.mutate()}
                  disabled={!hasSignature || !clientName || signMutation.isPending}
                  className="w-full h-11 text-sm font-bold"
                  style={{ background: amber, color: charcoal }}
                >
                  {signMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing...</>
                  ) : (
                    <><PenLine className="mr-2 h-4 w-4" /> Sign & Accept Proposal</>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* ═══ Deposit Payment Section (shown after signing) ═══ */}
          {alreadySigned && depositAmt > 0 && (
            <div style={{ padding: "28px 40px 32px", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                <h2 style={{ fontSize: "12pt", fontWeight: 800, margin: 0, color: charcoal }}>Pay Retainer Deposit</h2>
              </div>
              <p style={{ fontSize: "9.5pt", color: slate, marginBottom: 16, lineHeight: 1.6 }}>
                Your retainer of <strong style={{ color: charcoal }}>{fmt(depositAmt)}</strong> is due to begin work. Select a payment method below.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  className="border-2 rounded-lg p-4 text-left hover:border-amber-400 transition-colors group cursor-pointer"
                  style={{ borderColor: selectedPayment === "card" ? amber : "#e2e8f0", background: selectedPayment === "card" ? "hsl(38, 92%, 50%, 0.06)" : undefined }}
                  onClick={() => setSelectedPayment("card")}
                >
                  <CreditCard className="h-5 w-5 mb-2" style={{ color: amber }} />
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>Credit / Debit Card</div>
                  <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>Visa, Mastercard, Amex</div>
                </button>
                <button
                  className="border-2 rounded-lg p-4 text-left hover:border-amber-400 transition-colors group cursor-pointer"
                  style={{ borderColor: selectedPayment === "ach" ? amber : "#e2e8f0", background: selectedPayment === "ach" ? "hsl(38, 92%, 50%, 0.06)" : undefined }}
                  onClick={() => setSelectedPayment("ach")}
                >
                  <Building2 className="h-5 w-5 mb-2" style={{ color: amber }} />
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>ACH / Bank Transfer</div>
                  <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>Direct from your bank account</div>
                </button>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ background: "#f8f9fa", border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: "8.5pt", color: slate }}>
                  Secure payment processing powered by Stripe. Your information is encrypted and never stored on our servers.
                </p>
              </div>
            </div>
          )}

          {/* ═══ Project Information Sheet (PIS) Section ═══ */}
          <div style={{ padding: "28px 40px 32px", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
              <h2 style={{ fontSize: "12pt", fontWeight: 800, margin: 0, color: charcoal }}>Project Information Sheet</h2>
            </div>
            <p style={{ fontSize: "9.5pt", color: slate, marginBottom: 16, lineHeight: 1.6 }}>
              To expedite your project, please fill out the Project Information Sheet below. This helps us gather the details we need to begin filing on your behalf.
            </p>
            <a
              href={rfiToken ? `/rfi?token=${rfiToken}` : `/rfi?property=${encodeURIComponent(proposal.properties?.address || "")}&proposal=${proposal.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg p-4 hover:shadow-md transition-shadow"
              style={{ background: "hsl(38, 92%, 50%, 0.06)", border: `1px solid hsl(38, 92%, 50%, 0.25)` }}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2" style={{ background: "hsl(38, 92%, 50%, 0.15)" }}>
                  <FileText className="h-5 w-5" style={{ color: amber }} />
                </div>
                <div>
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>Fill Out Project Information Sheet</div>
                  <div style={{ fontSize: "8.5pt", color: slate, marginTop: 1 }}>
                    Building details, applicant info, owner details & more
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4" style={{ color: amber }} />
            </a>
          </div>
        </div>
        <div className="text-center py-6" style={{ fontSize: "8.5pt", color: slate }}>
          {company?.name && <div>{company.name}</div>}
          {company?.address && <div>{company.address}</div>}
          {company?.phone && <span>Tel: {company.phone} </span>}
          {company?.email && <span>• {company.email}</span>}
        </div>
      </div>
    </div>
  );
}
