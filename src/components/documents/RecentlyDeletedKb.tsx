import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { syncDocumentToBeacon } from "@/services/beaconApi";
import { useToast } from "@/hooks/use-toast";

interface DeletedDoc {
  id: string;
  source_file: string;
  content: string | null;
  deleted_at: string;
}

/**
 * Lists KB docs that were deleted (backed up by Beacon before removal) and lets a
 * member restore them — re-ingests the content and clears the backup. The "restore
 * if something's wrong" guarantee, extended to deletes.
 */
export function RecentlyDeletedKb() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data = [], refetch } = useQuery({
    queryKey: ["kb-deleted-documents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kb_deleted_documents")
        .select("id, source_file, content, deleted_at")
        .order("deleted_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DeletedDoc[];
    },
  });

  if (!data.length) return null;

  const restore = async (d: DeletedDoc) => {
    setBusy(d.id);
    try {
      const content = d.content || "";
      const m = content.match(/(?:^|\n)category:\s*([^\n]+)/);
      const folder = m?.[1]?.trim() || "Beacon Knowledge Base";
      const blob = new Blob([content], { type: "text/markdown" });
      const file = new File([blob], `${d.source_file}.md`, { type: "text/markdown" });
      await syncDocumentToBeacon(file, file.name, folder);
      await (supabase as any).from("kb_deleted_documents").delete().eq("id", d.id);
      toast({ title: `Restored "${d.source_file}"`, description: "Re-ingested into the knowledge base." });
      refetch();
      qc.invalidateQueries({ queryKey: ["beacon-knowledge"] });
    } catch (e: any) {
      toast({ title: "Restore failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const purge = async (d: DeletedDoc) => {
    await (supabase as any).from("kb_deleted_documents").delete().eq("id", d.id);
    refetch();
  };

  return (
    <Accordion type="single" collapsible className="mt-4">
      <AccordionItem value="deleted" className="border rounded-md bg-muted/30">
        <AccordionTrigger className="px-3 text-sm">
          Recently deleted ({data.length}) — restorable
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-2 space-y-1">
          {data.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-2">
              <div className="min-w-0">
                <div className="truncate">{d.source_file}</div>
                <div className="text-xs text-muted-foreground">
                  Deleted {format(new Date(d.deleted_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" disabled={busy === d.id} onClick={() => restore(d)}>
                  {busy === d.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore</>
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => purge(d)} title="Remove from this list">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
