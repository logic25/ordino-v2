import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Clock, AlertCircle, Mail, Save, FileText, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObjectionItem } from "@/hooks/useObjectionItems";

type ObjectionStatus = "pending" | "in_progress" | "resolved";

const statusConfig: Record<ObjectionStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: { label: "Open", icon: AlertCircle, className: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  resolved: { label: "Resolved", icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
};

interface ObjectionSummaryViewProps {
  objections: ObjectionItem[];
  onClose: () => void;
  onSendAll: () => void;
  onSaveToDocs: () => void;
  isSaving?: boolean;
}

export function ObjectionSummaryView({ objections, onClose, onSendAll, onSaveToDocs, isSaving }: ObjectionSummaryViewProps) {
  const addressed = objections.filter((o) => o.resolution_notes || o.response_draft);
  const unaddressed = objections.filter((o) => !o.resolution_notes && !o.response_draft);
  const resolvedCount = objections.filter((o) => o.status === "resolved").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between bg-muted/20">
        <div>
          <h3 className="text-sm font-semibold">Response Summary</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {addressed.length} of {objections.length} addressed · {resolvedCount} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onSaveToDocs}
            disabled={addressed.length === 0 || isSaving}
          >
            <Save className="h-3.5 w-3.5" />
            Save to Docs
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onSendAll}
            disabled={addressed.length === 0}
          >
            <Mail className="h-3.5 w-3.5" />
            Send to Architect
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Addressed objections */}
          {addressed.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Addressed ({addressed.length})
              </h4>
              <div className="space-y-3">
                {addressed.map((obj) => (
                  <SummaryCard key={obj.id} objection={obj} />
                ))}
              </div>
            </div>
          )}

          {addressed.length > 0 && unaddressed.length > 0 && <Separator />}

          {/* Unaddressed objections */}
          {unaddressed.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Not Yet Addressed ({unaddressed.length})
              </h4>
              <div className="space-y-2">
                {unaddressed.map((obj) => {
                  const status = (obj.status || "pending") as ObjectionStatus;
                  const cfg = statusConfig[status];
                  const Icon = cfg.icon;
                  return (
                    <div key={obj.id} className="p-2 rounded border border-dashed border-border bg-muted/10 flex items-start gap-2">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", cfg.className)} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-muted-foreground">#{obj.item_number}</span>
                          {obj.code_reference && (
                            <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">{obj.code_reference}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{obj.objection_text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SummaryCard({ objection }: { objection: ObjectionItem }) {
  const status = (objection.status || "pending") as ObjectionStatus;
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  const responseText = objection.response_draft || objection.resolution_notes || "";

  return (
    <div className="rounded-lg border bg-background p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.className)} />
        <span className="text-xs font-mono text-muted-foreground">#{objection.item_number}</span>
        {objection.code_reference && (
          <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">{objection.code_reference}</Badge>
        )}
        <span className={cn("ml-auto text-[10px] font-semibold", cfg.className)}>{cfg.label}</span>
      </div>
      <p className="text-xs text-muted-foreground italic">{objection.objection_text}</p>
      {responseText && (
        <div className="bg-muted/30 rounded p-2 text-sm leading-snug whitespace-pre-wrap">
          {responseText}
        </div>
      )}
    </div>
  );
}
