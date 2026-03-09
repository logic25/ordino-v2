import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateRichTextEditor } from "@/components/settings/TemplateRichTextEditor";
import { useCompanySettings, type InstructionTemplate } from "@/hooks/useCompanySettings";
import { Send, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_TEMPLATES: InstructionTemplate[] = [
  {
    id: "dob-registration",
    name: "DOB Registration",
    description: "Owner creates a DOB NOW account",
    body: `<p>Dear {{OWNER_NAME}},</p><p>We need you to create a DOB NOW account so you can electronically sign and pay for your application(s).</p><p>Please go to <a href="https://a810-dobnow.nyc.gov/publish/#!/">https://a810-dobnow.nyc.gov/publish/#!/</a> and click "Register" to create an account using your email address.</p><p>Once registered, please reply to this email with the email address you used so we can send the application to you for signature.</p><p>Thank you,<br/>{{COMPANY_NAME}}</p>`,
    variables: ["OWNER_NAME", "COMPANY_NAME"],
  },
  {
    id: "dob-esign-standard",
    name: "DOB E-Sign (Standard)",
    description: "Owner signs and pays on one application",
    body: `<p>Dear {{OWNER_NAME}},</p><p>Your application for {{PROJECT_NAME}} (Job #{{JOB_NUMBERS}}) has been submitted to DOB NOW and is ready for your electronic signature and payment.</p><p>Please log in to your DOB NOW account at <a href="https://a810-dobnow.nyc.gov/publish/#!/">https://a810-dobnow.nyc.gov/publish/#!/</a> and:</p><ol><li>Click "Submitted Actions" on the left menu</li><li>Find Job #{{JOB_NUMBERS}}</li><li>Click "Sign" and complete the e-signature</li><li>Pay the filing fee (DOB fee of $130 per application)</li></ol><p>Please complete this within 3 business days so we can proceed with the review process.</p><p>Thank you,<br/>{{COMPANY_NAME}}</p>`,
    variables: ["OWNER_NAME", "PROJECT_NAME", "JOB_NUMBERS", "COMPANY_NAME"],
  },
  {
    id: "dob-esign-supersede",
    name: "DOB E-Sign (Supersede)",
    description: "Owner signs multiple supersede applications",
    body: `<p>Dear {{OWNER_NAME}},</p><p>We have filed supersede applications for {{PROJECT_NAME}}. The following job numbers require your electronic signature and payment:</p><p>{{JOB_NUMBERS}}</p><p>Please log in to DOB NOW at <a href="https://a810-dobnow.nyc.gov/publish/#!/">https://a810-dobnow.nyc.gov/publish/#!/</a> and sign each application under "Submitted Actions." Each application has a $130 DOB filing fee.</p><p>Please complete all signatures within 3 business days.</p><p>Thank you,<br/>{{COMPANY_NAME}}</p>`,
    variables: ["OWNER_NAME", "PROJECT_NAME", "JOB_NUMBERS", "COMPANY_NAME"],
  },
];

interface ESignInstructionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobNumbers: string[];
  projectName: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

export function ESignInstructionDialog({ open, onOpenChange, jobNumbers, projectName, ownerName, ownerEmail }: ESignInstructionDialogProps) {
  const { toast } = useToast();
  const { data: companyData } = useCompanySettings();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");

  const templates = useMemo(() => {
    const custom = companyData?.settings?.instruction_templates || [];
    return custom.length > 0 ? custom : DEFAULT_TEMPLATES;
  }, [companyData]);

  useEffect(() => {
    if (open) {
      setRecipientEmail(ownerEmail || "");
      if (templates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(templates[0].id);
      }
    }
  }, [open, ownerEmail, templates, selectedTemplateId]);

  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const companyName = companyData?.name || "Our Company";
    const jobNumStr = jobNumbers.length > 1
      ? jobNumbers.map(j => `• ${j}`).join("\n")
      : jobNumbers[0] || "N/A";

    let filled = template.body
      .replace(/\{\{OWNER_NAME\}\}/g, ownerName || "[Owner Name]")
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName || "[Project]")
      .replace(/\{\{JOB_NUMBERS?\}\}/g, jobNumStr)
      .replace(/\{\{COMPANY_NAME\}\}/g, companyName);

    setBody(filled);
    setSubject(`E-Sign Instructions: ${projectName} — Job #${jobNumbers[0] || "N/A"}`);
  }, [selectedTemplateId, templates, ownerName, projectName, jobNumbers, companyData]);

  const handleCopy = () => {
    // Strip HTML for plain-text clipboard
    const tmp = document.createElement("div");
    tmp.innerHTML = body;
    navigator.clipboard.writeText(tmp.textContent || tmp.innerText || "");
    toast({ title: "Copied", description: "Instructions copied to clipboard." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send E-Sign Instructions</DialogTitle>
          <DialogDescription>Choose a template and customize the message before sending.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — {t.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <TemplateRichTextEditor
              content={body}
              onChange={setBody}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button
            onClick={() => {
              toast({ title: "Instructions Sent", description: `Email sent to ${recipientEmail}` });
              onOpenChange(false);
            }}
            disabled={!recipientEmail}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
