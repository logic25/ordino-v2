import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Navigation, Receipt, Mail, Settings, FolderKanban } from "lucide-react";
import { useWalkthrough } from "@/components/walkthrough/WalkthroughProvider";
import { WALKTHROUGHS } from "@/components/walkthrough/walkthroughs";
import { useNavigate } from "react-router-dom";

const TOUR_ICONS: Record<string, React.ElementType> = {
  "getting-started": Navigation,
  "projects-workflow": FolderKanban,
  "billing-workflow": Receipt,
  "email-calendar": Mail,
  "settings-overview": Settings,
};

const TOUR_DESCRIPTIONS: Record<string, string> = {
  "getting-started": "Learn the basics — navigation, dashboard, search, and notifications.",
  "projects-workflow": "See how projects, proposals, and billing connect.",
  "billing-workflow": "Walk through invoicing, time tracking, and client management.",
  "email-calendar": "Learn email integration and calendar features.",
  "settings-overview": "Explore settings and reporting options.",
};

export function InteractiveTraining() {
  const { startWalkthrough } = useWalkthrough();
  const navigate = useNavigate();

  const handleStart = (wt: typeof WALKTHROUGHS[0]) => {
    // Navigate to dashboard first so sidebar/dashboard targets are visible
    navigate("/dashboard");
    // Delay to let page render, then WalkthroughProvider will retry finding elements
    setTimeout(() => startWalkthrough(wt), 600);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Click any training module below to start an interactive walkthrough that highlights key features in the app.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WALKTHROUGHS.map((wt) => {
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
