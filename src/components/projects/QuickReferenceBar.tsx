import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Send, FileText } from "lucide-react";
import { ESignInstructionDialog } from "./ESignInstructionDialog";

interface DobApp {
  id: string;
  job_number: string | null;
  application_type: string | null;
  status: string | null;
}

interface QuickReferenceBarProps {
  applications: DobApp[];
  filingType?: string | null;
  projectId: string;
  projectName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

export function QuickReferenceBar({ applications, filingType, projectId, projectName, ownerName, ownerEmail }: QuickReferenceBarProps) {
  const { toast } = useToast();
  const [eSignOpen, setESignOpen] = useState(false);

  if (applications.length === 0) return null;

  const jobNumbers = applications
    .filter(a => a.job_number)
    .map(a => a.job_number!);

  const copyJobNumbers = () => {
    navigator.clipboard.writeText(jobNumbers.join(", "));
    toast({ title: "Copied", description: `${jobNumbers.length} job number(s) copied to clipboard.` });
  };

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap px-3 py-2.5 rounded-lg border bg-muted/30">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {jobNumbers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Job #:</span>
              {jobNumbers.map((jn) => (
                <Badge key={jn} variant="secondary" className="font-mono text-xs">{jn}</Badge>
              ))}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyJobNumbers}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
          {filingType && (
            <Badge variant="outline" className="text-xs">{filingType}</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs shrink-0" onClick={() => setESignOpen(true)}>
          <Send className="h-3 w-3" /> Send E-Sign Instructions
        </Button>
      </div>

      <ESignInstructionDialog
        open={eSignOpen}
        onOpenChange={setESignOpen}
        jobNumbers={jobNumbers}
        projectName={projectName}
        ownerName={ownerName}
        ownerEmail={ownerEmail}
      />
    </>
  );
}
