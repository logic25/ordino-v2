import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric" });
  };

  const billToContact = contacts.find(c => c.role === "bill_to");
  const signerContact = contacts.find(c => c.role === "sign");

  const handlePrint = () => {
    const printContent = document.getElementById("proposal-preview-content");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>${proposal.proposal_number} — ${proposal.title}</title>
      <style>
        @page { margin: 40px 50px 60px 50px; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; font-size: 13px; line-height: 1.5; }
        .proposal-header { margin-bottom: 30px; }
        .proposal-header h1 { font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
        .proposal-header .subtitle { font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-top: 2px; }
        .company-info { font-size: 12px; color: #444; margin-top: 8px; }
        .account-box { border: 1px solid #ddd; padding: 16px 20px; margin: 24px 0; }
        .account-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
        .account-box strong { display: block; }
        .project-meta { margin: 16px 0; }
        .project-meta strong { font-weight: 600; }
        .greeting { margin: 20px 0; }
        .scope-title { font-size: 18px; font-weight: 700; margin: 28px 0 16px; }
        .service-item { margin-bottom: 20px; }
        .service-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 8px; }
        .service-header h3 { font-size: 14px; font-weight: 700; margin: 0; }
        .service-header .price { font-size: 14px; font-weight: 700; }
        .service-desc { font-size: 12px; color: #444; margin-bottom: 6px; }
        .service-bullets { list-style: disc; margin: 4px 0 4px 20px; padding: 0; font-size: 12px; color: #444; }
        .service-bullets li { margin-bottom: 3px; }
        .service-note { font-size: 11px; color: #666; font-style: italic; margin-top: 6px; }
        .fee-label { font-size: 11px; color: #888; margin-top: 2px; }
        .total-row { display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid #333; padding-top: 10px; margin-top: 28px; font-size: 16px; font-weight: 800; }
        .section-title { font-size: 16px; font-weight: 700; margin: 32px 0 8px; }
        .terms-text { font-size: 12px; color: #444; white-space: pre-wrap; line-height: 1.6; }
        .terms-subsection { margin: 16px 0; }
        .terms-subsection h4 { font-size: 13px; font-weight: 700; margin: 0 0 6px; }
        .signature-section { margin-top: 40px; }
        .sig-prompt { font-weight: 700; margin-bottom: 20px; }
        .sig-grid { display: flex; gap: 40px; }
        .sig-block { flex: 1; }
        .sig-block .company-name { font-size: 13px; margin-bottom: 30px; }
        .sig-line { border-bottom: 1px solid #333; margin-bottom: 4px; height: 30px; }
        .sig-label { font-size: 11px; color: #666; display: flex; gap: 8px; }
        .sig-label span { min-width: 30px; }
        .page-footer { text-align: center; font-size: 11px; color: #888; font-style: italic; margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; }
        .optional-badge { display: inline-block; background: #f5f5f5; border: 1px solid #ddd; font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-left: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
      </style></head><body>
    `);
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  // Parse description into bullet points if it contains line breaks or bullet chars
  const parseDescriptionBullets = (desc: string | null | undefined): string[] => {
    if (!desc) return [];
    return desc.split(/\n|•|·|-\s/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  };

  const feeTypeLabel = (feeType: string | undefined) => {
    if (feeType === "monthly") return "Monthly retainer";
    if (feeType === "hourly") return "Hourly rate";
    return "One-time fee";
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

        {/* Scrollable preview — styled to match GLE PDF */}
        <div className="flex-1 overflow-y-auto bg-muted/40">
          <div id="proposal-preview-content" className="max-w-[720px] mx-auto bg-background shadow-sm my-6 border" style={{ padding: "50px 56px 40px" }}>

            {/* ── Company Header ── */}
            <div className="proposal-header" style={{ marginBottom: 28 }}>
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company.name} style={{ maxHeight: 60, marginBottom: 12 }} />
              ) : (
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, margin: 0, color: "hsl(var(--foreground))" }}>
                  {company?.name || "Your Company"}
                </h1>
              )}
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 6, lineHeight: 1.6 }}>
                {company?.address && <div>{company.address}</div>}
                <div>
                  {company?.phone && <span>Tel: {company.phone}</span>}
                  {company?.fax && <span style={{ marginLeft: 12 }}>Fax: {company.fax}</span>}
                </div>
                {company?.email && <div>Email: {company.email}</div>}
              </div>
            </div>

            {/* ── Account Details Box ── */}
            <div style={{ border: "1px solid hsl(var(--border))", padding: "16px 20px", marginBottom: 24 }}>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
                Account Details
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  {billToContact ? (
                    <>
                      <div style={{ fontWeight: 700 }}>{billToContact.company_name || ""}</div>
                      <div>{billToContact.name}</div>
                      {billToContact.email && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{billToContact.email}</div>}
                      {billToContact.phone && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{billToContact.phone}</div>}
                    </>
                  ) : proposal.client_name ? (
                    <>
                      <div style={{ fontWeight: 700 }}>{proposal.client_name}</div>
                      {proposal.client_email && <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{proposal.client_email}</div>}
                    </>
                  ) : (
                    <div style={{ color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>No client specified</div>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: 13 }}>
                  {formatDate(proposal.created_at)}
                </div>
              </div>
              {/* Billed To if different */}
              {billToContact && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid hsl(var(--border))" }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>Billed to: {billToContact.company_name || billToContact.name}</div>
                  <div style={{ fontSize: 12 }}>{billToContact.name}</div>
                </div>
              )}
            </div>

            {/* ── Project Meta ── */}
            <div style={{ marginBottom: 20, fontSize: 13 }}>
              <div><strong>Project name:</strong> {proposal.title}</div>
              <div><strong>Project address:</strong> {proposal.properties?.address || "—"}</div>
            </div>

            {/* ── Greeting ── */}
            {billToContact && (
              <div style={{ marginBottom: 20, fontSize: 13 }}>
                <p>{billToContact.name?.split(" ")[0]},</p>
                <p style={{ marginTop: 6 }}>
                  Thank you for considering us to service your permit needs. Below you will find the list of services we will be providing you at this address.
                </p>
              </div>
            )}

            {/* ── Scope of Work ── */}
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "28px 0 20px", color: "hsl(var(--foreground))" }}>
              Scope of work :
            </h2>

            {/* ── Service Items — GLE style ── */}
            {nonOptionalItems.map((item: any, i: number) => {
              const bullets = parseDescriptionBullets(item.description);
              const price = Number(item.total_price || item.quantity * item.unit_price);
              const feeType = item.fee_type;
              return (
                <div key={i} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid hsl(var(--border))", paddingBottom: 6, marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "hsl(var(--foreground))" }}>{item.name}</h3>
                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", color: "hsl(var(--foreground))" }}>{formatCurrency(price)}</span>
                  </div>
                  {bullets.length > 0 ? (
                    <ul style={{ listStyle: "disc", margin: "4px 0 4px 20px", padding: 0, fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}>
                      {bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                    </ul>
                  ) : item.description ? (
                    <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>{item.description}</p>
                  ) : null}
                  {feeType && feeType !== "fixed" && (
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                      {feeTypeLabel(feeType)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Optional Services ── */}
            {optionalItems.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 24, marginBottom: 12, color: "hsl(var(--muted-foreground))" }}>
                  Optional Services
                </h3>
                {optionalItems.map((item: any, i: number) => {
                  const bullets = parseDescriptionBullets(item.description);
                  const price = Number(item.total_price || item.quantity * item.unit_price);
                  return (
                    <div key={i} style={{ marginBottom: 20, opacity: 0.8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px dashed hsl(var(--border))", paddingBottom: 6, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{item.name}<span style={{ display: "inline-block", background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))", fontSize: 10, padding: "1px 6px", borderRadius: 3, marginLeft: 8, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: 0.5 }}>Optional</span></h3>
                        <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{formatCurrency(price)}</span>
                      </div>
                      {bullets.length > 0 ? (
                        <ul style={{ listStyle: "disc", margin: "4px 0 4px 20px", padding: 0, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                          {bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                        </ul>
                      ) : item.description ? (
                        <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{item.description}</p>
                      ) : null}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Total ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "2px solid hsl(var(--foreground))", paddingTop: 12, marginTop: 32 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Total:</span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{formatCurrency(Number(proposal.total_amount || proposal.subtotal || 0))}</span>
            </div>

            {/* ── Terms & Conditions ── */}
            {((proposal as any).terms_conditions || proposal.payment_terms) && (
              <div style={{ marginTop: 36 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: "hsl(var(--foreground))" }}>
                  Terms & Conditions:
                </h2>
                <Separator className="mb-4" />

                {proposal.payment_terms && (
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Payment Terms:</h4>
                    <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {proposal.payment_terms}
                    </p>
                  </div>
                )}

                {(proposal as any).terms_conditions && (
                  <div>
                    <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {(proposal as any).terms_conditions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Deposit / Retainer callout ── */}
            {(proposal.deposit_required || proposal.deposit_percentage) && (
              <div style={{ marginTop: 20, padding: "12px 16px", border: "1px solid hsl(var(--border))", background: "hsl(var(--muted))", borderRadius: 4, fontSize: 13 }}>
                <strong>Deposit Required:</strong> {formatCurrency(Number(proposal.deposit_required || 0))}
                {proposal.deposit_percentage && <span style={{ marginLeft: 8, color: "hsl(var(--muted-foreground))" }}>({proposal.deposit_percentage}% of total)</span>}
              </div>
            )}

            {/* ── Signature Block — dual column like GLE ── */}
            <div style={{ marginTop: 44 }}>
              <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                Please sign the designated space provided below and email or fax us a copy
              </p>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20 }}>Agreed to and accepted by:</h3>

              <div style={{ display: "flex", gap: 40 }}>
                {/* Company side */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, marginBottom: 28 }}>{company?.name || "Your Company"}</div>
                  <div style={{ borderBottom: "1px solid hsl(var(--foreground))", height: 30, marginBottom: 4 }}>
                    {proposal.internal_signature_data && (
                      <img src={proposal.internal_signature_data} alt="Signature" style={{ height: 28, objectFit: "contain" }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8 }}>
                    <span>By:</span>
                    <span>{proposal.internal_signer ? `${proposal.internal_signer.first_name} ${proposal.internal_signer.last_name}` : ""}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8, marginTop: 4 }}>
                    <span>Title:</span><span></span>
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8, marginTop: 4 }}>
                    <span>Date:</span><span>{proposal.internal_signed_at ? formatDate(proposal.internal_signed_at) : ""}</span>
                  </div>
                </div>

                {/* Client side */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, marginBottom: 28 }}>
                    {billToContact?.company_name || proposal.client_name || "Client"}
                  </div>
                  <div style={{ borderBottom: "1px solid hsl(var(--foreground))", height: 30, marginBottom: 4 }} />
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8 }}>
                    <span>By:</span>
                    <span>{signerContact?.name || billToContact?.name || ""}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8, marginTop: 4 }}>
                    <span>Title:</span><span></span>
                  </div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", display: "flex", gap: 8, marginTop: 4 }}>
                    <span>Date:</span><span></span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Page Footer ── */}
            <div style={{ textAlign: "center", fontSize: 11, color: "hsl(var(--muted-foreground))", fontStyle: "italic", marginTop: 40, paddingTop: 12, borderTop: "1px solid hsl(var(--border))" }}>
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
