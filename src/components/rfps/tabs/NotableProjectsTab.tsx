import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Search, X, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { useNotableApplications, useUpdateApplicationRfpInfo } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const COMMON_TAGS = [
  "nycedc", "nycha", "doe", "nyc_parks", "dot", "dep", "lpc",
  "dob_expediting", "fdny_coordination", "dep_compliance", "lpc_approval",
  "multi_agency", "energy_systems", "university", "affordable_housing",
  "commercial", "new_building", "major_alteration", "certificate_of_occupancy",
];

export function NotableProjectsTab() {
  const { data: projects = [], isLoading } = useNotableApplications();
  const updateMutation = useUpdateApplicationRfpInfo();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const addr = (p.properties as any)?.address?.toLowerCase() || "";
    const desc = p.description?.toLowerCase() || "";
    return addr.includes(q) || desc.includes(q);
  });

  const addTag = async (projId: string, currentTags: string[], tag: string) => {
    const trimmed = tag.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed || currentTags.includes(trimmed)) return;
    try {
      await updateMutation.mutateAsync({ id: projId, rfp_tags: [...currentTags, trimmed] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const removeTag = async (projId: string, currentTags: string[], tag: string) => {
    try {
      await updateMutation.mutateAsync({ id: projId, rfp_tags: currentTags.filter((t) => t !== tag) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notable Projects ({filtered.length})</h3>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Projects marked as "Notable" in Applications will appear here. Add tags and reference contacts for RFP matching.
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            {projects.length === 0
              ? 'No notable projects yet. Mark applications as "Notable" to showcase them in RFPs.'
              : "No projects match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((proj) => {
            const props = proj.properties as any;
            const tags = proj.rfp_tags || [];
            const verified = proj.reference_last_verified;
            const daysSince = verified
              ? Math.floor((Date.now() - new Date(verified).getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card key={proj.id}>
                <CardContent className="py-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{props?.address || "Unknown Address"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{props?.borough || "NYC"}</span>
                          {proj.estimated_value && (
                            <>
                              <span>•</span>
                              <span>${proj.estimated_value.toLocaleString()}</span>
                            </>
                          )}
                          {proj.description && (
                            <>
                              <span>•</span>
                              <span>{proj.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        {proj.reference_contact_name ? (
                          <div className="flex items-center gap-1">
                        {daysSince !== null && daysSince < 90 ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            )}
                            <span className="text-muted-foreground">
                              {proj.reference_contact_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">No contact</span>
                        )}
                        {verified && (
                          <p className="text-xs text-muted-foreground">
                            Verified {formatDistanceToNow(new Date(verified))} ago
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs gap-1">
                          {tag}
                          <button
                            onClick={() => removeTag(proj.id, tags, tag)}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {editingTagsId === proj.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                addTag(proj.id, tags, newTag);
                                setNewTag("");
                              }
                              if (e.key === "Escape") setEditingTagsId(null);
                            }}
                            placeholder="Tag name..."
                            className="h-7 w-32 text-xs"
                            autoFocus
                          />
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {COMMON_TAGS.filter((t) => !tags.includes(t) && t.includes(newTag.toLowerCase()))
                              .slice(0, 5)
                              .map((t) => (
                                <button
                                  key={t}
                                  onClick={() => {
                                    addTag(proj.id, tags, t);
                                    setNewTag("");
                                  }}
                                  className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-accent transition-colors"
                                >
                                  {t}
                                </button>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs"
                          onClick={() => {
                            setEditingTagsId(proj.id);
                            setNewTag("");
                          }}
                        >
                          <Plus className="h-3 w-3" /> Tag
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
