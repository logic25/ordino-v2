import { Info } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * TableHead with an inline info tooltip. Use inside a TooltipProvider.
 * Example:
 *   <THWT tip="What this column means">Status</THWT>
 */
export function THWT({
  children,
  tip,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  tip: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const justify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <span className={cn("inline-flex items-center gap-1", justify)}>
        {children}
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors"
              aria-label="What is this?"
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
            {tip}
          </TooltipContent>
        </Tooltip>
      </span>
    </TableHead>
  );
}
