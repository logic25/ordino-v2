import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain, Sparkles, Loader2, CheckCircle2, ChevronRight, AlertCircle,
  BarChart2, X, Radio, Clock, FileText, Users, Building2, Package, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

const TRACKED_MODULES = [
  { icon: Building2, label: "Clients & Contacts" },
  { icon: FileText, label: "Projects & Applications" },
  { icon: Package, label: "Proposals & Leads" },
  { icon: BarChart2, label: "Invoices & Billing" },
  { icon: Users, label: "Time & Attendance" },
  { icon: Calendar, label: "Calendar & Emails" },
  { icon: Radio, label: "Properties & Signals" },
  { icon: Clock, label: "RFPs & Reports" },
];

function SuggestionCard({
  suggestion, onAdd, onDismiss, adding,
}: {
  suggestion: AISuggestion;
  onAdd: () => void;
  onDismiss: () => void;
  adding: boolean;
}) {
  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
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
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border bg-muted">
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

        <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>

        <div className="rounded-md bg-muted/50 border px-3 py-2">
          <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Evidence</p>
          <p className="text-xs leading-relaxed">{suggestion.evidence}</p>
        </div>

        {suggestion.duplicate_warning && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Similar roadmap item</p>
            <p className="text-xs text-muted-foreground">"{suggestion.duplicate_warning}"</p>
          </div>
        )}

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

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAdd} disabled={adding} className="flex-1">
            {adding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
            Add to Roadmap
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>Dismiss</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIRoadmapIntake({ open, onOpenChange, companyId }: AIRoadmapIntakeProps) {
  const queryClient = useQueryClient();

  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [ran, setRan] = useState(false);
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setSuggestions([]);
    setMessage("");
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = (await supabase.auth.getSession()).data.session?.access_token || "";

      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-telemetry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ mode: "telemetry", company_id: companyId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        if (res.status === 429) throw new Error("Rate limit exceeded. Try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted.");
        throw new Error(err.error || `Error ${res.status}`);
      }

      const result = await res.json();
      setSuggestions(result.suggestions || []);
      setRan(true);
      if (result.message) setMessage(result.message);
      if (!result.suggestions?.length && !result.message) {
        setMessage("no_data");
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAddToRoadmap = async (suggestion: AISuggestion, idx: number) => {
    setAddingIdx(idx);
    try {
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
      setSuggestions((prev) => prev.filter((_, i) => i !== idx));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingIdx(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Analyze User Behavior
          </DialogTitle>
          <DialogDescription>
            Scan recent app usage patterns to automatically surface friction points, dead zones, and feature gaps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium">How this works</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Scans the last 30 days of user interactions across all modules. Detects drop-offs, repetition loops, dead zones, and error clusters — then surfaces only patterns with concrete evidence.
            </p>
            <div className="pt-1">
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Modules being tracked</p>
              <div className="grid grid-cols-2 gap-1">
                {TRACKED_MODULES.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3 text-primary/60" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
            {analyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning behavior across all modules…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> {ran ? "Re-run Analysis" : "Run Analysis"}</>
            )}
          </Button>

          {/* No-data empty state */}
          {ran && message === "no_data" && !analyzing && (
            <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">No patterns found yet</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Behavioral telemetry is collected as users interact with the live app. It typically takes <strong>5–7 days of real usage</strong> before meaningful patterns emerge.
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">What's being tracked (starting now)</p>
                <ul className="space-y-0.5">
                  {["Page visits and navigation paths", "Dialog opens, form submissions, button clicks", "Search queries and filter usage", "Tab switches and feature discovery", "Error encounters and retry patterns"].map((item) => (
                    <li key={item} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-primary/50 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                In the meantime, use <strong>Add Item → AI Stress-Test</strong> to analyze and add specific ideas to the roadmap.
              </p>
            </div>
          )}

          {/* Generic message */}
          {message && message !== "no_data" && !analyzing && (
            <div className="rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              {message}
            </div>
          )}

          {/* Results */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{suggestions.length} pattern{suggestions.length !== 1 ? "s" : ""} found</p>
                <p className="text-xs text-muted-foreground">Review and add relevant items to the roadmap</p>
              </div>
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  onAdd={() => handleAddToRoadmap(s, i)}
                  onDismiss={() => setSuggestions((prev) => prev.filter((_, j) => j !== i))}
                  adding={addingIdx === i}
                />
              ))}
            </div>
          )}

          {ran && suggestions.length === 0 && !analyzing && message !== "no_data" && !message && (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">All patterns reviewed.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
