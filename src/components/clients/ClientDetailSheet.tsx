import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail,
  Phone,
  MapPin,
  Pencil,
  FileText,
  FolderOpen,
  Loader2,
  StickyNote,
  Star,
  User,
  Linkedin,
  Plus,
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import type { Client } from "@/hooks/useClients";
import { useClientContacts } from "@/hooks/useClients";

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
}

interface ClientStats {
  totalProposals: number;
  acceptedProposals: number;
  rejectedProposals: number;
  winRate: number;
  totalRevenue: number;
  activeProjects: number;
  lastActivity: string | null;
}

function useClientRelations(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-relations", clientId],
    queryFn: async () => {
      if (!clientId) return { projects: [], proposals: [], stats: null as ClientStats | null };

      const [projectsRes, proposalsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, project_number, status, created_at, properties(address)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("proposals")
          .select("id, title, proposal_number, status, total_amount, created_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
      ]);

      const projects = projectsRes.data || [];
      const proposals = proposalsRes.data || [];

      // Calculate stats
      const acceptedProposals = proposals.filter(
        (p) => p.status === "accepted" || p.status === "signed_client"
      ).length;
      const rejectedProposals = proposals.filter((p) => p.status === "rejected").length;
      const decidedProposals = acceptedProposals + rejectedProposals;
      const totalRevenue = proposals
        .filter((p) => p.status === "accepted" || p.status === "signed_client")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const activeProjects = projects.filter((p) => p.status === "open").length;

      // Last activity = most recent created_at from either
      const dates = [
        ...projects.map((p) => p.created_at),
        ...proposals.map((p) => p.created_at),
      ].filter(Boolean) as string[];
      const lastActivity = dates.length
        ? dates.sort((a, b) => b.localeCompare(a))[0]
        : null;

      const stats: ClientStats = {
        totalProposals: proposals.length,
        acceptedProposals,
        rejectedProposals,
        winRate: decidedProposals > 0 ? Math.round((acceptedProposals / decidedProposals) * 100) : 0,
        totalRevenue,
        activeProjects,
        lastActivity,
      };

      return { projects, proposals, stats };
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
  signed_client: "default",
  signed_internal: "default",
  viewed: "secondary",
  rejected: "destructive",
  expired: "outline",
};

const formatCurrency = (value: number | null) => {
  if (!value) return "$0";
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
  const navigate = useNavigate();
  const { data, isLoading: relLoading } = useClientRelations(client?.id);
  const { data: contacts = [], isLoading: contactsLoading } = useClientContacts(client?.id);

  if (!client) return null;

  const stats = data?.stats;
  const primaryContact = contacts.find((c) => c.is_primary);
  const otherContacts = contacts.filter((c) => !c.is_primary);
  const orderedContacts = [...(primaryContact ? [primaryContact] : []), ...otherContacts];

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
            <div className="flex items-center gap-2">
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
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Proposals</span>
                  </div>
                  <p className="text-lg font-bold">{stats.totalProposals}</p>
                  {stats.totalProposals > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {stats.acceptedProposals} won · {stats.winRate}% win rate
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Revenue</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">from accepted proposals</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Active Projects</span>
                  </div>
                  <p className="text-lg font-bold">{stats.activeProjects}</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Last Activity</span>
                  </div>
                  <p className="text-sm font-medium">
                    {stats.lastActivity
                      ? format(new Date(stats.lastActivity), "MMM d, yyyy")
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                navigate("/proposals");
              }}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              New Proposal
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                navigate("/projects");
              }}
            >
              <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
              View Projects
            </Button>
          </div>

          <Separator />

          {/* Company Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Company Info
            </h3>
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

          {/* People / Contacts */}
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              People ({contacts.length})
            </h3>
            {contactsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet</p>
            ) : (
              <div className="space-y-2">
                {orderedContacts.map((contact) => (
                  <div key={contact.id} className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{contact.name}</span>
                      {contact.is_primary && (
                        <Badge variant="default" className="text-xs h-5 gap-1">
                          <Star className="h-3 w-3" />
                          Primary
                        </Badge>
                      )}
                      {contact.title && (
                        <span className="text-xs text-muted-foreground">· {contact.title}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />{contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-xs hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />{contact.phone}
                        </a>
                      )}
                      {contact.linkedin_url && (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Linkedin className="h-3 w-3" />LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
            {relLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data?.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects linked</p>
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
            {relLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : data?.proposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No proposals linked</p>
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
                        {proposal.created_at ? format(new Date(proposal.created_at), "MMM d, yyyy") : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-medium">{formatCurrency(proposal.total_amount)}</span>
                      <Badge variant={statusVariant[proposal.status] || "secondary"}>
                        {proposal.status?.replace("_", " ")}
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
