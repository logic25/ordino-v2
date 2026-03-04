import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchBeaconFileContent } from "@/services/beaconApi";
import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onClose: () => void;
  sourceFile: string;
}

export function BeaconDocumentModal({ open, onClose, sourceFile }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    source_file: string;
    content: string;
    chunks: number;
    version?: number;
    is_current?: string;
    supersedes?: string;
    superseded_by?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !sourceFile) return;
    setLoading(true);
    setError(null);
    setData(null);

    fetchBeaconFileContent(sourceFile)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, sourceFile]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="truncate">{data?.source_file || sourceFile}</span>
            {data && (
              <>
                <Badge variant="secondary" className="text-[10px]">{data.chunks} chunks</Badge>
                {data.version != null && data.version > 1 && (
                  <Badge variant="outline" className="text-[10px]">v{data.version}</Badge>
                )}
                {data.is_current === "false" && (
                  <Badge className="bg-amber-500 text-white text-[10px]">Superseded</Badge>
                )}
              </>
            )}
          </DialogTitle>
          {data?.superseded_by && (
            <p className="text-xs text-amber-600">Replaced by: {data.superseded_by}</p>
          )}
          {data?.supersedes && (
            <p className="text-xs text-muted-foreground">Replaces: {data.supersedes}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: "70vh" }}>
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/50 mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          {data && (
            <div className="prose prose-sm max-w-none p-1 whitespace-pre-wrap text-sm leading-relaxed">
              <ReactMarkdown>{data.content}</ReactMarkdown>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
