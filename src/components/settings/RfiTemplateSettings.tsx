import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useRfiTemplates,
  useCreateRfiTemplate,
  useUpdateRfiTemplate,
  useDeleteRfiTemplate,
  DEFAULT_PIS_SECTIONS,
  type RfiSectionConfig,
  type RfiFieldConfig,
} from "@/hooks/useRfi";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Copy,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const FIELD_TYPES: { value: RfiFieldConfig["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "checkbox_group", label: "Checkbox Group" },
  { value: "work_type_picker", label: "Work Type Picker" },
  { value: "file_upload", label: "File Upload" },
  { value: "heading", label: "Section Heading" },
];

export function RfiTemplateSettings() {
  const { data: templates = [], isLoading } = useRfiTemplates();
  const createTemplate = useCreateRfiTemplate();
  const updateTemplate = useUpdateRfiTemplate();
  const deleteTemplate = useDeleteRfiTemplate();
  const { toast } = useToast();

  const [editingTemplate, setEditingTemplate] = useState<{
    id?: string;
    name: string;
    description: string;
    sections: RfiSectionConfig[];
    is_default: boolean;
  } | null>(null);

  const handleCreateFromDefault = () => {
    setEditingTemplate({
      name: "Project Information Sheet",
      description: "Standard project information questionnaire for clients",
      sections: JSON.parse(JSON.stringify(DEFAULT_PIS_SECTIONS)),
      is_default: true,
    });
  };

  const handleCreateBlank = () => {
    setEditingTemplate({
      name: "New Template",
      description: "",
      sections: [
        {
          id: crypto.randomUUID(),
          title: "Section 1",
          description: "",
          fields: [{ id: crypto.randomUUID(), label: "Field 1", type: "text", width: "full" }],
        },
      ],
      is_default: false,
    });
  };

  const handleEdit = (template: typeof templates[0]) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      description: template.description || "",
      sections: JSON.parse(JSON.stringify(template.sections)),
      is_default: template.is_default,
    });
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    try {
      if (editingTemplate.id) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          name: editingTemplate.name,
          description: editingTemplate.description,
          sections: editingTemplate.sections,
          is_default: editingTemplate.is_default,
        });
        toast({ title: "Template updated" });
      } else {
        await createTemplate.mutateAsync({
          name: editingTemplate.name,
          description: editingTemplate.description,
          sections: editingTemplate.sections,
          is_default: editingTemplate.is_default,
        });
        toast({ title: "Template created" });
      }
      setEditingTemplate(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Template deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const addSection = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: [
        ...editingTemplate.sections,
        {
          id: crypto.randomUUID(),
          title: `Section ${editingTemplate.sections.length + 1}`,
          description: "",
          fields: [{ id: crypto.randomUUID(), label: "New Field", type: "text", width: "full" }],
        },
      ],
    });
  };

  const removeSection = (sectionId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.filter((s) => s.id !== sectionId),
    });
  };

  const updateSection = (sectionId: string, updates: Partial<RfiSectionConfig>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  };

  const addField = (sectionId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: [...s.fields, { id: crypto.randomUUID(), label: "New Field", type: "text" as const, width: "full" as const }] }
          : s
      ),
    });
  };

  const removeField = (sectionId: string, fieldId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s
      ),
    });
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<RfiFieldConfig>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)) }
          : s
      ),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Template editor view
  if (editingTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setEditingTemplate(null)}>
            ← Back to Templates
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateTemplate.isPending || createTemplate.isPending}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {(updateTemplate.isPending || createTemplate.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                  placeholder="Optional description..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-2" defaultValue={editingTemplate.sections.map(s => s.id)}>
          {editingTemplate.sections.map((section, sIdx) => (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2 text-left">
                  <span className="font-medium">{section.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {section.fields.length} field{section.fields.length !== 1 ? "s" : ""}
                  </Badge>
                  {section.repeatable && (
                    <Badge variant="outline" className="text-xs">Repeatable</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Section Title</Label>
                    <Input
                      value={section.title}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Input
                      value={section.description || ""}
                      onChange={(e) => updateSection(section.id, { description: e.target.value })}
                      placeholder="Optional helper text..."
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={section.repeatable || false}
                      onCheckedChange={(checked) => updateSection(section.id, { repeatable: !!checked })}
                    />
                    <Label className="text-xs">Repeatable section</Label>
                  </div>
                  {section.repeatable && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Max repeats:</Label>
                      <Input
                        type="number"
                        className="w-16 h-7"
                        value={section.maxRepeat || 4}
                        onChange={(e) => updateSection(section.id, { maxRepeat: parseInt(e.target.value) || 4 })}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  {section.fields.map((field) => (
                    <div key={field.id} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(section.id, field.id, { label: e.target.value })}
                          placeholder="Field label"
                          className="h-8 text-sm"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(v) => updateField(section.id, field.id, { type: v as any })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((ft) => (
                              <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={field.width || "full"}
                          onValueChange={(v) => updateField(section.id, field.id, { width: v as any })}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Width</SelectItem>
                            <SelectItem value="half">Half Width</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={field.required || false}
                            onCheckedChange={(checked) => updateField(section.id, field.id, { required: !!checked })}
                          />
                          <Label className="text-xs">Required</Label>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-auto"
                            onClick={() => removeField(section.id, field.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => addField(section.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Field
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove Section
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove section?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{section.title}" and all its fields.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeSection(section.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Button variant="outline" onClick={addSection} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Section
        </Button>
      </div>
    );
  }

  // Template list view
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            RFI Templates
          </CardTitle>
          <CardDescription>
            Configure questionnaire templates that get sent to clients. Customize which fields to collect for each project type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No templates yet. Start with the default Project Information Sheet or create from scratch.
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={handleCreateFromDefault} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Copy className="h-4 w-4 mr-2" />
                  Start from PIS Template
                </Button>
                <Button variant="outline" onClick={handleCreateBlank}>
                  <Plus className="h-4 w-4 mr-2" />
                  Blank Template
                </Button>
              </div>
            </div>
          ) : (
            <>
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleEdit(template)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {template.is_default && <Badge variant="secondary">Default</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {template.sections.length} sections · {template.sections.reduce((sum, s) => sum + s.fields.length, 0)} fields
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(template); }}>
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete template?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCreateFromDefault}>
                  <Copy className="h-4 w-4 mr-2" />
                  From PIS Template
                </Button>
                <Button variant="outline" size="sm" onClick={handleCreateBlank}>
                  <Plus className="h-4 w-4 mr-2" />
                  Blank Template
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
