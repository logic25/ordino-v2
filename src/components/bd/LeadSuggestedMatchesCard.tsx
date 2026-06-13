import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { InfoTip } from "@/components/bd/InfoTip";

/**
 * "People in your network who might be a fit for this lead."
 *
 * Lightweight, deterministic v1 — no LLM call. Ranks other active leads by:
 *   1. Shared tags (strongest signal)
 *   2. Same client_type
 *   3. Same source_type (met in the same channel)
 *
 * When the user is ready for true AI matchmaking we swap the query
 * for a Beacon edge function — same shape, same component.
 */
export function LeadSuggestedMatchesCard({
  leadId,
  tags,
  clientType,
  sourceType,
  company,
}: {
  leadId: string;
  tags: string[];
  clientType: string | null;
  sourceType: string | null;
  company: string | null;
}) {
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["lead-suggested-matches", leadId, tags.join(","), clientType, sourceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, full_name, role, company, client_type, source_type, tags, stage, lead_kind")
        .neq("id", leadId)
        .not("stage", "in", "(LOST,WON)")
        .limit(200);
      if (error) throw error;

      const tagSet = new Set(tags.map((t) => t.toLowerCase()));
      const scored = (data ?? [])
        .map((l: any) => {
          const lTags: string[] = Array.isArray(l.tags) ? l.tags : [];
          const sharedTags = lTags.filter((t) => tagSet.has(String(t).toLowerCase()));
          let score = sharedTags.length * 3;
          if (clientType && l.client_type === clientType) score += 1;
          if (sourceType && l.source_type === sourceType) score += 1;
          if (company && l.company && l.company.toLowerCase() === company.toLowerCase()) score += 2;
          return { lead: l, score, sharedTags };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return scored;
    },
  });

  return (
    <div className="bd-surface rounded-xl p-5">
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <h3 className="bd-eyebrow !mb-0">Suggested matches</h3>
        <InfoTip text="Other leads in your network who look like a fit for this one — ranked by shared tags, same client type, same source, or same company. Useful for warm intros." />
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Looking…</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          {tags.length === 0
            ? "Add tags above so we can find related people in your network."
            : "No related people yet — tag more leads to surface matches."}
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map(({ lead, sharedTags }) => (
            <li key={lead.id}>
              <Link
                to={`/bd/leads/${lead.id}`}
                className="group flex items-start gap-2 rounded-md p-2 -m-2 hover:bg-slate-100 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {lead.full_name}
                    {lead.lead_kind === "CONTACT" && (
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400">contact</span>
                    )}
                  </p>
                  {(lead.role || lead.company) && (
                    <p className="text-xs text-slate-500 truncate">
                      {[lead.role, lead.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {sharedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sharedTags.slice(0, 3).map((t: string) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="rounded-full px-1.5 py-0 text-[10px] bg-amber-50/60 border-amber-200 text-amber-800"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-600 shrink-0 mt-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
        Ranked by shared tags, client type, and source. AI enrichment from LinkedIn / Clearbit is on the roadmap.
      </p>
    </div>
  );
}
