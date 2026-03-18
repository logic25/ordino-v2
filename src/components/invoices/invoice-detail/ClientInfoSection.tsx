import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Loader2, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { InvoiceWithRelations } from "@/hooks/useInvoices";

interface ClientInfoSectionProps {
  invoice: InvoiceWithRelations;
}

export function ClientInfoSection({ invoice }: ClientInfoSectionProps) {
  const [editingClient, setEditingClient] = useState(false);
  const [clientEdits, setClientEdits] = useState({ name: "", email: "", phone: "", address: "" });
  const [savingClient, setSavingClient] = useState(false);
  const queryClient = useQueryClient();

  const handleSaveClient = async () => {
    if (!invoice.client_id) return;
    setSavingClient(true);
    try {
      const updates: Record<string, string> = {};
      if (clientEdits.name.trim()) updates.name = clientEdits.name.trim();
      if (clientEdits.email !== (invoice.clients?.email || "")) updates.email = clientEdits.email.trim() || null as any;
      if (clientEdits.phone !== (invoice.clients?.phone || "")) updates.phone = clientEdits.phone.trim() || null as any;
      if (clientEdits.address !== (invoice.clients?.address || "")) updates.address = clientEdits.address.trim() || null as any;

      const { error } = await supabase.from("clients").update(updates).eq("id", invoice.client_id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Client info updated" });
      setEditingClient(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingClient(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-muted-foreground">Client Info</h4>
        {!editingClient && (
          <Button variant="ghost" size="sm" onClick={() => {
            setEditingClient(true);
            setClientEdits({
              name: invoice.clients?.name || "",
              email: invoice.clients?.email || "",
              phone: invoice.clients?.phone || "",
              address: invoice.clients?.address || "",
            });
          }}>
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </div>

      {editingClient ? (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={clientEdits.name} onChange={(e) => setClientEdits((p) => ({ ...p, name: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={clientEdits.email} onChange={(e) => setClientEdits((p) => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={clientEdits.phone} onChange={(e) => setClientEdits((p) => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={clientEdits.address} onChange={(e) => setClientEdits((p) => ({ ...p, address: e.target.value }))} className="h-8 text-sm" /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditingClient(false)}>Cancel</Button>
            <Button size="sm" disabled={savingClient} onClick={handleSaveClient}>
              {savingClient && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium" data-clarity-mask="true">{invoice.clients?.name || "—"}</p>
          {invoice.clients?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <a href={`tel:${invoice.clients.phone}`} className="text-primary hover:underline" data-clarity-mask="true">{invoice.clients.phone}</a>
            </div>
          )}
          {invoice.clients?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <a href={`mailto:${invoice.clients.email}`} className="text-primary hover:underline" data-clarity-mask="true">{invoice.clients.email}</a>
            </div>
          )}
          {invoice.clients?.address && (
            <p className="text-xs text-muted-foreground" data-clarity-mask="true">{invoice.clients.address}</p>
          )}
        </div>
      )}

      {/* Billing Contact */}
      <div className="mt-3">
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
          {invoice.billed_to_contact ? "Sent To (Billing Contact)" : "Sent To"}
        </h4>
        {invoice.billed_to_contact ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
            <p className="text-sm font-semibold" data-clarity-mask="true">{invoice.billed_to_contact.name}</p>
            {invoice.billed_to_contact.title && (
              <p className="text-xs text-muted-foreground">{invoice.billed_to_contact.title}{invoice.billed_to_contact.company_name ? ` at ${invoice.billed_to_contact.company_name}` : ""}</p>
            )}
            {invoice.billed_to_contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3 w-3 text-muted-foreground" />
                <a href={`mailto:${invoice.billed_to_contact.email}`} className="text-primary hover:underline" data-clarity-mask="true">{invoice.billed_to_contact.email}</a>
              </div>
            )}
            {invoice.billed_to_contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Office</span>
                <a href={`tel:${invoice.billed_to_contact.phone}`} className="text-primary hover:underline" data-clarity-mask="true">{invoice.billed_to_contact.phone}</a>
              </div>
            )}
            {invoice.billed_to_contact.mobile && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Mobile</span>
                <a href={`tel:${invoice.billed_to_contact.mobile}`} className="text-primary hover:underline" data-clarity-mask="true">{invoice.billed_to_contact.mobile}</a>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No billing contact assigned — sent to client directly</p>
        )}
      </div>
    </section>
  );
}
