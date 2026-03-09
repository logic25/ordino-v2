import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObjectionItem } from "@/hooks/useObjectionItems";

interface WorkStateMap {
  [id: string]: {
    responseDraft?: string | null;
    pmNotes?: string;
    cleanedVersion?: string | null;
  };
}

interface ObjectionSummaryViewProps {
  open: boolean;
  objections: ObjectionItem[];
  workStates: WorkStateMap;
  onClose: () => void;
  onSendAll: () => void;
  onSaveToDocs: () => void;
  isSaving?: boolean;
}

export function ObjectionSummaryView({ open, objections, workStates, onClose, onSendAll, onSaveToDocs, isSaving }: ObjectionSummaryViewProps) {
  // Get response from workState first, then DB
  const getResponse = (obj: ObjectionItem): string => {
    const ws = workStates[obj.id];
    return ws?.responseDraft || ws?.cleanedVersion || ws?.pmNotes || obj.response_draft || obj.resolution_notes || "";
  };

  const addressed = objections.filter((o) => getResponse(o).trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <div className="flex items-center justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-sm font-semibold">Objection Response Preview</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {addressed.length} of {objections.length} objections have responses
              </DialogDescription>
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
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-4">
            {objections.map((obj, idx) => {
              const response = getResponse(obj);
              return (
                <div key={obj.id}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <div className="space-y-2">
                    {/* Objection header */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-muted-foreground">#{obj.item_number}</span>
                      {obj.code_reference && (
                        <Badge variant="outline" className="text-xs font-mono px-1.5 py-0">{obj.code_reference}</Badge>
                      )}
                    </div>
                    {/* Objection text */}
                    <p className="text-sm text-muted-foreground italic">{obj.objection_text}</p>
                    {/* Response */}
                    {response ? (
                      <div className="bg-muted/30 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap border">
                        {response}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">No response drafted yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
