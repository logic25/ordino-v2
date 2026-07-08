import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import {
  useUpdateMarket,
  type Market,
  type ThirdPartyReviewStatus,
} from "@/hooks/useMarkets";
import { useToast } from "@/hooks/use-toast";

// Jurisdiction-level flag: does this AHJ ACCEPT third-party / peer plan review?
// Some counties (e.g. Fairfax) publish a program and an approved-reviewer list;
// others require the AHJ's own examiner. Tracked here so we know at intake
// whether GLE can bring a private reviewer to compress plan-check timelines.
export function ThirdPartyReviewBadge({ status }: { status: ThirdPartyReviewStatus }) {
  if (status === "accepted") {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
        ✅ 3rd-party review accepted
      </Badge>
    );
  }
  if (status === "accepted_with_restrictions") {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
        ⚠️ Accepted with restrictions
      </Badge>
    );
  }
  if (status === "not_offered") {
    return (
      <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
        ❌ Not offered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground">
      ❓ Unknown
    </Badge>
  );
}

export default function MarketPeerReviewSection({ market }: { market: Market }) {
  const update = useUpdateMarket();
  const { toast } = useToast();

  const [status, setStatus] = useState<ThirdPartyReviewStatus>(market.third_party_review_allowed ?? "unknown");
  const [notes, setNotes] = useState(market.third_party_review_notes ?? "");
  const [url, setUrl] = useState(market.third_party_review_source_url ?? "");

  useEffect(() => {
    setStatus(market.third_party_review_allowed ?? "unknown");
    setNotes(market.third_party_review_notes ?? "");
    setUrl(market.third_party_review_source_url ?? "");
  }, [market.id, market.third_party_review_allowed, market.third_party_review_notes, market.third_party_review_source_url]);

  const saveStatus = async (next: ThirdPartyReviewStatus) => {
    setStatus(next);
    try {
      await update.mutateAsync({ id: market.id, third_party_review_allowed: next });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const saveNotes = () => {
    if ((notes ?? "") === (market.third_party_review_notes ?? "")) return;
    update.mutate({ id: market.id, third_party_review_notes: notes.trim() || null });
  };

  const saveUrl = () => {
    if ((url ?? "") === (market.third_party_review_source_url ?? "")) return;
    update.mutate({ id: market.id, third_party_review_source_url: url.trim() || null });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Third-Party Plan Review
        </div>
        <ThirdPartyReviewBadge status={status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Jurisdiction accepts it?</Label>
          <Select value={status} onValueChange={(v) => saveStatus(v as ThirdPartyReviewStatus)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="accepted_with_restrictions">Accepted with restrictions</SelectItem>
              <SelectItem value="not_offered">Not offered — AHJ review only</SelectItem>
              <SelectItem value="unknown">Unknown — needs research</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Program page URL</Label>
          <div className="flex gap-1.5">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={saveUrl}
              placeholder="https://…"
              className="h-8 text-xs"
            />
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center h-8 w-8 rounded border text-muted-foreground hover:text-foreground"
                aria-label="Open link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Notes (program name, approved reviewers, restrictions)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={2}
          placeholder="e.g. Fairfax Expedited Plan Review — approved reviewers: Faisant, ECS, Bowman. Covers commercial building & site permits."
          className="text-xs"
        />
      </div>
    </div>
  );
}
