import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ExternalLink, UserPlus, Inbox, Loader2, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { safeFormatDate } from "@/lib/dateUtils";
import { CaptureLeadModal } from "@/components/bd/CaptureLeadModal";
import {
  enrichSignal, buildSignalLeadNotes, type SignalLead,
} from "@/services/signalEnrichment";

type MarketSignal = {
  id: string;
  company_id: string;
  title: string;
  summary: string | null;
  source_url: string | null;
  sender: string | null;
  signal_date: string | null;
  status: string;
  created_at: string;
};

type LeadQueue = { signal: MarketSignal; leads: SignalLead[]; index: number };

/** Beacon lead extraction for one signal. Cached per signal id for the session. */
function useSignalLeads(signal: MarketSignal) {
  const text = [signal.title, signal.summary].filter(Boolean).join("\n\n");
  return useQuery({
    queryKey: ["signal-leads", signal.id],
    enabled: !!text.trim(),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: false,
    queryFn: () => enrichSignal(text),
  });
}

function SignalCard({
  signal, archived, onArchive, archiving, onCreateLeads,
}: {
  signal: MarketSignal;
  archived: boolean;
  onArchive: (id: string) => void;
  archiving: boolean;
  onCreateLeads: (signal: MarketSignal, leads: SignalLead[]) => void;
}) {
  const { data: enrichment, isLoading: enriching, isError } = useSignalLeads(signal);
  const leads = enrichment?.leads ?? [];
  const count = enrichment?.lead_count ?? 0;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium leading-tight">{signal.title}</h3>
              {signal.signal_date && (
                <Badge variant="outline" className="font-normal shrink-0 whitespace-nowrap">
                  {safeFormatDate(signal.signal_date, "MMM d, yyyy")}
                </Badge>
              )}
              {enriching ? (
                <Badge variant="secondary" className="font-normal shrink-0 whitespace-nowrap gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Reading
                </Badge>
              ) : count > 0 ? (
                <Badge className="font-normal shrink-0 whitespace-nowrap gap-1">
                  <Sparkles className="h-3 w-3" />
                  {count} {count === 1 ? "lead" : "leads"}
                </Badge>
              ) : null}
            </div>
            {signal.summary && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                {signal.summary}
              </p>
            )}
            {leads.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {leads.map((l, i) => (
                  <Badge key={`${l.party}-${i}`} variant="outline" className="font-normal max-w-[280px] truncate"
                    title={[l.party, l.address, l.angle].filter(Boolean).join(" — ")}>
                    {l.party}{l.address ? ` · ${l.address}` : ""}
                  </Badge>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
              {signal.sender && <span>From {signal.sender}</span>}
              <span>Received {format(new Date(signal.created_at), "MMM d")}</span>
              {signal.source_url && (
                <a href={signal.source_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {isError && <span>Lead extraction unavailable</span>}
            </div>
          </div>
          {!archived && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" disabled={enriching}
                onClick={() => onCreateLeads(signal, leads)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                {count > 1 ? `Create ${count} leads` : "Create leads"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onArchive(signal.id)} disabled={archiving}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archive
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BdMarketSignals({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = profile?.company_id;
  const [tab, setTab] = useState<"NEW" | "ARCHIVED">("NEW");
  const [queue, setQueue] = useState<LeadQueue | null>(null);

  const { data: signals, isLoading } = useQuery({
    queryKey: ["bd-market-signals", companyId, tab],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_market_signals" as any)
        .select("*")
        .eq("company_id", companyId!)
        .eq("status", tab)
        .order("signal_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown) as MarketSignal[]) || [];
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bd_market_signals" as any)
        .update({ status: "ARCHIVED" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bd-market-signals"] });
      toast({ title: "Archived" });
    },
  });

  const startQueue = (signal: MarketSignal, leads: SignalLead[]) => {
    // Fall back to a single lead seeded from the signal itself when Beacon found none.
    const list: SignalLead[] = leads.length > 0
      ? leads
      : [{ party: signal.title, address: null, angle: null, deal_type: null }];
    setQueue({ signal, leads: list, index: 0 });
  };

  const current = queue ? queue.leads[queue.index] : null;
  const currentDefaults = queue && current
    ? {
        company: current.party,
        fullName: current.party,
        subject: current.angle ?? current.deal_type ?? undefined,
        propertyAddress: current.address ?? undefined,
        notes: buildSignalLeadNotes(current, queue.signal.summary),
        source: "Market Signal",
        sourceType: "OTHER" as const,
        marketSignalId: queue.signal.id,
      }
    : undefined;

  const advanceOrFinish = async (leadId?: string) => {
    if (!queue) return;
    const next = queue.index + 1;
    if (next < queue.leads.length) {
      setQueue({ ...queue, index: next });
      return;
    }
    const signalId = queue.signal.id;
    setQueue(null);
    await supabase
      .from("bd_market_signals" as any)
      .update({ status: "ARCHIVED" })
      .eq("id", signalId);
    await qc.invalidateQueries({ queryKey: ["bd-market-signals"] });
    if (leadId) navigate(`/bd/leads/${leadId}`);
  };

  const Shell = embedded ? Fragment : AppLayout;
  return (
    <Shell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound market news classified by Beacon, with the leads it found inside each story.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "NEW" | "ARCHIVED")}>
          <TabsList>
            <TabsTrigger value="NEW">New</TabsTrigger>
            <TabsTrigger value="ARCHIVED">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !signals || signals.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <div className="font-medium">No {tab.toLowerCase()} signals</div>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                When Beacon's poller classifies an email as market news, it will appear here automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {signals.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                archived={tab === "ARCHIVED"}
                onArchive={(id) => archive.mutate(id)}
                archiving={archive.isPending}
                onCreateLeads={startQueue}
              />
            ))}
          </div>
        )}
      </div>
      <CaptureLeadModal
        key={queue ? `${queue.signal.id}-${queue.index}` : "closed"}
        open={!!queue}
        onOpenChange={(open) => { if (!open) setQueue(null); }}
        defaultValues={currentDefaults}
        onCreated={(leadId) => { void advanceOrFinish(leadId); }}
      />
    </Shell>
  );
}
