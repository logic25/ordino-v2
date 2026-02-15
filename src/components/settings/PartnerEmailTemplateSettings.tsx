import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Mail, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  usePartnerEmailTemplates,
  useCreatePartnerEmailTemplate,
  useUpdatePartnerEmailTemplate,
  useDeletePartnerEmailTemplate,
} from "@/hooks/usePartnerEmailTemplates";

interface EditingTemplate {
  id?: string;
  name: string;
  template_key: string;
  subject_template: string;
  body_template: string;
  is_default: boolean;
}

const EMPTY: EditingTemplate = {
  name: "",
  template_key: "custom",
  subject_template: "",
  body_template: "",
  is_default: false,
};

export function PartnerEmailTemplateSettings() {
  const { data: templates = [], isLoading } = usePartnerEmailTemplates();
  const { data: companySettingsData } = useCompanySettings();
  const createTemplate = useCreatePartnerEmailTemplate();
  const updateTemplate = useUpdatePartnerEmailTemplate();
  const deleteTemplate = useDeletePartnerEmailTemplate();
  const { toast } = useToast();
  const [editing, setEditing] = useState<EditingTemplate | null>(null);

  const handleSave = async () => {
    if (!editing || !companySettingsData?.companyId) return;
    if (!editing.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    try {
      if (editing.id) {
        await updateTemplate.mutateAsync({
          id: editing.id,
          name: editing.name,
          template_key: editing.template_key,
          subject_template: editing.subject_template,
          body_template: editing.body_template,
          is_default: editing.is_default,
        });
        toast({ title: "Template updated" });
      } else {
        await createTemplate.mutateAsync({
          company_id: companySettingsData.companyId,
          name: editing.name,
          template_key: editing.template_key,
          subject_template: editing.subject_template,
          body_template: editing.body_template,
          is_default: editing.is_default,
          sort_order: templates.length,
        });
        toast({ title: "Template created" });
      }
      setEditing(null);
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Template deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Partner Outreach Templates
            </CardTitle>
            <CardDescription>
              Create email templates for different partner relationships. The system auto-selects based on history but you can override.
            </CardDescription>
          </div>
          {!editing && (
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="h-4 w-4 mr-1" /> Add Template
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Editing form */}
        {editing && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Template Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="e.g., Existing Partner Update"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Key (for auto-detect)</Label>
                  <Input
                    value={editing.template_key}
                    onChange={(e) => setEditing({ ...editing, template_key: e.target.value })}
                    placeholder="e.g., existing_partner"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use: new_partner, existing_partner, follow_up, or custom
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject Template</Label>
                <Input
                  value={editing.subject_template}
                  onChange={(e) => setEditing({ ...editing, subject_template: e.target.value })}
                  placeholder="e.g., Partnership Update: {{rfp_title}}"
                />
                <p className="text-[10px] text-muted-foreground">
                  Available variables: {"{{rfp_title}}, {{agency}}, {{company_name}}"}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body Template (HTML)</Label>
                <Textarea
                  value={editing.body_template}
                  onChange={(e) => setEditing({ ...editing, body_template: e.target.value })}
                  rows={8}
                  placeholder="Write your email template here. Use {{rfp_title}}, {{agency}}, {{due_date}}, {{company_name}}, {{services}}, {{response_buttons}} as placeholders."
                />
                <p className="text-[10px] text-muted-foreground">
                  {"{{response_buttons}}"} inserts I'm Interested / Pass buttons automatically
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.is_default}
                  onCheckedChange={(v) => setEditing({ ...editing, is_default: v })}
                />
                <Label className="text-xs">Default template for this key</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
                  <Save className="h-4 w-4 mr-1" /> {editing.id ? "Update" : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Template list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading templates...</p>
        ) : templates.length === 0 && !editing ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No templates yet. The system uses auto-generated emails by default.</p>
            <p className="text-xs mt-1">Create templates to customize outreach for different partner relationships.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{t.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{t.template_key}</Badge>
                    {t.is_default && <Badge variant="outline" className="text-[10px] text-primary">Default</Badge>}
                  </div>
                  {t.subject_template && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">Subject: {t.subject_template}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditing({
                      id: t.id,
                      name: t.name,
                      template_key: t.template_key,
                      subject_template: t.subject_template,
                      body_template: t.body_template,
                      is_default: t.is_default,
                    })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
