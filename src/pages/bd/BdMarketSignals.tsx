import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ExternalLink, UserPlus, Inbox } from "lucide-react";
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

export default function BdMarketSignals() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const companyId = profile?.company_id;
  const [tab, setTab] = useState<"NEW" | "ARCHIVED">("NEW");

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
      return (data || []) as MarketSignal[];
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

  const createLead = useMutation({
    mutationFn: async (s: MarketSignal) => {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_id: s.company_id,
          full_name: s.sender || s.title,
          source: "email",
          status: "new",
          notes: [s.title, s.summary, s.source_url].filter(Boolean).join("\n\n"),
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      // mark signal archived once it becomes a lead
      await supabase
        .from("bd_market_signals" as any)
        .update({ status: "ARCHIVED" })
        .eq("id", s.id);
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["bd-market-signals"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      navigate(`/bd/leads/${id}`);
    },
    onError: (e: any) =>
      toast({ title: "Could not create lead", description: e.message, variant: "destructive" }),
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market Signals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inbound market news classified by Beacon. Passive feed — no triage required.
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
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium leading-tight">{s.title}</h3>
                        {s.signal_date && (
                          <Badge variant="outline" className="font-normal">
                            {safeFormatDate(s.signal_date, "MMM d, yyyy")}
                          </Badge>
                        )}
                      </div>
                      {s.summary && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {s.summary}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
                        {s.sender && <span>From {s.sender}</span>}
                        <span>Received {format(new Date(s.created_at), "MMM d")}</span>
                        {s.source_url && (
                          <a
                            href={s.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {tab === "NEW" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => createLead.mutate(s)}
                          disabled={createLead.isPending}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                          Create lead
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => archive.mutate(s.id)}
                          disabled={archive.isPending}
                        >
                          <Archive className="h-3.5 w-3.5 mr-1.5" />
                          Archive
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
