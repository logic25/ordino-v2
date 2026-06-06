import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BdPlaceholderProps {
  title: string;
  sprint: number;
  description: string;
  icon?: LucideIcon;
}

export function BdPlaceholder({ title, sprint, description, icon: Icon = Construction }: BdPlaceholderProps) {
  return (
    <Card className="max-w-2xl mx-auto mt-12">
      <CardContent className="flex flex-col items-center text-center gap-4 p-12">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm font-medium text-primary">Coming in Sprint {sprint}</p>
          <p className="text-sm text-muted-foreground max-w-md">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
