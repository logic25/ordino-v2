import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "amber" | "blue" | "green" | "purple" | "red";

const TONES: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  red: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
};

// Beacon-style KPI card: tinted icon chip + big mono amber number + label.
export function StatCard({
  icon: Icon, value, label, tone = "amber",
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
  tone?: Tone;
}) {
  return (
    <Card className="p-3.5 flex items-start gap-3">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", TONES[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-xl font-semibold text-accent leading-none tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </Card>
  );
}
