import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Building2 } from "lucide-react";
import { useLeadConnections } from "@/hooks/useLeadConnections";

/**
 * "We work with so-and-so" / "We've filed here before" panel on a lead.
 * Always renders both sections with explicit empty states — we want users
 * to know we LOOKED and found nothing (vs. the panel silently disappearing).
 */
export function LeadConnectionsCard({
  leadId,
  company,
  propertyAddress,
}: {
  leadId: string;
  company: string | null;
  propertyAddress: string | null;
}) {
  const { data, isLoading } = useLeadConnections(leadId);

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Looking for connections…
      </Card>
    );
  }

  const people = data?.people ?? [];
  const projects = data?.projects ?? [];

  return (
    <Card className="p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Connections
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          People we know at {company || "this company"}
        </div>
        {people.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-5">
            None yet — add a contact at this company in Clients.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => {
              const to = p.kind === "lead" ? `/bd/leads/${p.id}` : `/clients`;
              return (
                <Link key={`${p.kind}-${p.id}`} to={to}>
                  <Badge
                    variant="secondary"
                    className="gap-1 hover:bg-secondary/80 cursor-pointer"
                    title={
                      p.kind === "lead"
                        ? `Lead · ${p.context ?? ""}`.trim()
                        : `Contact at ${p.client_name ?? "—"}`
                    }
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">· {p.role}</span>
                    {p.kind === "lead" && (
                      <span className="text-[10px] text-muted-foreground">(lead)</span>
                    )}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          Our work at {propertyAddress || "this address"}
        </div>
        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-5">
            No prior projects at this address.
          </p>
        ) : (
          <div className="space-y-1">
            {projects.map((pr) => (
              <Link
                key={pr.id}
                to={`/projects/${pr.id}`}
                className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-1 -mx-1 py-0.5"
              >
                <span className="font-medium">{pr.project_number ?? "—"}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {pr.status ?? "—"}
                </Badge>
                {pr.year != null && (
                  <span className="text-muted-foreground">{pr.year}</span>
                )}
                <span className="text-muted-foreground truncate">
                  · {pr.property_address}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
