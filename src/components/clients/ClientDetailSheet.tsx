import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Pencil, FileText, FolderOpen, StickyNote } from "lucide-react";
import { format } from "date-fns";
import type { Client } from "@/hooks/useClients";
import { useClientContacts } from "@/hooks/useClients";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useEffect } from "react";
import { useClientRelations } from "./client-detail/useClientRelations";
import { ClientStatsCards } from "./client-detail/ClientStatsCards";
import { ClientContactsList } from "./client-detail/ClientContactsList";
import { ClientRelationsList } from "./client-detail/ClientRelationsList";

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
}

export function ClientDetailSheet({ client, open, onOpenChange, onEdit }: ClientDetailSheetProps) {
  const navigate = useNavigate();
  const { data, isLoading: relLoading } = useClientRelations(client?.id);
  const { data: contacts = [], isLoading: contactsLoading } = useClientContacts(client?.id);
  const { track } = useTelemetry();

  useEffect(() => {
    if (open && client?.id) {
      track("clients", "detail_opened", { client_id: client.id });
    }
  }, [open, client?.id]);

  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{client.name}</SheetTitle>
              <SheetDescription>
                Client since {client.created_at ? format(new Date(client.created_at), "MMM yyyy") : "—"}
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(client); }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {data?.stats && <ClientStatsCards stats={data.stats} />}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onOpenChange(false); navigate("/proposals"); }}>
              <FileText className="h-3.5 w-3.5 mr-1.5" /> New Proposal
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => { onOpenChange(false); navigate("/projects"); }}>
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> View Projects
            </Button>
          </div>

          <Separator />

          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Company Info</h3>
            <div className="space-y-2">
              {client.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{client.address}</span>
                </div>
              )}
              {!client.email && !client.phone && !client.address && (
                <p className="text-sm text-muted-foreground">No company details on file</p>
              )}
            </div>
          </div>

          <Separator />
          <ClientContactsList contacts={contacts} isLoading={contactsLoading} />

          {client.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5" /> Notes
                </h3>
                <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />
          <ClientRelationsList
            projects={data?.projects || []}
            proposals={data?.proposals || []}
            isLoading={relLoading}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
