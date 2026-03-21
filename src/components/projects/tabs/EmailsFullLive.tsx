import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { ProjectEmailsTab } from "@/components/emails/ProjectEmailsTab";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";
import type { MockEmail } from "@/components/projects/projectMockData";

export function EmailsFullLive({ projectId, projectName, mockEmails }: { projectId: string; projectName?: string; mockEmails: MockEmail[] }) {
  const [composeOpen, setComposeOpen] = useState(false);
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Tagged emails for this project — real-time from Gmail
        </h3>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setComposeOpen(true)}>
          <Mail className="h-3.5 w-3.5" /> Compose
        </Button>
      </div>
      <ProjectEmailsTab projectId={projectId} />

      <ComposeEmailDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        projectId={projectId}
      />

      {/* Mock fallback for demo */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
            <ChevronRight className="h-3 w-3" /> Show mock emails ({mockEmails.length})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-2">
          {mockEmails.map((em) => (
            <div key={em.id} className="flex items-start gap-4 p-3 rounded-lg bg-background border">
              <div className="shrink-0 mt-0.5">
                {em.direction === "inbound" ? <ArrowDownLeft className="h-4 w-4 text-blue-500" /> : <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{em.subject}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{em.date}</span>
                </div>
                <div className="text-sm text-muted-foreground">{em.from}</div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{em.snippet}</p>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
