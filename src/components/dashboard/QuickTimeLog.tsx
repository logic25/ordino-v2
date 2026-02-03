import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const quickActions = [
  { label: "Called DOB", duration: "15m", icon: "📞" },
  { label: "Emailed Client", duration: "10m", icon: "📧" },
  { label: "Reviewed Plans", duration: "30m", icon: "📋" },
  { label: "Site Visit", duration: "60m", icon: "🏗️" },
];

interface QuickTimeLogProps {
  onQuickLog?: (action: string, minutes: number) => void;
}

export function QuickTimeLog({ onQuickLog }: QuickTimeLogProps) {
  const handleQuickLog = (action: string, durationStr: string) => {
    const minutes = parseInt(durationStr.replace("m", ""), 10);
    // TODO: Implement actual time logging
    console.log("Quick log:", action, minutes, "minutes");
    onQuickLog?.(action, minutes);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Log</CardTitle>
        <CardDescription>Log time with a single tap</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            className="quick-action w-full"
            onClick={() => handleQuickLog(action.label, action.duration)}
          >
            <span className="text-xl">{action.icon}</span>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.duration}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
          </button>
        ))}
        <Button variant="outline" className="w-full mt-2">
          Custom Entry...
        </Button>
      </CardContent>
    </Card>
  );
}
