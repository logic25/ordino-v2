import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Navigation, Receipt, Mail, Settings, FolderKanban, FileText, GitBranch, Brain, CreditCard, FileSearch } from "lucide-react";
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

export function InteractiveTraining() {
  const { startWalkthrough } = useWalkthrough();
  const navigate = useNavigate();

  const handleStart = (wt: WalkthroughWithPath) => {
    const path = wt.startPath || "/dashboard";
    navigate(path);
    // Give the page time to render before starting the walkthrough
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
          return (
            <Card key={wt.id} className="card-hover">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground">{wt.name}</h3>
                    <p className="text-xs text-muted-foreground">{wt.steps.length} steps</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {TOUR_DESCRIPTIONS[wt.id] || "Guided walkthrough of this feature."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleStart(wt)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Start Training
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
