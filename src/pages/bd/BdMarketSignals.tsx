import { useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ExternalLink, Inbox, Sparkles, ChevronRight } from "lucide-react";
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
  MarketSignalDetailSheet, type MarketSignal,
} from "@/components/bd/MarketSignalDetailSheet";
import { buildSignalLeadNotes, type SignalLead } from "@/services/signalEnrichment";

function cachedCount(signal: MarketSignal): number | null {
  const raw: any = signal.enrichment;
  if (!raw) return null;
  const leads = Array.isArray(raw) ? raw : Array.isArray(raw?.leads) ? raw.leads : null;
  return leads ? leads.length : null;
}

function SignalCard({
  signal, archived, onArchive, archiving, onOpen,
}: {
  signal: MarketSignal;
  archived: boolean;
  onArchive: (id: string) => void;
  archiving: boolean;
  onOpen: (signal: MarketSignal) => void;
}) {
  const count = cachedCount(signal);

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/40"
      onClick={() => onOpen(signal)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(signal);
        }
      }}
    >
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
              {count != null && count > 0 && (
                <Badge className="font-normal shrink-0 whitespace-nowrap gap-1">
                  <Sparkles className="h-3 w-3" />
                  {count} {count === 1 ? "opportunity" : "opportunities"}
                </Badge>
              )}
            </div>
            {signal.summary && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                {signal.summary}
              </p>
            )}
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
              {signal.sender && <span>From {signal.sender}</span>}
              <span>Received {format(new Date(signal.created_at), "MMM d")}</span>
              {signal.source_url && (
                <a href={signal.source_url} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-primary hover:underline">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!archived && (
              <Button size="sm" variant="ghost" disabled={archiving}
                onClick={(e) => { e.stopPropagation(); onArchive(signal.id); }}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archive
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
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
  const [detail, setDetail] = useState<MarketSignal | null>(null);
  const [promote, setPromote] = useState<{ signal: MarketSignal; lead: SignalLead } | null>(null);

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

  const promoteDefaults = promote
    ? {
        company: promote.lead.party,
        fullName: undefined,
        subject: promote.lead.deal_type ?? undefined,
        propertyAddress: promote.lead.address ?? undefined,
        notes: buildSignalLeadNotes(promote.lead, promote.signal.summary),
        source: "Market Signal",
        sourceType: "OTHER" as const,
        marketSignalId: promote.signal.id,
      }
    : undefined;

  const Shell = embedded ? Fragment : AppLayout;
  return (
    <Shell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound market news. Open a signal to see the named opportunities Beacon found inside
            the story, then promote the ones worth chasing.
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
                onOpen={setDetail}
              />
            ))}
          </div>
        )}
      </div>

      <MarketSignalDetailSheet
        signal={detail}
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        onPromote={(signal, lead) => setPromote({ signal, lead })}
      />

      <CaptureLeadModal
        key={promote ? `${promote.signal.id}-${promote.lead.party}` : "closed"}
        open={!!promote}
        onOpenChange={(open) => { if (!open) setPromote(null); }}
        defaultValues={promoteDefaults}
        onCreated={(leadId) => {
          setPromote(null);
          void qc.invalidateQueries({ queryKey: ["bd-market-signals"] });
          if (leadId) navigate(`/bd/leads/${leadId}`);
        }}
      />
    </Shell>
  );
}
