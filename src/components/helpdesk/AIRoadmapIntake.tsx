import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Brain, Sparkles, Loader2, AlertTriangle, CheckCircle2, ChevronRight,
  BarChart2, Lightbulb, AlertCircle, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface AISuggestion {
  title: string;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  evidence: string;
  duplicate_warning: string | null;
  challenges: string[];
}

interface AIRoadmapIntakeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-400",
  low: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_LABELS: Record<string, string> = {
  billing: "Billing",
  projects: "Projects",
  integrations: "Integrations",
  operations: "Operations",
  general: "General",
};

function SuggestionCard({
  suggestion,
  onAdd,
  onDismiss,
  adding,
}: {
  suggestion: AISuggestion;
  onAdd: () => void;
  onDismiss: () => void;
  adding: boolean;
}) {
  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2 justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="secondary" className="text-[10px] capitalize">
                {CATEGORY_LABELS[suggestion.category] || suggestion.category}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[suggestion.priority] || ""}`}>
                {suggestion.priority}
              </Badge>
              {suggestion.duplicate_warning && (
                <Badge variant="outline" className="text-[10px] text-warning border-warning/30 bg-warning/10">
                  <AlertCircle className="h-2.5 w-2.5 mr-1" />
                  Similar exists
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold leading-tight">{suggestion.title}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDismiss}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>

        {/* Evidence */}
        <div className="rounded-md bg-muted/50 border px-3 py-2">
          <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Evidence</p>
          <p className="text-xs leading-relaxed">{suggestion.evidence}</p>
        </div>

        {/* Duplicate warning */}
        {suggestion.duplicate_warning && (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
            <p className="text-[11px] text-warning font-medium mb-0.5">Similar roadmap item</p>
            <p className="text-xs text-warning">"{suggestion.duplicate_warning}"</p>
          </div>
        )}

        {/* Challenges */}
        {suggestion.challenges?.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground font-medium">Implementation challenges</p>
            <ul className="space-y-0.5">
              {suggestion.challenges.map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onAdd}
            disabled={adding}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
            Add to Roadmap
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIRoadmapIntake({ open, onOpenChange, companyId }: AIRoadmapIntakeProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Telemetry tab state
  const [analyzing, setAnalyzing] = useState(false);
  const [telemetrySuggestions, setTelemetrySuggestions] = useState<AISuggestion[]>([]);
  const [telemetryMessage, setTelemetryMessage] = useState("");
  const [telemetryRan, setTelemetryRan] = useState(false);

  // Idea tab state
  const [ideaText, setIdeaText] = useState("");
  const [analyzingIdea, setAnalyzingIdea] = useState(false);
  const [ideaSuggestions, setIdeaSuggestions] = useState<AISuggestion[]>([]);

  // Adding state
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const callAnalyze = async (mode: "telemetry" | "idea") => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const token = (await supabase.auth.getSession()).data.session?.access_token || "";

    const body: Record<string, unknown> = { mode, company_id: companyId };
    if (mode === "idea") body.raw_idea = ideaText.trim();

    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-telemetry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      if (res.status === 429) throw new Error("Rate limit exceeded. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted — please add credits to your workspace.");
      throw new Error(err.error || `Error ${res.status}`);
    }

    return res.json();
  };

  const handleAnalyzeTelemetry = async () => {
    setAnalyzing(true);
    setTelemetrySuggestions([]);
    setTelemetryMessage("");
    try {
      const result = await callAnalyze("telemetry");
      setTelemetrySuggestions(result.suggestions || []);
      setTelemetryRan(true);
      if (result.message) setTelemetryMessage(result.message);
      if (!result.suggestions?.length && !result.message) {
        setTelemetryMessage("No significant patterns found. Keep using the app and try again later.");
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeIdea = async () => {
    if (!ideaText.trim()) return;
    setAnalyzingIdea(true);
    setIdeaSuggestions([]);
    try {
      const result = await callAnalyze("idea");
      setIdeaSuggestions(result.suggestions || []);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzingIdea(false);
    }
  };

  const handleAddToRoadmap = async (suggestion: AISuggestion, idx: number, source: "telemetry" | "idea") => {
    setAddingIdx(idx);
    try {
      // Get max sort_order for "gap" status
      const { data: existing } = await supabase
        .from("roadmap_items")
        .select("sort_order")
        .eq("company_id", companyId)
        .eq("status", "gap")
        .order("sort_order", { ascending: false })
        .limit(1);

      const maxOrder = (existing?.[0] as any)?.sort_order ?? 0;

      const { error } = await supabase.from("roadmap_items").insert({
        company_id: companyId,
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        status: "gap",
        priority: suggestion.priority,
        sort_order: maxOrder + 1,
        stress_test_result: suggestion as any,
        stress_tested_at: new Date().toISOString(),
      } as any);

      if (error) throw error;

      toast({ title: "Added to roadmap", description: suggestion.title });
      queryClient.invalidateQueries({ queryKey: ["roadmap-items"] });

      // Remove from list
      if (source === "telemetry") {
        setTelemetrySuggestions((prev) => prev.filter((_, i) => i !== idx));
      } else {
        setIdeaSuggestions((prev) => prev.filter((_, i) => i !== idx));
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingIdx(null);
    }
  };

  const handleDismiss = (idx: number, source: "telemetry" | "idea") => {
    if (source === "telemetry") {
      setTelemetrySuggestions((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setIdeaSuggestions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Don't reset state so user can come back
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Roadmap Intake
          </DialogTitle>
          <DialogDescription>
            Analyze real user behavior to find friction, or stress-test a product idea.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="telemetry">
          <TabsList className="w-full">
            <TabsTrigger value="telemetry" className="flex-1">
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Analyze Behavior
            </TabsTrigger>
            <TabsTrigger value="idea" className="flex-1">
              <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
              Stress-Test an Idea
            </TabsTrigger>
          </TabsList>

          {/* ── Telemetry Tab ── */}
          <TabsContent value="telemetry" className="space-y-4 mt-4">
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">How this works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Scans the last 30 days of user behavior across all 12 modules. Detects drop-offs, repetition loops, dead zones, feature blindness, and error clusters. AI surfaces only patterns with concrete evidence.
              </p>
            </div>

            <Button
              onClick={handleAnalyzeTelemetry}
              disabled={analyzing}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing events across all modules…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {telemetryRan ? "Re-run Analysis" : "Run Analysis"}
                </>
              )}
            </Button>

            {telemetryMessage && !analyzing && (
              <div className="rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                {telemetryMessage}
              </div>
            )}

            {telemetrySuggestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{telemetrySuggestions.length} pattern{telemetrySuggestions.length !== 1 ? "s" : ""} found</p>
                  <p className="text-xs text-muted-foreground">Review and add relevant items to the roadmap</p>
                </div>
                {telemetrySuggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    onAdd={() => handleAddToRoadmap(s, i, "telemetry")}
                    onDismiss={() => handleDismiss(i, "telemetry")}
                    adding={addingIdx === i}
                  />
                ))}
              </div>
            )}

            {telemetryRan && telemetrySuggestions.length === 0 && !analyzing && !telemetryMessage && (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">All patterns reviewed. No gaps queued.</p>
              </div>
            )}
          </TabsContent>

          {/* ── Idea Tab ── */}
          <TabsContent value="idea" className="space-y-4 mt-4">
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">How this works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Describe a feature idea in plain English. AI refines it, scores priority against the app's domain context, surfaces implementation risks, and checks if it duplicates an existing roadmap item.
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Describe your product idea… e.g. 'Allow users to set up recurring invoices for retainer clients'"
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button
                onClick={handleAnalyzeIdea}
                disabled={analyzingIdea || !ideaText.trim()}
                className="w-full"
              >
                {analyzingIdea ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing idea…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Stress-Test This Idea
                  </>
                )}
              </Button>
            </div>

            {ideaSuggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Analysis result</p>
                {ideaSuggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    onAdd={() => handleAddToRoadmap(s, i, "idea")}
                    onDismiss={() => handleDismiss(i, "idea")}
                    adding={addingIdx === i}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
