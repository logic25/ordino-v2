import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, X, Printer, Link2, Copy, CheckCircle2 } from "lucide-react";
import type { ProposalWithRelations } from "@/hooks/useProposals";
import { useProposalContacts } from "@/hooks/useProposalContacts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef } from "react";

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
      const { data: companyRow } = await supabase.from("companies").select("name, address, phone, email, website, logo_url, settings").eq("id", profile.company_id).single();
      if (!companyRow) return null;
      const settings = (companyRow.settings || {}) as any;
      return {
        name: companyRow.name,
        address: settings.company_address?.trim() || companyRow.address || "",
        phone: settings.company_phone?.trim() || companyRow.phone || "",
        fax: settings.company_fax?.trim() || "",
        email: settings.company_email?.trim() || companyRow.email || "",
        website: settings.company_website?.trim() || companyRow.website || "",
        logo_url: settings.company_logo_url?.trim() || companyRow.logo_url || "",
      };
    },
  });
}

export function ProposalPreviewModal({ proposal, open, onOpenChange, onSend }: ProposalPreviewModalProps) {
  const { data: company } = useCompanyInfo();
  const { data: contacts = [] } = useProposalContacts(proposal?.id);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch items separately since list query doesn't include them
  const { data: fetchedItems = [] } = useQuery({
    queryKey: ["proposal-items-preview", proposal?.id],
    queryFn: async () => {
      if (!proposal?.id) return [];
      const { data } = await supabase
        .from("proposal_items")
        .select("*")
        .eq("proposal_id", proposal.id)
        .order("sort_order");
      return data || [];
    },
    enabled: !!proposal?.id && open,
  });

  if (!proposal) return null;

  const items = (proposal.items && proposal.items.length > 0) ? proposal.items : fetchedItems;
  const nonOptionalItems = items.filter((i: any) => !i.is_optional);
  const optionalItems = items.filter((i: any) => i.is_optional);

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const billTo = contacts.find(c => c.role === "bill_to");
  const signer = contacts.find(c => c.role === "sign");

  const totalAmount = Number(proposal.total_amount || proposal.subtotal || 0);
  const depositPct = Number(proposal.deposit_percentage || 0);
  const depositAmt = Number(proposal.deposit_required || 0) || (depositPct > 0 ? totalAmount * (depositPct / 100) : 0);

  const interpolate = (text: string | null | undefined): string => {
    if (!text) return "";
    return text
      .replace(/\$[\{\[]retainer_amount[\}\]]|\$[\{\[]deposit_amount[\}\]]/gi, fmt(depositAmt))
      .replace(/\$[\{\[]total_amount[\}\]]/gi, fmt(totalAmount))
      .replace(/\$[\{\[]deposit_percentage[\}\]]/gi, `${depositPct}%`)
      .replace(/\$[\{\[]company_name[\}\]]/gi, company?.name || "")
      .replace(/\$[\{\[]client_name[\}\]]/gi, billTo?.company_name || proposal.client_name || "Client");
  };

  const clientLink = (proposal as any).public_token
    ? `${window.location.origin}/proposal/${(proposal as any).public_token}`
    : null;

  const copyLink = () => {
    if (clientLink) {
      navigator.clipboard.writeText(clientLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById("proposal-preview-content");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${proposal.proposal_number} — ${proposal.title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
@page { margin: 0.6in; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; font-size: 10pt; line-height: 1.55; }
</style></head><body>`);
    w.document.write(el.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    w.print();
  };

  const parseBullets = (desc: string | null | undefined): string[] => {
    if (!desc) return [];
    return desc.split(/\n|•|·/).map(s => s.replace(/^-\s*/, '').trim()).filter(s => s.length > 0);
  };

  const feeNote = (type: string | undefined, qty: number, price: number) => {
    if (type === "monthly") return `Monthly retainer${qty > 1 ? ` — ${fmt(price)} over estimated ${qty}-month timeline` : ""}`;
    if (type === "hourly") return `Hourly rate × ${qty} hrs`;
    return "";
  };

  // Amber accent from design system
  const amber = "hsl(38, 92%, 50%)";
  const charcoal = "#1c2127";
  const slate = "#64748b";
  const lightBg = "#f8f9fa";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 gap-0 [&>button:last-child]:hidden">
        {/* Toolbar */}
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
            {clientLink && (
              <Button variant="outline" size="sm" onClick={copyLink}>
                {linkCopied ? <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" /> : <Copy className="h-4 w-4 mr-1.5" />}
                {linkCopied ? "Copied!" : "Copy Link"}
              </Button>
            )}
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

        {/* Preview */}
        <div className="flex-1 overflow-y-auto bg-muted/40">
          <div id="proposal-preview-content" className="max-w-[720px] mx-auto bg-white shadow-md my-6" style={{ color: charcoal }}>

            {/* ═══ Header Banner ═══ */}
            <div style={{ background: charcoal, color: "#fff", padding: "32px 48px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                {company?.logo_url ? (
                  <img src={company.logo_url} alt={company.name} style={{ maxHeight: 48, marginBottom: 12, filter: "brightness(0) invert(1)" }} />
                ) : (
                  <div style={{ fontSize: "20pt", fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
                    {company?.name || "Your Company"}
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
              {((proposal as any).terms_conditions || proposal.payment_terms) && (
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

                  {(proposal as any).terms_conditions && (
                    <div>
                      <p style={{ fontSize: "9.5pt", color: "#475569", whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0 }}>
                        {interpolate((proposal as any).terms_conditions)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ Signature Block ═══ */}
              <div style={{ marginTop: 40 }}>
                <p style={{ fontWeight: 600, fontSize: "10pt", color: slate, marginBottom: 4 }}>
                  Please sign the designated space provided below and return a copy
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 4, height: 22, background: amber, borderRadius: 2 }} />
                  <h3 style={{ fontSize: "12pt", fontWeight: 800, color: charcoal, margin: 0 }}>Agreed to and accepted by</h3>
                </div>

                <div style={{ display: "flex", gap: 32 }}>
                  {/* Company */}
                  <div style={{ flex: 1, padding: "16px 20px", background: lightBg, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 24, color: charcoal }}>{company?.name || "Your Company"}</div>
                    <div style={{ borderBottom: `2px solid ${charcoal}`, height: 32, marginBottom: 4 }}>
                      {proposal.internal_signature_data && (
                        <img src={proposal.internal_signature_data} alt="Signature" style={{ height: 28, objectFit: "contain" }} />
                      )}
                    </div>
                    <div style={{ fontSize: "8.5pt", color: slate, marginTop: 4 }}>
                      <div><strong>By:</strong> {(() => {
                        const s = proposal.internal_signer;
                        if (s && !Array.isArray(s)) return `${s.first_name || ""} ${s.last_name || ""}`.trim();
                        if (Array.isArray(s) && s[0]) return `${s[0].first_name || ""} ${s[0].last_name || ""}`.trim();
                        const c = (proposal as any).creator;
                        if (c && !Array.isArray(c)) return `${c.first_name || ""} ${c.last_name || ""}`.trim();
                        if (Array.isArray(c) && c[0]) return `${c[0].first_name || ""} ${c[0].last_name || ""}`.trim();
                        return "";
                      })()}</div>
                      <div><strong>Date:</strong> {proposal.internal_signed_at ? fmtDate(proposal.internal_signed_at) : ""}</div>
                    </div>
                  </div>

                  {/* Client */}
                  <div style={{ flex: 1, padding: "16px 20px", background: lightBg, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "10pt", fontWeight: 700, marginBottom: 24, color: charcoal }}>
                      {billTo?.company_name || proposal.client_name || "Client"}
                    </div>
                    <div style={{ borderBottom: `2px solid ${charcoal}`, height: 32, marginBottom: 4 }}>
                      {(proposal as any).client_signature_data && (
                        <img src={(proposal as any).client_signature_data} alt="Client Signature" style={{ height: 28, objectFit: "contain" }} />
                      )}
                    </div>
                    <div style={{ fontSize: "8.5pt", color: slate, marginTop: 4 }}>
                      <div><strong>By:</strong> {(proposal as any).client_signed_name || signer?.name || billTo?.name || ""}</div>
                      <div><strong>Date:</strong> {proposal.client_signed_at ? fmtDate(proposal.client_signed_at) : ""}</div>
                    </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
