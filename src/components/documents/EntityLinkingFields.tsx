import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/hooks/useProjects";
import { useProperties } from "@/hooks/useProperties";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectId: string | undefined;
  propertyId: string | undefined;
  proposalId: string | undefined;
  onProjectChange: (id: string | undefined) => void;
  onPropertyChange: (id: string | undefined) => void;
  onProposalChange: (id: string | undefined) => void;
}

export function EntityLinkingFields({
  projectId, propertyId, proposalId,
  onProjectChange, onPropertyChange, onProposalChange,
}: Props) {
  const { data: projects = [] } = useProjects();
  const { data: properties = [] } = useProperties();
  const { data: proposals = [] } = useQuery({
    queryKey: ["proposals-for-linking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, proposal_number")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Link to (optional)
      </Label>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label className="text-xs">Project</Label>
          <Select value={projectId || "_none"} onValueChange={(v) => onProjectChange(v === "_none" ? undefined : v)}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_number || "—"} — {p.properties?.address || p.name || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Property</Label>
          <Select value={propertyId || "_none"} onValueChange={(v) => onPropertyChange(v === "_none" ? undefined : v)}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Proposal</Label>
          <Select value={proposalId || "_none"} onValueChange={(v) => onProposalChange(v === "_none" ? undefined : v)}>
            <SelectTrigger className="mt-1 h-8 text-xs">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {proposals.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.proposal_number} — {p.title || "Untitled"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
