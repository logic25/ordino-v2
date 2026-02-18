import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { SlidersHorizontal } from "lucide-react";

interface DashboardLayoutConfigProps {
  widgets: { id: string; label: string }[];
  visibility: Record<string, boolean>;
  onToggle: (widgetId: string) => void;
}

export function DashboardLayoutConfig({ widgets, visibility, onToggle }: DashboardLayoutConfigProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="text-xs font-semibold text-foreground mb-3">Show / Hide Widgets</p>
        <div className="space-y-2.5">
          {widgets.map((w) => (
            <label key={w.id} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-foreground">{w.label}</span>
              <Switch
                checked={visibility[w.id] !== false}
                onCheckedChange={() => onToggle(w.id)}
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
