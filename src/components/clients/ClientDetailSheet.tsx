import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  MapPin,
  Pencil,
  FileText,
  FolderOpen,
  Loader2,
  StickyNote,
} from "lucide-react";
import { format } from "date-fns";
import type { Client } from "@/hooks/useClients";

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
}

function useClientRelations(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-relations", clientId],
    queryFn: async () => {
      if (!clientId) return { projects: [], proposals: [] };

      const [projectsRes, proposalsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, project_number, status, properties(address)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select("id, title, proposal_number, status, total_amount, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
      ]);

      return {
        projects: projectsRes.data || [],
        proposals: proposalsRes.data || [],
      };
    },
    enabled: !!clientId,
  });
}

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  on_hold: "secondary",
  closed: "outline",
  paid: "default",
  draft: "secondary",
  sent: "default",
  accepted: "default",
  rejected: "destructive",
  expired: "outline",
};

const formatCurrency = (value: number | null) => {
  if (!value) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
};

export function ClientDetailSheet({
  client,
  open,
  onOpenChange,
  onEdit,
}: ClientDetailSheetProps) {
  const { data, isLoading } = useClientRelations(client?.id);

  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{client.name}</SheetTitle>
              <SheetDescription>
                Added {client.created_at ? format(new Date(client.created_at), "MMM d, yyyy") : "—"}
              </SheetDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(client);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Contact Info
            </h3>
            <div className="space-y-2.5">
              {client.email && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${client.phone}`} className="hover:underline">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2.5 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{client.address}</span>
                </div>
              )}
              {!client.email && !client.phone && !client.address && (
                <p className="text-sm text-muted-foreground">No contact details on file</p>
              )}
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes
                </h3>
                <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Projects */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Projects ({data?.projects.length ?? 0})
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data?.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects linked to this client</p>
            ) : (
              <div className="space-y-2">
                {data?.projects.map((project: any) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {project.name || project.project_number || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.properties?.address || "—"}
                      </p>
                    </div>
                    <Badge variant={statusVariant[project.status] || "secondary"} className="shrink-0 ml-2">
                      {project.status?.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Proposals */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Proposals ({data?.proposals.length ?? 0})
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data?.proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposals linked to this client</p>
            ) : (
              <div className="space-y-2">
                {data?.proposals.map((proposal: any) => (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {proposal.title || proposal.proposal_number || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {proposal.created_at
                          ? format(new Date(proposal.created_at), "MMM d, yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-medium">
                        {formatCurrency(proposal.total_amount)}
                      </span>
                      <Badge variant={statusVariant[proposal.status] || "secondary"}>
                        {proposal.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
