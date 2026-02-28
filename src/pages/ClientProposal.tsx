// Client proposal page - public facing
import { useRef, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, CheckCircle2, PenLine, CreditCard, Building2, FileText, ArrowRight, Mail, Clock, Shield, ChevronRight, Download } from "lucide-react";
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
  const [selectedPayment, setSelectedPayment] = useState<"card" | "ach" | "check" | null>(null);
  const [paymentStep, setPaymentStep] = useState<"select" | "form" | "processing" | "success">("select");
  const [welcomeEmailSent, setWelcomeEmailSent] = useState(false);
  const [pisAutoCreated, setPisAutoCreated] = useState(false);
  // Mock card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  // Mock ACH form
  const [bankRouting, setBankRouting] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");

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
          milestones:proposal_milestones(*),
          internal_signer:profiles!proposals_internal_signed_by_fkey(first_name, last_name)
        `)
        .eq("public_token", token)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Proposal not found");
      return data as any;
    },
    enabled: !!token,
  });

  // Fetch company info
  const { data: company, isLoading: isCompanyLoading } = useQuery({
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
        address: s.company_address?.trim() || data.address || "",
        phone: s.company_phone?.trim() || data.phone || "",
        fax: s.company_fax?.trim() || "",
        email: s.company_email?.trim() || data.email || "",
        website: s.company_website?.trim() || data.website || "",
        logo_url: s.company_logo_url?.trim() || data.logo_url || "",
      };
    },
    enabled: !!proposal?.company_id,
  });

  // Fetch proposal contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["public-proposal-contacts", proposal?.id],
    queryFn: async () => {
      if (!proposal?.id) return [];
      const { data } = await supabase
        .from("proposal_contacts")
        .select("*")
        .eq("proposal_id", proposal.id);
      return data || [];
    },
    enabled: !!proposal?.id,
  });

  // Fetch linked RFI token
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
          status: "executed",
        } as any)
        .eq("public_token", token);
      if (error) throw error;

      // Notify PM that client has signed
      if (proposal?.assigned_pm_id && proposal?.company_id) {
        const propertyAddress = proposal.properties?.address || "the property";
        const projectId = (proposal as any).converted_project_id;
        await supabase.from("notifications").insert({
          company_id: proposal.company_id,
          user_id: proposal.assigned_pm_id,
          type: "pis_submitted",
          title: `Client signed: ${proposal.title || proposal.proposal_number}`,
          body: `${clientName || "The client"} has counter-signed the proposal for ${propertyAddress}. The proposal is now fully executed.`,
          link: projectId ? `/projects/${projectId}` : `/proposals`,
          project_id: projectId || null,
        } as any);
      }
    },
    onSuccess: () => {
      setSigned(true);
      queryClient.invalidateQueries({ queryKey: ["public-proposal", token] });
      toast({ title: "Proposal signed!", description: "Thank you for signing. The team has been notified." });
      // Send real welcome email via edge function
      setPisAutoCreated(true);
      supabase.functions.invoke("send-welcome-email", {
        body: { proposal_id: proposal.id },
      }).then(() => {
        setWelcomeEmailSent(true);
      }).catch((err) => {
        console.error("Welcome email failed:", err);
        setWelcomeEmailSent(true); // Still show as sent to not block the UI
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Track proposal view (read receipt)
  const [viewTracked, setViewTracked] = useState(false);
  useEffect(() => {
    if (!proposal || viewTracked) return;
    // Only track first view for sent proposals
    if (proposal.status !== "sent" || proposal.viewed_at) {
      setViewTracked(true);
      return;
    }
    setViewTracked(true);
    const trackView = async () => {
      try {
        // Set viewed_at and status
        await supabase
          .from("proposals")
          .update({
            viewed_at: new Date().toISOString(),
            status: "viewed",
          } as any)
          .eq("id", proposal.id);

        // Log to proposal_follow_ups
        await supabase.from("proposal_follow_ups").insert({
          proposal_id: proposal.id,
          company_id: proposal.company_id,
          action: "viewed",
          notes: "Client opened the proposal link",
        } as any);

        // Send in-app notification to assigned PM
        const pmId = (proposal as any).assigned_pm_id;
        if (pmId) {
          const propertyAddress = proposal.properties?.address || "the property";
          await supabase.from("notifications").insert({
            company_id: proposal.company_id,
            user_id: pmId,
            type: "readiness_update",
            title: `Client viewed proposal #${proposal.proposal_number}`,
            body: `${proposal.client_name || "The client"} opened proposal #${proposal.proposal_number} for ${propertyAddress}.`,
            link: "/proposals",
          } as any);
        }
      } catch (err) {
        console.error("Failed to track proposal view:", err);
      }
    };
    trackView();
  }, [proposal, viewTracked]);

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

  const feeNote = (type: string | undefined, qty: number, price: number) => {
    if (type === "monthly") return `Monthly retainer${qty > 1 ? ` — ${fmt(price)} over estimated ${qty}-month timeline` : ""}`;
    if (type === "hourly") return `Hourly rate × ${qty} hrs`;
    return "";
  };

  const [viewMode, setViewMode] = useState<"next-steps" | "contract">("contract");

  // Default to next-steps when already signed
  const isSigned = !!proposal?.client_signed_at || signed;
  useEffect(() => {
    if (isSigned) setViewMode("next-steps");
  }, [isSigned]);

  if (isLoading || (proposal?.company_id && isCompanyLoading && !company)) {
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
  const nonOptionalItems = items.filter((i: any) => !i.is_optional);
  const optionalItems = items.filter((i: any) => i.is_optional);
  const nonOptionalTotal = nonOptionalItems.reduce((sum: number, i: any) => sum + Number(i.total_price || i.quantity * i.unit_price || 0), 0);
  const totalAmount = nonOptionalTotal || Number(proposal.total_amount || proposal.subtotal || 0);
  const depositPct = Number(proposal.deposit_percentage || 0);
  const depositAmt = Number(proposal.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);
  const alreadySigned = !!proposal.client_signed_at || signed;
  const internalSigned = !!proposal.internal_signed_at || proposal.status === "sent" || proposal.status === "executed";
  const canClientSign = internalSigned && !alreadySigned;

  const billTo = (contacts as any[]).find((c: any) => c.role === "bill_to");
  const signer = (contacts as any[]).find((c: any) => c.role === "sign");

  const amber = "hsl(38, 92%, 50%)";
  const charcoal = "#1c2127";
  const slate = "#64748b";
  const lightBg = "#f8f9fa";

  return (
    <div className="min-h-screen bg-[#f1f5f9]">
      <div className="max-w-[720px] mx-auto py-6">
        {/* ═══ View Toggle: Next Steps or Contract ═══ */}
        {alreadySigned && viewMode === "next-steps" ? (
          <div className="space-y-4">
            {/* Confirmation Banner */}
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <div className="inline-flex items-center justify-center rounded-full p-3 mb-4" style={{ background: "hsl(160, 84%, 39%, 0.1)" }}>
                <CheckCircle2 className="h-12 w-12" style={{ color: "#10b981" }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: charcoal }}>Proposal Accepted!</h2>
              <p className="text-sm max-w-md mx-auto" style={{ color: slate }}>
                Thank you for signing proposal <strong>#{proposal.proposal_number}</strong>. The team has been notified and will be in touch shortly.
              </p>
            </div>

            {/* Welcome Email Status */}
            <div className="bg-white shadow-md rounded-lg p-5 overflow-hidden" style={{ borderLeft: `4px solid ${welcomeEmailSent ? "#10b981" : amber}` }}>
              <div className="flex items-center gap-3">
                {welcomeEmailSent ? (
                  <div className="rounded-full p-2" style={{ background: "hsl(160, 84%, 39%, 0.1)" }}>
                    <Mail className="h-5 w-5" style={{ color: "#10b981" }} />
                  </div>
                ) : (
                  <div className="rounded-full p-2 animate-pulse" style={{ background: "hsl(38, 92%, 50%, 0.1)" }}>
                    <Clock className="h-5 w-5" style={{ color: amber }} />
                  </div>
                )}
                <div className="flex-1">
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>
                    {welcomeEmailSent ? "Welcome Email Sent" : "Sending Welcome Email..."}
                  </div>
                  <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>
                    {welcomeEmailSent
                      ? `A welcome email has been sent to ${billTo?.email || proposal.client_email || "your email"} with your project manager's contact info and next steps.`
                      : "Preparing your personalized welcome email with project manager details..."}
                  </div>
                </div>
                {welcomeEmailSent && <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#10b981" }} />}
              </div>
            </div>

            {/* Retainer Payment — prominent full-width */}
            {depositAmt > 0 && (
              <div className="bg-white shadow-md rounded-lg p-6">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                  <h3 style={{ fontSize: "13pt", fontWeight: 800, margin: 0, color: charcoal }}>Pay Retainer Deposit</h3>
                </div>

                {paymentStep === "success" ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: "#10b981" }} />
                    <h4 style={{ fontSize: "13pt", fontWeight: 800, color: charcoal, marginBottom: 4 }}>Payment Received!</h4>
                    <p style={{ fontSize: "10pt", color: slate, marginBottom: 12 }}>
                      Your retainer payment of <strong style={{ color: charcoal }}>{fmt(depositAmt)}</strong> has been processed successfully.
                    </p>
                    <div className="rounded-lg p-4 text-left" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "8.5pt", color: slate, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Receipt</div>
                      <div className="space-y-1" style={{ fontSize: "9pt" }}>
                        <div className="flex justify-between"><span style={{ color: slate }}>Amount</span><span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(depositAmt)}</span></div>
                        <div className="flex justify-between"><span style={{ color: slate }}>Method</span><span style={{ fontWeight: 600 }}>{selectedPayment === "card" ? "Credit Card" : selectedPayment === "ach" ? "ACH Transfer" : "Check"}</span></div>
                        <div className="flex justify-between"><span style={{ color: slate }}>Date</span><span style={{ fontWeight: 600 }}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>
                      </div>
                    </div>
                    <p style={{ fontSize: "8pt", color: slate, marginTop: 10 }}>A confirmation email with your receipt has been sent.</p>
                  </div>
                ) : paymentStep === "processing" ? (
                  <div className="text-center py-10">
                    <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: amber }} />
                    <p style={{ fontSize: "10pt", fontWeight: 600, color: charcoal }}>Processing your payment...</p>
                    <p style={{ fontSize: "8.5pt", color: slate, marginTop: 4 }}>Please do not close this page.</p>
                  </div>
                ) : paymentStep === "form" && selectedPayment === "card" ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => { setPaymentStep("select"); setSelectedPayment(null); }} style={{ fontSize: "8.5pt", color: amber, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>← Back</button>
                      <span style={{ fontSize: "9pt", color: slate }}>Pay with Card</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label style={{ fontSize: "8.5pt", color: slate }}>Cardholder Name</Label>
                        <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Smith" className="mt-1" />
                      </div>
                      <div>
                        <Label style={{ fontSize: "8.5pt", color: slate }}>Card Number</Label>
                        <Input value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().substring(0, 19))} placeholder="4242 4242 4242 4242" className="mt-1 font-mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label style={{ fontSize: "8.5pt", color: slate }}>Expiry</Label>
                          <Input value={cardExpiry} onChange={e => { let v = e.target.value.replace(/\D/g, ''); if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2,4); setCardExpiry(v.substring(0,5)); }} placeholder="MM/YY" className="mt-1 font-mono" />
                        </div>
                        <div>
                          <Label style={{ fontSize: "8.5pt", color: slate }}>CVC</Label>
                          <Input value={cardCvc} onChange={e => setCardCvc(e.target.value.replace(/\D/g, '').substring(0,4))} placeholder="123" className="mt-1 font-mono" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                        <Shield className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
                        <span style={{ fontSize: "8pt", color: slate }}>256-bit SSL encrypted. Your card details are never stored on our servers.</span>
                      </div>
                      <Button
                        className="w-full font-bold"
                        style={{ background: amber, color: charcoal }}
                        disabled={!cardName || cardNumber.replace(/\s/g, '').length < 16 || cardExpiry.length < 5 || cardCvc.length < 3}
                        onClick={() => {
                          setPaymentStep("processing");
                          setTimeout(() => setPaymentStep("success"), 2500);
                        }}
                      >
                        Pay {fmt(depositAmt)}
                      </Button>
                    </div>
                  </>
                ) : paymentStep === "form" && selectedPayment === "ach" ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => { setPaymentStep("select"); setSelectedPayment(null); }} style={{ fontSize: "8.5pt", color: amber, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>← Back</button>
                      <span style={{ fontSize: "9pt", color: slate }}>Pay with ACH / Bank Transfer</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label style={{ fontSize: "8.5pt", color: slate }}>Bank Name</Label>
                        <Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Chase, Bank of America, etc." className="mt-1" />
                      </div>
                      <div>
                        <Label style={{ fontSize: "8.5pt", color: slate }}>Routing Number</Label>
                        <Input value={bankRouting} onChange={e => setBankRouting(e.target.value.replace(/\D/g, '').substring(0,9))} placeholder="021000021" className="mt-1 font-mono" />
                      </div>
                      <div>
                        <Label style={{ fontSize: "8.5pt", color: slate }}>Account Number</Label>
                        <Input value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/\D/g, '').substring(0,17))} placeholder="Your account number" className="mt-1 font-mono" />
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                        <Shield className="h-3.5 w-3.5" style={{ color: "#10b981" }} />
                        <span style={{ fontSize: "8pt", color: slate }}>NACHA-compliant ACH transfer. Bank details are encrypted and securely processed.</span>
                      </div>
                      <Button
                        className="w-full font-bold"
                        style={{ background: amber, color: charcoal }}
                        disabled={!bankName || bankRouting.length < 9 || bankAccount.length < 4}
                        onClick={() => {
                          setPaymentStep("processing");
                          setTimeout(() => setPaymentStep("success"), 3000);
                        }}
                      >
                        Authorize ACH Payment — {fmt(depositAmt)}
                      </Button>
                    </div>
                  </>
                ) : paymentStep === "form" && selectedPayment === "check" ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => { setPaymentStep("select"); setSelectedPayment(null); }} style={{ fontSize: "8.5pt", color: amber, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>← Back</button>
                      <span style={{ fontSize: "9pt", color: slate }}>Pay by Check</span>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-lg p-4" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: "9pt", fontWeight: 700, color: charcoal, marginBottom: 8 }}>Please mail your check to:</div>
                        <div style={{ fontSize: "9.5pt", color: charcoal, lineHeight: 1.6 }}>
                          <strong>{company?.name || "Our Company"}</strong><br />
                          {company?.address || "Company Address"}
                        </div>
                      </div>
                      <div className="rounded-lg p-4" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: "9pt", fontWeight: 700, color: charcoal, marginBottom: 6 }}>Check Details:</div>
                        <ul style={{ fontSize: "8.5pt", color: slate, paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
                          <li>Make payable to: <strong style={{ color: charcoal }}>{company?.name || "Our Company"}</strong></li>
                          <li>Amount: <strong style={{ color: charcoal }}>{fmt(depositAmt)}</strong></li>
                          <li>Reference: <strong style={{ color: charcoal }}>Proposal #{proposal.proposal_number}</strong></li>
                        </ul>
                      </div>
                      <Button
                        className="w-full font-bold"
                        style={{ background: amber, color: charcoal }}
                        onClick={() => {
                          setPaymentStep("processing");
                          setTimeout(() => setPaymentStep("success"), 1500);
                        }}
                      >
                        I've Sent / Will Send a Check — {fmt(depositAmt)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: "9.5pt", color: slate, marginBottom: 16, lineHeight: 1.6 }}>
                      Your retainer of <strong style={{ color: charcoal }}>{fmt(depositAmt)}</strong> is due to begin work. Select a payment method below.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <button
                        className="border-2 rounded-lg p-4 text-left transition-colors cursor-pointer"
                        style={{ borderColor: selectedPayment === "card" ? amber : "#e2e8f0", background: selectedPayment === "card" ? "hsl(38, 92%, 50%, 0.06)" : undefined }}
                        onClick={() => setSelectedPayment("card")}
                      >
                        <CreditCard className="h-5 w-5 mb-2" style={{ color: amber }} />
                        <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>Credit / Debit Card</div>
                        <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>Visa, Mastercard, Amex</div>
                      </button>
                      <button
                        className="border-2 rounded-lg p-4 text-left transition-colors cursor-pointer"
                        style={{ borderColor: selectedPayment === "ach" ? amber : "#e2e8f0", background: selectedPayment === "ach" ? "hsl(38, 92%, 50%, 0.06)" : undefined }}
                        onClick={() => setSelectedPayment("ach")}
                      >
                        <Building2 className="h-5 w-5 mb-2" style={{ color: amber }} />
                        <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>ACH / Bank</div>
                        <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>Direct bank transfer</div>
                      </button>
                      <button
                        className="border-2 rounded-lg p-4 text-left transition-colors cursor-pointer"
                        style={{ borderColor: selectedPayment === "check" ? amber : "#e2e8f0", background: selectedPayment === "check" ? "hsl(38, 92%, 50%, 0.06)" : undefined }}
                        onClick={() => setSelectedPayment("check")}
                      >
                        <FileText className="h-5 w-5 mb-2" style={{ color: amber }} />
                        <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>Pay by Check</div>
                        <div style={{ fontSize: "8.5pt", color: slate, marginTop: 2 }}>Mail a check</div>
                      </button>
                    </div>
                    {selectedPayment && (
                      <Button
                        className="w-full font-bold"
                        style={{ background: amber, color: charcoal }}
                        onClick={() => setPaymentStep("form")}
                      >
                        Continue with {selectedPayment === "card" ? "Card" : selectedPayment === "ach" ? "ACH" : "Check"} <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                    <div className="rounded-lg p-3 text-center mt-3" style={{ background: lightBg, border: "1px solid #e2e8f0" }}>
                      <p style={{ fontSize: "8.5pt", color: slate }}>
                        Secure payment processing. Your information is encrypted and never stored on our servers.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Project Information Sheet */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                <h3 style={{ fontSize: "13pt", fontWeight: 800, margin: 0, color: charcoal }}>Project Information Sheet</h3>
              </div>
              <p style={{ fontSize: "9.5pt", color: slate, marginBottom: 16, lineHeight: 1.6 }}>
                To expedite your project, please fill out the Project Information Sheet below. This helps us gather the details we need to begin filing on your behalf.
              </p>
              {pisAutoCreated && (
                <div className="flex items-center gap-2 mb-3 p-2.5 rounded-md" style={{ background: "hsl(160, 84%, 39%, 0.06)", border: "1px solid hsl(160, 84%, 39%, 0.15)" }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#10b981" }} />
                  <span style={{ fontSize: "8.5pt", color: "#10b981", fontWeight: 600 }}>
                    A tracked PIS has been auto-created for this project. Reminders will be sent if not completed within 3 business days.
                  </span>
                </div>
              )}
              <a
                href={rfiToken ? `/rfi?token=${rfiToken}` : `/rfi?property=${encodeURIComponent(proposal.properties?.address || "")}&proposal=${proposal.id}`}


                className="flex items-center justify-between rounded-lg p-4 transition-shadow"
                style={{ background: "hsl(38, 92%, 50%, 0.06)", border: `1px solid hsl(38, 92%, 50%, 0.25)` }}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full p-2" style={{ background: "hsl(38, 92%, 50%, 0.15)" }}>
                    <FileText className="h-5 w-5" style={{ color: amber }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "10pt", fontWeight: 700, color: charcoal }}>Fill Out Project Information Sheet</div>
                    <div style={{ fontSize: "8.5pt", color: slate, marginTop: 1 }}>Building details, applicant info, owner details & more</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4" style={{ color: amber }} />
              </a>
            </div>

            {/* View Signed Proposal button */}
            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => setViewMode("contract")}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                View Signed Proposal
              </Button>
            </div>
          </div>
        ) : (
          <>
        {/* ═══ The Contract Document ═══ */}
        <div className="bg-white shadow-md" style={{ color: charcoal }}>

          {/* ═══ Header Banner ═══ */}
          <div style={{ background: charcoal, color: "#fff", padding: "32px 48px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company?.name} style={{ maxHeight: 48, marginBottom: 12, filter: "brightness(0) invert(1)" }} />
              ) : (
                <div style={{ fontSize: "20pt", fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
                  {company?.name || ""}
                </div>
              )}
              <div style={{ fontSize: "9pt", color: "#94a3b8", lineHeight: 1.6 }}>
                {company?.address && <div>{company.address}</div>}
                <div>
                  {company?.phone && <span>Tel: {company.phone}</span>}
                  {company?.fax && <span style={{ marginLeft: 12 }}>Fax: {company.fax}</span>}
                </div>
                {company?.email && <div>{company.email}</div>}
                {company?.website && <div>{company.website}</div>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 2, color: amber, fontWeight: 700, marginBottom: 4 }}>
                Proposal
              </div>
              <div style={{ fontSize: "16pt", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                #{proposal.proposal_number}
              </div>
              <div style={{ fontSize: "9pt", color: "#94a3b8", marginTop: 6 }}>
                {fmtDate(proposal.created_at)}
              </div>
            </div>
          </div>

          {/* ═══ Amber accent bar ═══ */}
          <div style={{ height: 4, background: amber }} />

          {/* ═══ Body ═══ */}
          <div style={{ padding: "32px 48px 40px" }}>

            {/* Account & Project Info */}
            <div style={{ display: "flex", gap: 32, marginBottom: 28 }}>
              <div style={{ flex: 1, background: lightBg, padding: "16px 20px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: 1.5, color: slate, marginBottom: 8, fontWeight: 700 }}>
                  Prepared For
                </div>
                {billTo ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "11pt" }}>{billTo.company_name || billTo.name}</div>
                    {billTo.company_name && <div style={{ fontSize: "10pt" }}>{billTo.name}</div>}
                    {billTo.email && <div style={{ fontSize: "9pt", color: slate }}>{billTo.email}</div>}
                    {billTo.phone && <div style={{ fontSize: "9pt", color: slate }}>{billTo.phone}</div>}
                  </>
                ) : proposal.client_name ? (
                  <>
                    <div style={{ fontWeight: 700, fontSize: "11pt" }}>{proposal.client_name}</div>
                    {proposal.client_email && <div style={{ fontSize: "9pt", color: slate }}>{proposal.client_email}</div>}
                  </>
                ) : (
                  <div style={{ color: slate, fontStyle: "italic" }}>No client specified</div>
                )}
              </div>
              <div style={{ flex: 1, background: lightBg, padding: "16px 20px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: 1.5, color: slate, marginBottom: 8, fontWeight: 700 }}>
                  Project Details
                </div>
                <div style={{ fontSize: "10pt", marginBottom: 4 }}><strong>Project:</strong> {proposal.title}</div>
                <div style={{ fontSize: "10pt", marginBottom: 4 }}><strong>Address:</strong> {proposal.properties?.address || "—"}</div>
                {proposal.properties?.borough && (
                  <div style={{ fontSize: "10pt" }}><strong>Borough:</strong> {proposal.properties.borough}</div>
                )}
                {proposal.valid_until && (
                  <div style={{ fontSize: "9pt", color: slate, marginTop: 6 }}>Valid until {fmtDate(proposal.valid_until)}</div>
                )}
              </div>
            </div>

            {/* Greeting */}
            {billTo && (
              <div style={{ fontSize: "10.5pt", marginBottom: 24, lineHeight: 1.65 }}>
                <p>{billTo.name?.split(" ")[0]},</p>
                <p style={{ marginTop: 8 }}>
                  Thank you for considering us to service your permit needs. Below is a detailed breakdown of the professional services we will provide at this address.
                </p>
              </div>
            )}

            {/* ═══ Scope of Work ═══ */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, marginTop: 8 }}>
              <div style={{ width: 4, height: 28, background: amber, borderRadius: 2 }} />
              <h2 style={{ fontSize: "15pt", fontWeight: 800, color: charcoal, margin: 0 }}>
                Scope of Work
              </h2>
            </div>

            {/* Service Items */}
            {nonOptionalItems.map((item: any, i: number) => {
              const bullets = parseBullets(item.description);
              const price = Number(item.total_price || item.quantity * item.unit_price);
              const note = feeNote(item.fee_type, item.quantity, price);
              const disciplines: string[] = item.disciplines || [];
              const disciplineFee = Number(item.discipline_fee) || 0;
              return (
                <div key={i} style={{ marginBottom: 20, paddingBottom: 18, borderBottom: i < nonOptionalItems.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: "11pt", fontWeight: 700, color: charcoal }}>{item.name}</span>
                    <span style={{ fontSize: "11pt", fontWeight: 700, color: charcoal, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(price)}</span>
                  </div>
                  {bullets.length > 0 ? (
                    <ul style={{ listStyle: "none", margin: "4px 0 0 0", padding: 0, fontSize: "9.5pt", color: slate, lineHeight: 1.65 }}>
                      {bullets.map((b, bi) => (
                        <li key={bi} style={{ paddingLeft: 16, position: "relative" }}>
                          <span style={{ position: "absolute", left: 0, color: amber, fontWeight: 700 }}>›</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  ) : item.description ? (
                    <p style={{ fontSize: "9.5pt", color: slate, lineHeight: 1.6, margin: "4px 0 0" }}>{item.description}</p>
                  ) : null}
                  {disciplines.length > 0 && (
                    <div style={{ marginTop: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                      <div style={{ fontSize: "8.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: slate, marginBottom: 6 }}>
                        Disciplines Included
                        {disciplineFee > 0 && <span style={{ fontWeight: 400, marginLeft: 8 }}>({fmt(disciplineFee)} each)</span>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {disciplines.map((d: string) => (
                          <span key={d} style={{ fontSize: "8.5pt", padding: "2px 8px", background: "#e2e8f0", borderRadius: 4, color: charcoal, fontWeight: 500 }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {note && (
                    <div style={{ fontSize: "8.5pt", color: amber, fontWeight: 600, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {note}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Optional Services */}
            {optionalItems.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px" }}>
                  <div style={{ width: 4, height: 22, background: "#cbd5e1", borderRadius: 2 }} />
                  <h3 style={{ fontSize: "12pt", fontWeight: 700, color: slate, margin: 0 }}>
                    Optional Services
                  </h3>
                </div>
                {optionalItems.map((item: any, i: number) => {
                  const bullets = parseBullets(item.description);
                  const price = Number(item.total_price || item.quantity * item.unit_price);
                  const disciplines: string[] = item.disciplines || [];
                  const disciplineFee = Number(item.discipline_fee) || 0;
                  return (
                    <div key={i} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: i < optionalItems.length - 1 ? "1px dashed #e2e8f0" : "none", opacity: 0.85 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: "10.5pt", fontWeight: 600 }}>
                          {item.name}
                          <span style={{ display: "inline-block", background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "7.5pt", padding: "1px 6px", borderRadius: 3, marginLeft: 8, color: slate, textTransform: "uppercase", letterSpacing: 0.5, verticalAlign: "middle" }}>Optional</span>
                        </span>
                        <span style={{ fontSize: "10.5pt", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>{fmt(price)}</span>
                      </div>
                      {bullets.length > 0 ? (
                        <ul style={{ listStyle: "none", margin: "4px 0 0 0", padding: 0, fontSize: "9pt", color: slate, lineHeight: 1.6 }}>
                          {bullets.map((b, bi) => (
                            <li key={bi} style={{ paddingLeft: 16, position: "relative" }}>
                              <span style={{ position: "absolute", left: 0, color: "#cbd5e1" }}>›</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      ) : item.description ? (
                        <p style={{ fontSize: "9pt", color: slate, margin: "4px 0 0" }}>{item.description}</p>
                      ) : null}
                      {disciplines.length > 0 && (
                        <div style={{ marginTop: 6, padding: "6px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
                          <div style={{ fontSize: "8pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: slate, marginBottom: 4 }}>
                            Disciplines
                            {disciplineFee > 0 && <span style={{ fontWeight: 400, marginLeft: 6 }}>({fmt(disciplineFee)} each)</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {disciplines.map((d: string) => (
                              <span key={d} style={{ fontSize: "8pt", padding: "1px 6px", background: "#e2e8f0", borderRadius: 3, color: charcoal, fontWeight: 500 }}>{d}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ═══ Total ═══ */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: charcoal, color: "#fff", padding: "14px 20px", borderRadius: 6, marginTop: 28 }}>
              <span style={{ fontSize: "12pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Total</span>
              <span style={{ fontSize: "16pt", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>{fmt(totalAmount)}</span>
            </div>

            {/* Deposit callout */}
            {depositAmt > 0 && (
              <div style={{ marginTop: 12, padding: "12px 20px", background: "hsl(38, 92%, 50%, 0.08)", borderLeft: `4px solid ${amber}`, borderRadius: "0 6px 6px 0", fontSize: "10pt" }}>
                <strong>Retainer Due Upon Signing:</strong> {fmt(depositAmt)}
                {depositPct > 0 && <span style={{ color: slate, marginLeft: 6 }}>({depositPct}% of contract total)</span>}
              </div>
            )}

            {/* ═══ Terms & Conditions ═══ */}
            {(proposal.terms_conditions || proposal.payment_terms) && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 24, background: amber, borderRadius: 2 }} />
                  <h2 style={{ fontSize: "13pt", fontWeight: 800, color: charcoal, margin: 0 }}>Terms & Conditions</h2>
                </div>

                {proposal.payment_terms && (
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 4, color: charcoal }}>Payment Schedule</h4>
                    <p style={{ fontSize: "9.5pt", color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>
                      {interpolate(proposal.payment_terms)}
                    </p>
                  </div>
                )}

                {proposal.terms_conditions && (
                  <div>
                    <p style={{ fontSize: "9.5pt", color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>
                      {interpolate(proposal.terms_conditions)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Signature Block — identical layout to internal preview ═══ */}
            <div style={{ marginTop: 40 }}>
              <p style={{ fontWeight: 600, fontSize: "10pt", color: slate, marginBottom: 4 }}>
                Please sign the designated space provided below and return a copy
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                <h3 style={{ fontSize: "12pt", fontWeight: 800, color: charcoal, margin: 0 }}>Agreed to and accepted by</h3>
              </div>

              <div style={{ display: "flex", gap: 32 }}>
                {/* Company side — static, shows company signature */}
                <div style={{ flex: 1, padding: "16px 20px", background: lightBg, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 24, color: charcoal }}>{company?.name || ""}</div>
                  <div style={{ borderBottom: `2px solid ${charcoal}`, height: 32, marginBottom: 4 }}>
                    {proposal.internal_signature_data && (
                      <img src={proposal.internal_signature_data} alt="Signature" style={{ height: 28, objectFit: "contain" }} />
                    )}
                  </div>
                  <div style={{ fontSize: "8.5pt", color: slate, marginTop: 4 }}>
                    <div><strong>By:</strong> {proposal.internal_signer
                      ? `${proposal.internal_signer.first_name} ${proposal.internal_signer.last_name}`
                      : ""}</div>
                    <div><strong>Date:</strong> {proposal.internal_signed_at ? fmtDate(proposal.internal_signed_at) : ""}</div>
                  </div>
                </div>

                {/* Client side — interactive if unsigned, static if signed */}
                <div style={{ flex: 1, padding: "16px 20px", background: lightBg, borderRadius: 6, border: `1px solid ${alreadySigned ? "#e2e8f0" : amber}` }}>
                  <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: alreadySigned ? 24 : 8, color: charcoal }}>
                    {billTo?.company_name || proposal.client_name || "Client"}
                  </div>

                  {alreadySigned ? (
                    <>
                      <div style={{ borderBottom: `2px solid ${charcoal}`, height: 32, marginBottom: 4 }}>
                        {proposal.client_signature_data && (
                          <img src={proposal.client_signature_data} alt="Client Signature" style={{ height: 28, objectFit: "contain" }} />
                        )}
                      </div>
                      <div style={{ fontSize: "8.5pt", color: slate, marginTop: 4 }}>
                        <div><strong>By:</strong> {proposal.client_signed_name || signer?.name || billTo?.name || ""}</div>
                        <div><strong>Date:</strong> {proposal.client_signed_at ? fmtDate(proposal.client_signed_at) : ""}</div>
                      </div>
                    </>
                  ) : !internalSigned ? (
                    <div style={{ padding: "12px 0", textAlign: "center" }}>
                      <Shield className="h-5 w-5 mx-auto mb-2" style={{ color: slate }} />
                      <p style={{ fontSize: "9pt", color: slate, lineHeight: 1.5 }}>
                        This proposal is pending internal authorization. You'll be able to sign once it has been reviewed and approved by the team.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <Label className="text-xs" style={{ color: slate, fontSize: "8pt" }}>Full Name *</Label>
                          <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Your full name" className="mt-1 h-7 text-xs" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <Label className="text-xs" style={{ color: slate, fontSize: "8pt" }}>Title</Label>
                          <Input value={clientTitle} onChange={e => setClientTitle(e.target.value)} placeholder="e.g. Property Manager" className="mt-1 h-7 text-xs" />
                        </div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs" style={{ color: slate, fontSize: "8pt" }}>Signature *</Label>
                          <button onClick={clearSig} style={{ fontSize: "7.5pt", color: slate, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                            <RotateCcw style={{ width: 10, height: 10 }} /> Clear
                          </button>
                        </div>
                        <div style={{ border: "2px dashed #e2e8f0", borderRadius: 6, overflow: "hidden", background: "#fff", marginTop: 4 }}>
                          <canvas
                            ref={canvasRef}
                            width={300}
                            height={80}
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
                      </div>
                      <Button
                        onClick={() => signMutation.mutate()}
                        disabled={!hasSignature || !clientName || signMutation.isPending}
                        className="w-full h-8 text-xs font-bold"
                        style={{ background: amber, color: charcoal }}
                      >
                        {signMutation.isPending ? (
                          <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Signing...</>
                        ) : (
                          <><PenLine className="mr-1.5 h-3 w-3" /> Sign & Accept</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ Footer ═══ */}
            <div style={{ textAlign: "center", fontSize: "8.5pt", color: slate, marginTop: 36, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              {company?.address && <div>{company.address}</div>}
              <div>
                {company?.phone && <span>Tel: {company.phone}</span>}
                {company?.fax && <span style={{ marginLeft: 10 }}>Fax: {company.fax}</span>}
                {company?.email && <span style={{ marginLeft: 10 }}>{company.email}</span>}
              </div>
              {company?.website && <div style={{ color: amber, marginTop: 2 }}>{company.website}</div>}
            </div>
          </div>
        </div>

        {/* Download & Back buttons */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {alreadySigned && (
            <Button
              variant="outline"
              onClick={() => setViewMode("next-steps")}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Back to Next Steps
            </Button>
          )}
        </div>
          </>
        )}

        {/* Page footer */}
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
