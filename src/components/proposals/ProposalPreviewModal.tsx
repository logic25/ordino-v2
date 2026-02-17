import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, X, Printer } from "lucide-react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { useProposalContacts } from "@/hooks/useProposalContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ProposalPreviewModalProps {
  proposal: ProposalWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend?: (id: string) => void;
}

function useCompanyInfo() {
  return useQuery({
    queryKey: ["company-info-preview"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).single();
      if (!profile?.company_id) return null;
      const { data: companyRow } = await supabase.from("companies").select("name, address, phone, email, settings").eq("id", profile.company_id).single();
      if (!companyRow) return null;
      const settings = (companyRow.settings || {}) as any;
      return {
        name: companyRow.name,
        address: settings.company_address || companyRow.address || "",
        phone: settings.company_phone || companyRow.phone || "",
        fax: settings.company_fax || "",
        email: settings.company_email || companyRow.email || "",
        website: settings.company_website || "",
        logo_url: settings.company_logo_url || "",
      };
    },
  });
}

export function ProposalPreviewModal({ proposal, open, onOpenChange, onSend }: ProposalPreviewModalProps) {
  const { data: company } = useCompanyInfo();
  const { data: contacts = [] } = useProposalContacts(proposal?.id);

  if (!proposal) return null;

  const items = proposal.items || [];
  const nonOptionalItems = items.filter((i: any) => !i.is_optional);
  const optionalItems = items.filter((i: any) => i.is_optional);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
  };

  const billToContact = contacts.find(c => c.role === "bill_to");
  const signerContact = contacts.find(c => c.role === "sign");

  // Calculate retainer/deposit in actual dollars
  const totalAmount = Number(proposal.total_amount || proposal.subtotal || 0);
  const depositPct = Number(proposal.deposit_percentage || 0);
  const depositAmount = Number(proposal.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);

  // Interpolate template variables in payment terms
  const interpolateTerms = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
      .replace(/\$\{retainer_amount\}|\$\{deposit_amount\}/gi, formatCurrency(depositAmount))
      .replace(/\$\{total_amount\}/gi, formatCurrency(totalAmount))
      .replace(/\$\{deposit_percentage\}/gi, `${depositPct}%`)
      .replace(/\$\{company_name\}/gi, company?.name || "")
      .replace(/\$\{client_name\}/gi, billToContact?.company_name || proposal.client_name || "Client");
  };

  const handlePrint = () => {
    const printContent = document.getElementById("proposal-preview-content");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${proposal.proposal_number} — ${proposal.title}</title>
      <style>
        @page { margin: 0.6in 0.7in; }
        * { box-sizing: border-box; }
        body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a1a; max-width: 700px; margin: 0 auto; font-size: 11pt; line-height: 1.55; }
        h1 { font-family: system-ui, -apple-system, sans-serif; }
        .proposal-ref { font-family: system-ui, sans-serif; font-size: 10pt; color: #666; margin-bottom: 4px; }
        .company-header { margin-bottom: 24px; }
        .company-name { font-family: system-ui, -apple-system, sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .company-info { font-size: 9pt; color: #555; margin-top: 6px; line-height: 1.5; }
        .account-box { border: 1.5px solid #222; padding: 14px 18px; margin: 20px 0; }
        .account-label { font-family: system-ui, sans-serif; font-size: 9pt; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 600; }
        .account-name { font-weight: 700; font-size: 11pt; }
        .account-detail { font-size: 10pt; color: #444; }
        .billed-to { margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10pt; }
        .project-meta { margin: 16px 0 20px; font-size: 10.5pt; }
        .project-meta strong { font-weight: 700; }
        .greeting { margin: 16px 0 24px; font-size: 10.5pt; }
        .scope-heading { font-family: system-ui, -apple-system, sans-serif; font-size: 16pt; font-weight: 800; margin: 28px 0 18px; border-bottom: 2px solid #222; padding-bottom: 6px; }
        .service-block { margin-bottom: 22px; page-break-inside: avoid; }
        .service-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
        .service-name { font-family: system-ui, sans-serif; font-size: 11pt; font-weight: 700; }
        .service-price { font-family: system-ui, sans-serif; font-size: 11pt; font-weight: 700; white-space: nowrap; }
        .service-desc { font-size: 10pt; color: #444; margin-bottom: 4px; }
        .service-bullets { list-style: disc; margin: 2px 0 4px 18px; padding: 0; font-size: 10pt; color: #444; line-height: 1.6; }
        .service-bullets li { margin-bottom: 2px; }
        .service-note { font-size: 9pt; color: #666; font-style: italic; margin-top: 4px; }
        .fee-label { font-size: 9pt; color: #888; font-style: italic; }
        .optional-heading { font-family: system-ui, sans-serif; font-size: 12pt; font-weight: 700; color: #666; margin: 28px 0 14px; border-bottom: 1px dashed #ccc; padding-bottom: 4px; }
        .optional-badge { display: inline-block; font-family: system-ui, sans-serif; background: #f0f0f0; border: 1px solid #ddd; font-size: 8pt; padding: 1px 6px; border-radius: 3px; margin-left: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle; }
        .total-row { display: flex; justify-content: space-between; align-items: baseline; border-top: 3px solid #222; padding-top: 12px; margin-top: 32px; }
        .total-label { font-family: system-ui, sans-serif; font-size: 14pt; font-weight: 800; }
        .total-amount { font-family: system-ui, sans-serif; font-size: 14pt; font-weight: 800; }
        .section-heading { font-family: system-ui, -apple-system, sans-serif; font-size: 14pt; font-weight: 800; margin: 32px 0 6px; border-bottom: 2px solid #222; padding-bottom: 4px; }
        .subsection-heading { font-family: system-ui, sans-serif; font-size: 11pt; font-weight: 700; margin: 16px 0 4px; }
        .terms-text { font-size: 10pt; color: #333; white-space: pre-wrap; line-height: 1.65; }
        .deposit-callout { margin-top: 16px; padding: 12px 16px; border-left: 4px solid #222; background: #f8f8f6; font-size: 10.5pt; }
        .deposit-callout strong { font-weight: 700; }
        .sig-section { margin-top: 44px; page-break-inside: avoid; }
        .sig-prompt { font-weight: 700; font-size: 10.5pt; margin-bottom: 4px; }
        .sig-accepted { font-family: system-ui, sans-serif; font-size: 12pt; font-weight: 800; margin-bottom: 20px; }
        .sig-grid { display: flex; gap: 36px; }
        .sig-col { flex: 1; }
        .sig-company { font-size: 10.5pt; margin-bottom: 28px; font-weight: 600; }
        .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 3px; }
        .sig-field { font-size: 9pt; color: #666; display: flex; gap: 6px; margin-top: 3px; }
        .page-footer { text-align: center; font-size: 9pt; color: #888; margin-top: 36px; padding-top: 10px; border-top: 1px solid #ddd; }
      </style></head><body>
    `);
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  const parseDescriptionBullets = (desc: string | null | undefined): string[] => {
    if (!desc) return [];
    return desc.split(/\n|•|·/)
      .map(s => s.replace(/^-\s*/, '').trim())
      .filter(s => s.length > 0);
  };

  const feeTypeLabel = (feeType: string | undefined, qty: number, price: number) => {
    if (feeType === "monthly") return `Monthly retainer${qty > 1 ? ` — Total: ${formatCurrency(price)} over estimated ${qty}-month timeline` : ""}`;
    if (feeType === "hourly") return `Hourly rate × ${qty} hrs`;
    return "";
  };

  // Inline styles using CSS custom props from the design system
  const s = {
    serif: "'Georgia', 'Times New Roman', serif",
    sans: "system-ui, -apple-system, sans-serif",
    fg: "hsl(var(--foreground))",
    muted: "hsl(var(--muted-foreground))",
    border: "hsl(var(--border))",
    bg: "hsl(var(--background))",
    mutedBg: "hsl(var(--muted))",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden">
        {/* Sticky toolbar */}
        <div className="px-6 py-3 border-b flex items-center justify-between bg-background shrink-0">
          <div className="flex items-center gap-3">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Proposal {proposal.proposal_number}
              </DialogTitle>
            </DialogHeader>
            <span className="text-sm text-muted-foreground">RE: {proposal.properties?.address || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" /> Print / PDF
            </Button>
            {onSend && (proposal.status === "draft" || !proposal.status) && (
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => { onSend(proposal.id); onOpenChange(false); }}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto bg-muted/40">
          <div id="proposal-preview-content" className="max-w-[700px] mx-auto bg-background shadow-sm my-6 border" style={{ padding: "48px 54px 40px", fontFamily: s.serif, color: s.fg, fontSize: "11pt", lineHeight: 1.55 }}>

            {/* ── Proposal # & RE line ── */}
            <div style={{ fontFamily: s.sans, fontSize: "10pt", color: s.muted, marginBottom: 4 }}>
              Proposal #{proposal.proposal_number}
            </div>
            <div style={{ fontFamily: s.sans, fontSize: "10pt", color: s.muted, marginBottom: 20 }}>
              RE: {proposal.properties?.address || "—"}
            </div>

            {/* ── Company Header ── */}
            <div style={{ marginBottom: 24 }}>
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company.name} style={{ maxHeight: 56, marginBottom: 10 }} />
              ) : (
                <h1 style={{ fontFamily: s.sans, fontSize: "22pt", fontWeight: 800, letterSpacing: -0.5, margin: 0, color: s.fg }}>
                  {company?.name || "Your Company"}
                </h1>
              )}
              <div style={{ fontSize: "9pt", color: s.muted, marginTop: 6, lineHeight: 1.5 }}>
                {company?.address && <div>{company.address}</div>}
                <div>
                  {company?.phone && <span>Tel: {company.phone}</span>}
                  {company?.fax && <span style={{ marginLeft: 12 }}>Fax: {company.fax}</span>}
                </div>
                {company?.email && <div>Email: {company.email}</div>}
              </div>
            </div>

            {/* ── Account Details Box ── */}
            <div style={{ border: `1.5px solid ${s.fg}`, padding: "14px 18px", marginBottom: 22 }}>
              <div style={{ fontFamily: s.sans, fontSize: "9pt", textTransform: "uppercase", letterSpacing: 1.5, color: s.muted, marginBottom: 8, fontWeight: 600 }}>
                Account Details
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  {billToContact ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: "11pt" }}>{billToContact.company_name || ""}</div>
                      <div style={{ fontSize: "10.5pt" }}>{billToContact.name}</div>
                      {billToContact.email && <div style={{ fontSize: "9.5pt", color: s.muted }}>{billToContact.email}</div>}
                      {billToContact.phone && <div style={{ fontSize: "9.5pt", color: s.muted }}>{billToContact.phone}</div>}
                    </>
                  ) : proposal.client_name ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: "11pt" }}>{proposal.client_name}</div>
                      {proposal.client_email && <div style={{ fontSize: "9.5pt", color: s.muted }}>{proposal.client_email}</div>}
                    </>
                  ) : (
                    <div style={{ color: s.muted, fontStyle: "italic" }}>No client specified</div>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: "10pt", color: s.muted }}>
                  {formatDate(proposal.created_at)}
                </div>
              </div>
              {billToContact && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${s.border}`, fontSize: "10pt" }}>
                  <span style={{ fontWeight: 600 }}>Billed to:</span> {billToContact.company_name || billToContact.name}
                  <div>{billToContact.name}</div>
                </div>
              )}
            </div>

            {/* ── Project Meta ── */}
            <div style={{ marginBottom: 18, fontSize: "10.5pt" }}>
              <div><strong>Project name:</strong> {proposal.title}</div>
              <div><strong>Project address:</strong> {proposal.properties?.address || "—"}</div>
            </div>

            {/* ── Greeting ── */}
            {billToContact && (
              <div style={{ marginBottom: 24, fontSize: "10.5pt" }}>
                <p style={{ margin: 0 }}>{billToContact.name?.split(" ")[0]},</p>
                <p style={{ marginTop: 8 }}>
                  Thank you for considering us to service your permit needs. Below you will find the list of services we will be providing you at this address.
                </p>
              </div>
            )}

            {/* ── Scope of Work heading ── */}
            <h2 style={{ fontFamily: s.sans, fontSize: "16pt", fontWeight: 800, margin: "28px 0 18px", borderBottom: `2px solid ${s.fg}`, paddingBottom: 6, color: s.fg }}>
              Scope of work :
            </h2>

            {/* ── Itemized Services ── */}
            {nonOptionalItems.map((item: any, i: number) => {
              const bullets = parseDescriptionBullets(item.description);
              const price = Number(item.total_price || item.quantity * item.unit_price);
              const feeType = item.fee_type;
              const feeNote = feeTypeLabel(feeType, item.quantity, price);
              return (
                <div key={i} style={{ marginBottom: 22 }}>
                  {/* Service name + price on same line */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontFamily: s.sans, fontSize: "11pt", fontWeight: 700, color: s.fg }}>{item.name}</span>
                    <span style={{ fontFamily: s.sans, fontSize: "11pt", fontWeight: 700, whiteSpace: "nowrap", color: s.fg }}>{formatCurrency(price)}</span>
                  </div>
                  {/* Description as bullet list */}
                  {bullets.length > 0 ? (
                    <ul style={{ listStyle: "disc", margin: "2px 0 4px 18px", padding: 0, fontSize: "10pt", color: s.muted, lineHeight: 1.6 }}>
                      {bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                    </ul>
                  ) : item.description ? (
                    <p style={{ fontSize: "10pt", color: s.muted, lineHeight: 1.6, margin: "2px 0" }}>{item.description}</p>
                  ) : null}
                  {/* Fee type note (e.g. "Monthly retainer — Total: $36,000 over estimated 18-month timeline") */}
                  {feeNote && (
                    <div style={{ fontSize: "9pt", color: s.muted, fontStyle: "italic", marginTop: 4 }}>
                      {feeNote}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Optional Services ── */}
            {optionalItems.length > 0 && (
              <>
                <div style={{ fontFamily: s.sans, fontSize: "12pt", fontWeight: 700, color: s.muted, margin: "28px 0 14px", borderBottom: `1px dashed ${s.border}`, paddingBottom: 4 }}>
                  Optional Services
                </div>
                {optionalItems.map((item: any, i: number) => {
                  const bullets = parseDescriptionBullets(item.description);
                  const price = Number(item.total_price || item.quantity * item.unit_price);
                  return (
                    <div key={i} style={{ marginBottom: 20, opacity: 0.85 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontFamily: s.sans, fontSize: "10.5pt", fontWeight: 700 }}>
                          {item.name}
                          <span style={{ display: "inline-block", fontFamily: s.sans, background: s.mutedBg, border: `1px solid ${s.border}`, fontSize: "8pt", padding: "1px 6px", borderRadius: 3, marginLeft: 8, color: s.muted, textTransform: "uppercase", letterSpacing: 0.5, verticalAlign: "middle" }}>Optional</span>
                        </span>
                        <span style={{ fontFamily: s.sans, fontSize: "10.5pt", fontWeight: 700, whiteSpace: "nowrap" }}>{formatCurrency(price)}</span>
                      </div>
                      {bullets.length > 0 ? (
                        <ul style={{ listStyle: "disc", margin: "2px 0 4px 18px", padding: 0, fontSize: "10pt", color: s.muted }}>
                          {bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                        </ul>
                      ) : item.description ? (
                        <p style={{ fontSize: "10pt", color: s.muted, margin: "2px 0" }}>{item.description}</p>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Total ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `3px solid ${s.fg}`, paddingTop: 12, marginTop: 32 }}>
              <span style={{ fontFamily: s.sans, fontSize: "14pt", fontWeight: 800 }}>Total:</span>
              <span style={{ fontFamily: s.sans, fontSize: "14pt", fontWeight: 800 }}>{formatCurrency(totalAmount)}</span>
            </div>

            {/* ── Terms & Conditions ── */}
            {((proposal as any).terms_conditions || proposal.payment_terms || depositAmount > 0) && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontFamily: s.sans, fontSize: "14pt", fontWeight: 800, marginBottom: 6, borderBottom: `2px solid ${s.fg}`, paddingBottom: 4, color: s.fg }}>
                  Terms & Conditions:
                </h2>

                {/* Payment Schedule — with interpolated deposit amount */}
                {(proposal.payment_terms || depositAmount > 0) && (
                  <div style={{ marginTop: 14, marginBottom: 16 }}>
                    <h4 style={{ fontFamily: s.sans, fontSize: "11pt", fontWeight: 700, marginBottom: 4 }}>Payment Schedule:</h4>
                    {proposal.payment_terms ? (
                      <p style={{ fontSize: "10pt", color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>
                        {interpolateTerms(proposal.payment_terms)}
                      </p>
                    ) : depositAmount > 0 ? (
                      <p style={{ fontSize: "10pt", color: "#333", lineHeight: 1.65, margin: 0 }}>
                        {company?.name || "Company"} upon signing this agreement shall receive a {formatCurrency(depositAmount)} retainer
                        {depositPct > 0 ? ` (${depositPct}% of contract total)` : ""} to begin.
                        Invoice(s) will be sent to your office as each item is completed and are due within 30 days.
                      </p>
                    ) : null}
                  </div>
                )}

                {/* General T&C */}
                {(proposal as any).terms_conditions && (
                  <div>
                    <p style={{ fontSize: "10pt", color: "#333", whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>
                      {interpolateTerms((proposal as any).terms_conditions)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Signature Block — GLE style ── */}
            <div style={{ marginTop: 44 }}>
              <p style={{ fontWeight: 700, fontSize: "10.5pt", marginBottom: 4 }}>
                Please sign the designated space provided below and email or fax us a copy
              </p>
              <h3 style={{ fontFamily: s.sans, fontSize: "12pt", fontWeight: 800, marginBottom: 20 }}>Agreed to and accepted by:</h3>

              <div style={{ display: "flex", gap: 36 }}>
                {/* Company side */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10.5pt", marginBottom: 28, fontWeight: 600 }}>{company?.name || "Your Company"}</div>
                  <div style={{ borderBottom: `1px solid ${s.fg}`, height: 28, marginBottom: 3 }}>
                    {proposal.internal_signature_data && (
                      <img src={proposal.internal_signature_data} alt="Signature" style={{ height: 26, objectFit: "contain" }} />
                    )}
                  </div>
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>By:</span>
                    <span>{proposal.internal_signer ? `${proposal.internal_signer.first_name} ${proposal.internal_signer.last_name}` : ""}</span>
                  </div>
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>Title:</span><span></span>
                  </div>
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>Date:</span><span>{proposal.internal_signed_at ? formatDate(proposal.internal_signed_at) : ""}</span>
                  </div>
                </div>

                {/* Client side */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10.5pt", marginBottom: 28, fontWeight: 600 }}>
                    {billToContact?.company_name || proposal.client_name || "Client"}
                  </div>
                  <div style={{ borderBottom: `1px solid ${s.fg}`, height: 28, marginBottom: 3 }} />
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>By:</span>
                    <span>{signerContact?.name || billToContact?.name || ""}</span>
                  </div>
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>Title:</span><span></span>
                  </div>
                  <div style={{ fontSize: "9pt", color: s.muted, display: "flex", gap: 6, marginTop: 3 }}>
                    <span>Date:</span><span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Page Footer ── */}
            <div style={{ textAlign: "center", fontSize: "9pt", color: s.muted, marginTop: 36, paddingTop: 10, borderTop: `1px solid ${s.border}` }}>
              {company?.address && <div>{company.address}</div>}
              <div>
                {company?.phone && <span>Tel: {company.phone}</span>}
                {company?.fax && <span style={{ marginLeft: 8 }}>Fax: {company.fax}</span>}
                {company?.email && <span style={{ marginLeft: 8 }}>Email: {company.email}</span>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
