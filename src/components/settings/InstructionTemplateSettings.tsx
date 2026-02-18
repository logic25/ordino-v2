import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Save, FileText, Pencil, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCompanySettings, useUpdateCompanySettings, type InstructionTemplate } from "@/hooks/useCompanySettings";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_TEMPLATES: InstructionTemplate[] = [
  {
    id: "default-dob-registration",
    name: "DOB Registration",
    description: "Instructions for building owners to create a DOB NOW account",
    body: `Dear {{OWNER_NAME}},

We need you to create a DOB NOW account so you can sign and pay for the filing(s) on your property.

Please go to: https://a810-bisweb.nyc.gov/bisweb/

1. Click "Create Account"
2. Use your legal name as it appears on the deed
3. Once registered, please email us your DOB NOW username

If you already have an account, just send us the username and we'll proceed.

Thank you,
{{COMPANY_NAME}}`,
    variables: ["OWNER_NAME", "COMPANY_NAME"],
  },
  {
    id: "default-esign-standard",
    name: "DOB E-Sign (Standard)",
    description: "Instructions for owner to e-sign and pay on a single application",
    body: `Dear {{OWNER_NAME}},

Your application {{JOB_NUMBER}} is ready for your signature and payment on DOB NOW.

Please log in to DOB NOW and:
1. Go to "Jobs to Sign"
2. Find job {{JOB_NUMBER}}
3. Review the application details
4. Sign electronically
5. Pay the filing fee ({{FILING_FEE}} estimated)

Please complete this within 48 hours so we can proceed with filing.

Thank you,
{{COMPANY_NAME}}`,
    variables: ["OWNER_NAME", "JOB_NUMBER", "FILING_FEE", "COMPANY_NAME"],
  },
  {
    id: "default-esign-supersede",
    name: "DOB E-Sign (Supersede)",
    description: "Instructions for owner to sign multiple supersede applications",
    body: `Dear {{OWNER_NAME}},

We have {{APP_COUNT}} supersede applications ready for your signature on DOB NOW.

Job Numbers: {{JOB_NUMBERS}}

Please log in to DOB NOW and sign each application under "Jobs to Sign." Each one will require a separate signature.

Note: Only signature is needed — there is no additional filing fee for supersedes.

Please complete this at your earliest convenience.

Thank you,
{{COMPANY_NAME}}`,
    variables: ["OWNER_NAME", "APP_COUNT", "JOB_NUMBERS", "COMPANY_NAME"],
  },
];

export function InstructionTemplateSettings() {
  const { data: companyData, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<InstructionTemplate[]>([]);
  const [editDialog, setEditDialog] = useState<InstructionTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    if (companyData?.settings) {
      const saved = companyData.settings.instruction_templates;
      setTemplates(saved && saved.length > 0 ? saved : DEFAULT_TEMPLATES);
    }
  }, [companyData]);

  const extractVariables = (body: string): string[] => {
    const matches = body.match(/\{\{([A-Z_]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];
  };

  const openEdit = (template: InstructionTemplate | null) => {
    if (template) {
      setEditName(template.name);
      setEditDesc(template.description);
      setEditBody(template.body);
      setEditDialog(template);
    } else {
      setEditName("");
      setEditDesc("");
      setEditBody("");
      setEditDialog({ id: crypto.randomUUID(), name: "", description: "", body: "", variables: [] });
    }
  };

  const saveEdit = () => {
    if (!editDialog || !editName.trim()) return;
    const updated: InstructionTemplate = {
      ...editDialog,
      name: editName,
      description: editDesc,
      body: editBody,
      variables: extractVariables(editBody),
    };
    const exists = templates.find(t => t.id === updated.id);
    if (exists) {
      setTemplates(templates.map(t => t.id === updated.id ? updated : t));
    } else {
      setTemplates([...templates, updated]);
    }
    setEditDialog(null);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    if (!companyData?.companyId) return;
    try {
      await updateSettings.mutateAsync({
        companyId: companyData.companyId,
        settings: { instruction_templates: templates },
      });
      toast({ title: "Templates saved", description: "Instruction templates have been updated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Instruction Templates
          </CardTitle>
          <CardDescription>
            Reusable email templates for common instructions. Use {"{{VARIABLE}}"} syntax for auto-fill fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates defined yet.</p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{template.name}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {template.variables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px] font-mono">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(template)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTemplate(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" onClick={() => openEdit(null)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Template
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Templates</>
          )}
        </Button>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editDialog?.name ? "Edit Template" : "New Template"}</DialogTitle>
            <DialogDescription>
              Use {"{{VARIABLE_NAME}}"} in the body for auto-fill fields like job numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g., DOB E-Sign Instructions" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Brief description of when to use this template" />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={10} placeholder="Dear {{OWNER_NAME}},..." className="font-mono text-sm" />
              {editBody && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">Variables detected:</span>
                  {extractVariables(editBody).map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px] font-mono">{v}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={!editName.trim()}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
