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
      const { data } = await supabase.from("companies").select("name, address, phone, email").eq("id", profile.company_id).single();
      return data;
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
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(v);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
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
        body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
        th { font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; }
        .text-right { text-align: right; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .meta { color: #666; font-size: 13px; }
        .total-row td { font-weight: 700; border-top: 2px solid #333; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999; }
      </style></head><body>
    `);
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-background">
          <div>
            <DialogHeader>
              <DialogTitle className="text-lg">
                Proposal Preview — {proposal.proposal_number}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-0.5">{proposal.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1.5" /> Print / PDF
            </Button>
            {onSend && proposal.status === "draft" && (
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => { onSend(proposal.id); onOpenChange(false); }}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send Proposal
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/30">
          <div id="proposal-preview-content" className="max-w-[750px] mx-auto bg-background shadow-sm my-6 rounded-lg border p-10">
            {/* Company Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{company?.name || "Your Company"}</h1>
                {company?.address && <p className="text-sm text-muted-foreground mt-1">{company.address}</p>}
                {company?.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
                {company?.email && <p className="text-sm text-muted-foreground">{company.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Proposal</p>
                <p className="text-lg font-bold text-foreground mt-1">{proposal.proposal_number}</p>
                <p className="text-sm text-muted-foreground mt-1">Date: {formatDate(proposal.created_at)}</p>
                {proposal.valid_until && (
                  <p className="text-sm text-muted-foreground">Valid Until: {formatDate(proposal.valid_until)}</p>
                )}
              </div>
            </div>

            <Separator className="mb-6" />

            {/* Client & Property */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prepared For</p>
                {billToContact ? (
                  <div>
                    <p className="font-semibold">{billToContact.name}</p>
                    {billToContact.company_name && <p className="text-sm text-muted-foreground">{billToContact.company_name}</p>}
                    {billToContact.email && <p className="text-sm text-muted-foreground">{billToContact.email}</p>}
                    {billToContact.phone && <p className="text-sm text-muted-foreground">{billToContact.phone}</p>}
                  </div>
                ) : proposal.client_name ? (
                  <div>
                    <p className="font-semibold">{proposal.client_name}</p>
                    {proposal.client_email && <p className="text-sm text-muted-foreground">{proposal.client_email}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No client specified</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Property</p>
                <p className="font-semibold">{proposal.properties?.address || "—"}</p>
                {proposal.properties?.borough && (
                  <p className="text-sm text-muted-foreground">{proposal.properties.borough}</p>
                )}
              </div>
            </div>

            {/* Scope */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scope of Work</p>
              <p className="text-sm font-semibold text-foreground">{proposal.title}</p>
              {proposal.scope_of_work && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{proposal.scope_of_work}</p>
              )}
            </div>

            {/* Services Table */}
            {nonOptionalItems.length > 0 && (
              <div className="mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-foreground/20">
                      <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-left">Service</th>
                      <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-center w-16">Qty</th>
                      <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-right w-24">Price</th>
                      <th className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 text-right w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonOptionalItems.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2.5">
                          <span className="font-medium">{item.name}</span>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        </td>
                        <td className="py-2.5 text-center">{item.quantity}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatCurrency(Number(item.unit_price))}</td>
                        <td className="py-2.5 text-right tabular-nums font-medium">{formatCurrency(Number(item.total_price || item.quantity * item.unit_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-foreground/20">
                      <td colSpan={3} className="py-3 text-right font-semibold text-base">Total</td>
                      <td className="py-3 text-right font-bold text-base tabular-nums">{formatCurrency(Number(proposal.total_amount || proposal.subtotal || 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Optional Services */}
            {optionalItems.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Optional Services</p>
                <table className="w-full text-sm">
                  <tbody>
                    {optionalItems.map((item: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2">
                          <span className="font-medium">{item.name}</span>
                          {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                        </td>
                        <td className="py-2 text-right tabular-nums w-24">{formatCurrency(Number(item.total_price || item.quantity * item.unit_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Deposit */}
            {(proposal.deposit_required || proposal.deposit_percentage) && (
              <div className="mb-6 rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deposit Required</p>
                <p className="text-lg font-bold">
                  {formatCurrency(Number(proposal.deposit_required || 0))}
                  {proposal.deposit_percentage && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">({proposal.deposit_percentage}%)</span>
                  )}
                </p>
              </div>
            )}

            {/* Payment Schedule */}
            {proposal.payment_terms && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Schedule</p>
                <p className="text-sm whitespace-pre-wrap">{proposal.payment_terms}</p>
              </div>
            )}

            {/* Terms & Conditions */}
            {(proposal as any).terms_conditions && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Terms & Conditions</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{(proposal as any).terms_conditions}</p>
              </div>
            )}

            {/* Signature Lines */}
            <div className="mt-10 grid grid-cols-2 gap-8">
              <div>
                <div className="border-b border-foreground/30 mb-2 h-10" />
                <p className="text-xs text-muted-foreground">Client Signature & Date</p>
                {signerContact && <p className="text-xs text-muted-foreground mt-1">{signerContact.name}</p>}
              </div>
              <div>
                <div className="border-b border-foreground/30 mb-2 h-10">
                  {proposal.internal_signature_data && (
                    <img src={proposal.internal_signature_data} alt="Internal signature" className="h-9 object-contain" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Authorized Signature & Date
                  {proposal.internal_signer && (
                    <span className="ml-1">— {proposal.internal_signer.first_name} {proposal.internal_signer.last_name}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                {company?.name}{company?.phone ? ` · ${company.phone}` : ""}{company?.email ? ` · ${company.email}` : ""}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
