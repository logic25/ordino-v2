import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Settings2, Loader2, Radar, Target,
  Calendar, DollarSign, Building2, ExternalLink, Sparkles, Eye, Ban, User,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useDiscoveredRfps, useRfpSources, useTriggerRfpScan, type DiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { useUpdateDiscoveredRfp } from "@/hooks/useDiscoveredRfps";
import { DiscoveryDetailSheet } from "@/components/rfps/DiscoveryDetailSheet";
import { MonitoringSettingsDialog } from "@/components/rfps/MonitoringSettingsDialog";
import { useCreateRfp } from "@/hooks/useRfps";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Rfp } from "@/hooks/useRfps";

type StatusTab = "all" | "new" | "reviewing" | "preparing" | "passed" | "mine";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge variant="outline" className="text-xs">—</Badge>;
  const color = score >= 80 ? "text-success bg-success/10 border-success/30"
    : score >= 60 ? "text-warning bg-warning/10 border-warning/30"
    : "text-destructive bg-destructive/10 border-destructive/30";
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant="outline" className={`tabular-nums font-bold ${color}`}>
          {score}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px] text-xs">
        <p className="font-semibold">Relevance Score</p>
        <p className="text-muted-foreground">AI-rated match (0–100) based on your services and keywords</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function RfpDiscovery() {
  const navigate = useNavigate();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [selectedRfpId, setSelectedRfpId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();

  const { data: allRfps = [], isLoading } = useDiscoveredRfps(statusTab === "all" || statusTab === "mine" ? undefined : statusTab);
  const rfps = statusTab === "mine" ? allRfps.filter((r) => r.assigned_to === profile?.id) : allRfps;
  // Keep selectedRfp in sync with latest query data
  const selectedRfp = useMemo(() => selectedRfpId ? allRfps.find(r => r.id === selectedRfpId) || null : null, [selectedRfpId, allRfps]);
  const { data: sources = [] } = useRfpSources();
  const scan = useTriggerRfpScan();
  const updateRfp = useUpdateDiscoveredRfp();
  const createRfp = useCreateRfp();

  const activeSources = sources.filter((s) => s.active).length;
  const lastChecked = sources
    .filter((s) => s.last_checked_at)
    .sort((a, b) => new Date(b.last_checked_at!).getTime() - new Date(a.last_checked_at!).getTime())[0];

  const newCount = allRfps.filter((r) => r.status === "new").length;
  const reviewingCount = allRfps.filter((r) => r.status === "reviewing").length;
  const myCount = allRfps.filter((r) => r.assigned_to === profile?.id).length;

  const [respondingId, setRespondingId] = useState<string | null>(null);

  const handleGenerateResponse = async (discovered: DiscoveredRfp) => {
    if (respondingId) return;
    setRespondingId(discovered.id);
    try {
      const result = await createRfp.mutateAsync({
        title: discovered.title,
        rfp_number: discovered.rfp_number || null,
        agency: discovered.issuing_agency || null,
        status: "prospect",
        due_date: discovered.due_date,
        contract_value: discovered.estimated_value || null,
        notes: discovered.relevance_reason || null,
        discovered_from_id: discovered.id,
      });

      // Link discovered RFP to created RFP
      await updateRfp.mutateAsync({
        id: discovered.id,
        status: "preparing",
        rfp_id: (result as any).id,
      } as any);

      toast({ title: "RFP created", description: "Opening the RFP builder..." });
      navigate("/rfps");
    } catch (err: any) {
      console.error("Respond error:", err);
      toast({ title: "Error creating RFP", description: err.message, variant: "destructive" });
    } finally {
      setRespondingId(null);
    }
  };

  const handlePass = async (id: string) => {
    await updateRfp.mutateAsync({ id, status: "passed" } as any);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/rfps")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Radar className="h-6 w-6 text-accent" /> RFP Discovery
              </h1>
              <p className="text-muted-foreground text-sm">
                Monitoring {activeSources} source{activeSources !== 1 ? "s" : ""}
                {lastChecked?.last_checked_at && (
                  <> · Last checked {format(new Date(lastChecked.last_checked_at), "MMM d, h:mm a")}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Settings
            </Button>
            <Button
              size="sm"
              onClick={() => scan.mutate()}
              disabled={scan.isPending}
              className="glow-amber"
            >
              {scan.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Radar className="h-4 w-4 mr-1" />}
              Scan Now
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="card-hover">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">New</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{newCount}</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reviewing</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{reviewingCount}</p>
            </CardContent>
          </Card>
          <Card className="card-hover">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{rfps.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">
              New {newCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{newCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
            <TabsTrigger value="preparing">Preparing</TabsTrigger>
            <TabsTrigger value="passed">Passed</TabsTrigger>
            <TabsTrigger value="mine">
              <User className="h-3.5 w-3.5 mr-1" /> Mine {myCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">{myCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Listing */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rfps.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Radar className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No discovered RFPs yet.</p>
            <p className="text-sm text-muted-foreground">
              Click "Scan Now" to check procurement sources, or configure your sources in Settings.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rfps.map((rfp) => {
              const daysLeft = rfp.due_date ? differenceInDays(new Date(rfp.due_date), new Date()) : null;
              return (
                <Card key={rfp.id} className="card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <ScoreBadge score={rfp.relevance_score} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{rfp.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {rfp.issuing_agency && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> {rfp.issuing_agency}
                              </span>
                            )}
                            {rfp.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(rfp.due_date), "MMM d, yyyy")}
                                {daysLeft !== null && daysLeft >= 0 && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-4 ${daysLeft <= 7 ? "text-destructive border-destructive/30" : daysLeft <= 14 ? "text-warning border-warning/30" : ""}`}
                                  >
                                    {daysLeft}d
                                  </Badge>
                                )}
                              </span>
                            )}
                            {rfp.estimated_value && (
                              <span className="flex items-center gap-1 text-success tabular-nums">
                                <DollarSign className="h-3 w-3" />{rfp.estimated_value.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {rfp.service_tags && rfp.service_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {rfp.service_tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] h-4">
                                  {tag.replace(/_/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {rfp.relevance_reason && (
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                              {rfp.relevance_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => setSelectedRfpId(rfp.id)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Review
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={respondingId === rfp.id}
                          onClick={() => handleGenerateResponse(rfp)}
                        >
                          {respondingId === rfp.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />} Respond
                        </Button>
                        {rfp.status !== "passed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-muted-foreground"
                            onClick={() => handlePass(rfp.id)}
                          >
                            <Ban className="h-3.5 w-3.5" />
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

      <DiscoveryDetailSheet
        rfp={selectedRfp}
        open={!!selectedRfp}
        onOpenChange={(open) => !open && setSelectedRfpId(null)}
        onGenerateResponse={handleGenerateResponse}
      />

      <MonitoringSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </AppLayout>
  );
}
