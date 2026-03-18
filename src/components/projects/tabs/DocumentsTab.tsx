import { Badge } from "@/components/ui/badge";
import { File } from "lucide-react";
import type { MockDocument } from "../projectMockData";

export function DocumentsTab({ documents }: { documents: MockDocument[] }) {
  if (documents.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No documents uploaded.</p>;
  return (
    <div className="p-4 space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-background border">
          <div className="flex items-center gap-2 min-w-0">
            <File className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-medium truncate block">{doc.name}</span>
              <span className="text-[10px] text-muted-foreground">{doc.uploadedBy} · {doc.uploadedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.type}</Badge>
            <span>{doc.size}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
