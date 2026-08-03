import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { ProjectEmailsTab } from "@/components/emails/ProjectEmailsTab";
import { ComposeEmailDialog } from "@/components/emails/ComposeEmailDialog";

export function EmailsFullLive({ projectId }: { projectId: string }) {
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
    </div>
  );
}
