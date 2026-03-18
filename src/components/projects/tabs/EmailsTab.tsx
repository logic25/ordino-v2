import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { MockEmail } from "../projectMockData";

export function EmailsTab({ emails }: { emails: MockEmail[] }) {
  if (emails.length === 0) return <p className="text-sm text-muted-foreground italic p-4">No tagged emails.</p>;
  return (
    <div className="p-4 space-y-2">
      {emails.map((em) => (
        <div key={em.id} className="flex items-start gap-3 py-2 px-3 rounded-md bg-background border">
          <div className="shrink-0 mt-1">
            {em.direction === "inbound" ? (
              <ArrowDownLeft className="h-4 w-4 text-blue-500" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-sm font-medium truncate">{em.subject}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{em.date}</span>
            </div>
            <div className="text-xs text-muted-foreground">{em.from}</div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{em.snippet}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
