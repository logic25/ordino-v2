import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, MapPin, Search, X, Plus, CheckCircle, AlertTriangle,
  Calendar, FileText, Building2, DollarSign,
} from "lucide-react";
import { useNotableApplications, useUpdateApplicationRfpInfo } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const addr = (p.properties as any)?.address?.toLowerCase() || "";
    const desc = p.description?.toLowerCase() || "";
    const type = p.application_type?.toLowerCase() || "";
    return addr.includes(q) || desc.includes(q) || type.includes(q);
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
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-amber" />
          <h3 className="text-lg font-semibold">Notable Projects</h3>
          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30 tabular-nums">
            {filtered.length}
          </Badge>
        </div>
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
        <Card className="border-dashed">
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
            const isExpanded = expandedId === proj.id;

            return (
              <Card
                key={proj.id}
                className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-accent"
              >
                <CardContent className="py-4">
                  <div className="space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-accent flex-shrink-0" />
                          <p className="font-semibold text-base">{props?.address || "Unknown Address"}</p>
                          {proj.application_type && (
                            <Badge className="text-xs font-normal bg-info/10 text-info border-info/30" variant="outline">
                              <FileText className="h-3 w-3 mr-1" />
                              {proj.application_type}
                            </Badge>
                          )}
                          {proj.status && (
                            <Badge
                              className={`text-xs ${
                                proj.status === "complete" || proj.status === "permit_issued"
                                  ? "bg-success/15 text-success border-success/30"
                                  : proj.status === "under_review" || proj.status === "inspection"
                                  ? "bg-warning/15 text-warning border-warning/30"
                                  : proj.status === "filed"
                                  ? "bg-info/15 text-info border-info/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              variant="outline"
                            >
                              {proj.status?.replace(/_/g, " ")}
                            </Badge>
                          )}
                        </div>

                        {/* Key info row */}
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-info">
                            <MapPin className="h-3.5 w-3.5" />
                            {props?.borough || "NYC"}
                          </span>
                          {proj.job_number && (
                            <span className="flex items-center gap-1 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              Job #{proj.job_number}
                            </span>
                          )}
                          {proj.estimated_value && (
                            <span className="flex items-center gap-1 text-success font-medium tabular-nums">
                              <DollarSign className="h-3.5 w-3.5" />
                              {proj.estimated_value.toLocaleString()}
                            </span>
                          )}
                          {proj.filed_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-accent" />
                              Filed {format(new Date(proj.filed_date), "MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reference contact & expand */}
                      <div className="text-right text-sm flex-shrink-0">
                        {proj.reference_contact_name ? (
                          <div className="flex items-center gap-1 justify-end">
                            {daysSince !== null && daysSince < 90 ? (
                              <CheckCircle className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                            )}
                            <span className="text-muted-foreground font-medium">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 mt-1 px-2 text-accent hover:text-accent"
                          onClick={() => setExpandedId(isExpanded ? null : proj.id)}
                        >
                          {isExpanded ? "Less" : "More"} details
                        </Button>
                      </div>
                    </div>

                    {/* Description */}
                    {proj.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {proj.description}
                      </p>
                    )}

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm animate-fade-in">
                        {proj.approved_date && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-success font-semibold">Approved</p>
                            <p className="font-medium">{format(new Date(proj.approved_date), "MMM d, yyyy")}</p>
                          </div>
                        )}
                        {proj.permit_issued_date && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-info font-semibold">Permit Issued</p>
                            <p className="font-medium">{format(new Date(proj.permit_issued_date), "MMM d, yyyy")}</p>
                          </div>
                        )}
                        {proj.examiner_name && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold">Examiner</p>
                            <p className="font-medium">{proj.examiner_name}</p>
                          </div>
                        )}
                        {proj.reference_contact_title && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contact Title</p>
                            <p className="font-medium">{proj.reference_contact_title}</p>
                          </div>
                        )}
                        {proj.reference_contact_email && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contact Email</p>
                            <p className="font-medium">{proj.reference_contact_email}</p>
                          </div>
                        )}
                        {proj.reference_contact_phone && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contact Phone</p>
                            <p className="font-medium">{proj.reference_contact_phone}</p>
                          </div>
                        )}
                        {proj.reference_notes && (
                          <div className="col-span-full space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reference Notes</p>
                            <p className="text-sm">{proj.reference_notes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {tags.map((tag) => (
                        <Badge key={tag} className="text-xs gap-1 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20" variant="outline">
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
                                  className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
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
                          className="h-6 px-1.5 text-xs text-accent hover:text-accent hover:bg-accent/10"
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
