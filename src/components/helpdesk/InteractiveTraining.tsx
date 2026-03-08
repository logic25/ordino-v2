import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Navigation, Receipt, Mail, Settings, FolderKanban, FileText, GitBranch, Brain, CreditCard, FileSearch, Clock, ExternalLink } from "lucide-react";
import { useWalkthrough } from "@/components/walkthrough/WalkthroughProvider";
import { WALKTHROUGHS } from "@/components/walkthrough/walkthroughs";
import { useNavigate } from "react-router-dom";

type WalkthroughWithPath = typeof WALKTHROUGHS[0];

const TOUR_ICONS: Record<string, React.ElementType> = {
  "getting-started": Navigation,
  "projects-workflow": FolderKanban,
  "proposals-workflow": FileText,
  "billing-workflow": Receipt,
  "email-calendar": Mail,
  "settings-overview": Settings,
  "change-orders-workflow": GitBranch,
  "ai-stress-test": Brain,
  "ai-collections": CreditCard,
  "ai-plan-analysis": FileSearch,
};

const TOUR_DESCRIPTIONS: Record<string, string> = {
  "getting-started": "Learn the basics — navigation, dashboard, search, and notifications.",
  "projects-workflow": "See how projects, proposals, and billing connect.",
  "proposals-workflow": "Create proposals, capture leads, and track your pipeline.",
  "billing-workflow": "Walk through invoicing, time tracking, and client management.",
  "email-calendar": "Learn email integration and calendar features.",
  "settings-overview": "Explore settings and reporting options.",
  "change-orders-workflow": "Create, sign, and approve change orders inside projects.",
  "ai-stress-test": "Run AI analysis on roadmap items to surface risks and evidence.",
  "ai-collections": "Use AI to score payment risk and generate personalized collection messages.",
  "ai-plan-analysis": "Upload architectural plans and let AI extract scope for proposals. Discover and build RFP responses with AI.",
};

type Difficulty = "beginner" | "intermediate" | "advanced";

interface TrainingMeta {
  difficulty: Difficulty;
  estimatedMinutes: number;
  videoUrl?: string;
}

const TOUR_META: Record<string, TrainingMeta> = {
  "getting-started": { difficulty: "beginner", estimatedMinutes: 2 },
  "projects-workflow": { difficulty: "beginner", estimatedMinutes: 3 },
  "proposals-workflow": { difficulty: "beginner", estimatedMinutes: 2 },
  "billing-workflow": { difficulty: "intermediate", estimatedMinutes: 3 },
  "email-calendar": { difficulty: "beginner", estimatedMinutes: 2 },
  "settings-overview": { difficulty: "beginner", estimatedMinutes: 2 },
  "change-orders-workflow": { difficulty: "intermediate", estimatedMinutes: 4 },
  "ai-stress-test": { difficulty: "advanced", estimatedMinutes: 5 },
  "ai-collections": { difficulty: "advanced", estimatedMinutes: 4 },
  "ai-plan-analysis": { difficulty: "advanced", estimatedMinutes: 5 },
};

const DIFFICULTY_STYLES: Record<Difficulty, { label: string; className: string }> = {
  beginner: { label: "Beginner", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  intermediate: { label: "Intermediate", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  advanced: { label: "Advanced", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export function InteractiveTraining() {
  const { startWalkthrough } = useWalkthrough();
  const navigate = useNavigate();

  const handleStart = (wt: WalkthroughWithPath) => {
    const path = wt.startPath || "/dashboard";
    navigate(path);
    setTimeout(() => startWalkthrough(wt), 800);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click any training module to start an interactive walkthrough. You'll be taken directly to the relevant page with each feature highlighted and explained.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(WALKTHROUGHS as WalkthroughWithPath[]).map((wt) => {
          const Icon = TOUR_ICONS[wt.id] || Play;
          const meta = TOUR_META[wt.id] || { difficulty: "beginner" as Difficulty, estimatedMinutes: 2 };
          const diffStyle = DIFFICULTY_STYLES[meta.difficulty];
          return (
            <Card key={wt.id} className="card-hover flex flex-col">
              <CardContent className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground">{wt.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-medium ${diffStyle.className}`}>
                        {diffStyle.label}
                      </Badge>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        ~{meta.estimatedMinutes} min
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · {wt.steps.length} steps
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-3 flex-1">
                  {TOUR_DESCRIPTIONS[wt.id] || "Guided walkthrough of this feature."}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleStart(wt)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start Training
                  </Button>
                  {meta.videoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      asChild
                    >
                      <a href={meta.videoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Video
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
