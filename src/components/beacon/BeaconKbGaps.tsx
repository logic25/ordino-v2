import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const GAP_PHRASES = [
  "don't have",
  "do not have",
  "don't have relevant documents",
  "not in my documents",
  "don't cover",
  "outside my reference",
];

type Row = {
  id: number;
  question: string | null;
  response: string | null;
  confidence: number | null;
  answered: boolean | null;
  command: string | null;
  topic: string | null;
};

function isGap(r: Row): boolean {
  if (r.command === "passive_gap") return true;
  const q = (r.question ?? "").trim();
  if (!q || q.startsWith("/") || q.length <= 15) return false;
  const ql = q.toLowerCase();
  if (/^(hi|hello|hey|test|ping)\b/.test(ql)) return false;
  if (r.answered !== true) return false;
  if (r.confidence == null || Number(r.confidence) >= 0.5) return false;
  const resp = (r.response ?? "").toLowerCase();
  return GAP_PHRASES.some((p) => resp.includes(p));
}

export function BeaconKbGaps() {
  const qc = useQueryClient();
  const [busyTopic, setBusyTopic] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["beacon-kb-gaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beacon_interactions")
        .select("id, question, response, confidence, answered, command, topic")
        .is("addressed_at" as any, null)
        .order("id", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const gaps = data.filter(isGap);
    const map = new Map<string, { topic: string; rows: Row[] }>();
    for (const r of gaps) {
      const topic = (r.topic ?? "uncategorized").trim() || "uncategorized";
      if (!map.has(topic)) map.set(topic, { topic, rows: [] });
      map.get(topic)!.rows.push(r);
    }
    return Array.from(map.values())
      .map((g) => ({
        topic: g.topic,
        count: g.rows.length,
        avgConfidence:
          g.rows.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / g.rows.length,
        examples: g.rows.slice(0, 3).map((r) => r.question ?? ""),
        ids: g.rows.map((r) => r.id),
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const markAddressed = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase
        .from("beacon_interactions")
        .update({ addressed_at: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as addressed");
      qc.invalidateQueries({ queryKey: ["beacon-kb-gaps"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark addressed"),
    onSettled: () => setBusyTopic(null),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> Failed to load gaps: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[hsl(142,71%,45%)]" />
          No open knowledge-base gaps. Beacon is covering recent questions well.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Questions where Beacon answered with low confidence and signalled missing knowledge. Add documents or notes to fill these, then mark addressed.
      </p>
      {groups.map((g) => (
        <Card key={g.topic}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base capitalize">{g.topic}</CardTitle>
              <CardDescription className="flex items-center gap-3 text-xs">
                <Badge variant="secondary">{g.count} {g.count === 1 ? "gap" : "gaps"}</Badge>
                <span>Avg confidence {Math.round(g.avgConfidence * 100)}%</span>
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={markAddressed.isPending && busyTopic === g.topic}
              onClick={() => {
                setBusyTopic(g.topic);
                markAddressed.mutate(g.ids);
              }}
            >
              {markAddressed.isPending && busyTopic === g.topic ? "…" : "Mark addressed"}
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {g.examples.map((q, i) => (
                <li key={i} className="text-muted-foreground border-l-2 border-muted pl-3">
                  "{q}"
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
