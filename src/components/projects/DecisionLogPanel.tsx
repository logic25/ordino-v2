import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookMarked, Clock } from "lucide-react";
import { useDecisionRecords } from "@/hooks/useDecisionRecords";

export function DecisionLogPanel() {
  const { data: records = [], isLoading } = useDecisionRecords();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.code_reference, r.objection_text, r.recommendation, r.reasoning, r.filing_type]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [records, search]);

  const resolverName = (r: (typeof records)[number]) => {
    const p = r.resolver;
    if (!p) return "Unknown";
    return [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-320px)] min-h-[500px]">
      <div className="p-3 border-b flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search by code section or keyword (e.g. AC 28-104.7)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "decision" : "decisions"}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Clock className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookMarked className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {records.length === 0 ? "No decisions recorded yet" : "No decisions match that search"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Resolving an objection with notes or a draft response records the decision here.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.code_reference && (
                    <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">
                      {r.code_reference}
                    </Badge>
                  )}
                  {r.filing_type && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{r.filing_type}</Badge>
                  )}
                  {r.status === "pending_review" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      Pending review
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {resolverName(r)} · {new Date(r.resolved_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground italic line-clamp-3">{r.objection_text}</p>

                {r.recommendation && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                      What we recommended
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{r.recommendation}</p>
                  </div>
                )}

                {r.reasoning && (
                  <div className="rounded-md bg-muted/40 border p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                      Why
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{r.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
