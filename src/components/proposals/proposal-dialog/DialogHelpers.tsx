import React from "react";
import { Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

export function StepIndicator({ currentStep, steps }: { currentStep: number; steps: readonly { key: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
              i <= currentStep ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
            )}>
              {i < currentStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn(
              "text-xs font-medium hidden sm:inline",
              i === currentStep ? "text-foreground" : "text-muted-foreground"
            )}>{step.label}</span>
          </div>
          {i < steps.length - 1 && <div className={cn("w-8 h-px mx-1", i < currentStep ? "bg-accent" : "bg-border")} />}
        </React.Fragment>
      ))}
    </div>
  );
}
