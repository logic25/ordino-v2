import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useRfpContent, useCreateRfpContent, useUpdateRfpContent } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";

export function CompanyInfoTab() {
  const { data: items = [], isLoading } = useRfpContent("company_info");
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const existing = items[0];
  const content = (existing?.content as Record<string, any>) || {};

  const [form, setForm] = useState({
    legal_name: "",
    address: "",
    phone: "",
    fax: "",
    email: "",
    tax_id: "",
    founded_year: "",
    staff_count: "",
    website: "",
  });

  const startEdit = () => {
    setForm({
      legal_name: content.legal_name || "",
      address: content.address || "",
      phone: content.phone || "",
      fax: content.fax || "",
      email: content.email || "",
      tax_id: content.tax_id || "",
      founded_year: content.founded_year?.toString() || "",
      staff_count: content.staff_count?.toString() || "",
      website: content.website || "",
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const payload = {
      legal_name: form.legal_name,
      address: form.address,
      phone: form.phone,
      fax: form.fax,
      email: form.email,
      tax_id: form.tax_id,
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
      staff_count: form.staff_count ? parseInt(form.staff_count) : null,
      website: form.website,
    };

    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, content: payload });
      } else {
        await createMutation.mutateAsync({
          content_type: "company_info",
          title: "Company Details",
          content: payload,
          tags: ["all_agencies"],
        });
      }
      toast({ title: "Company info saved" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fields = [
    { key: "legal_name", label: "Legal Name" },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone" },
    { key: "fax", label: "Fax" },
    { key: "email", label: "Email" },
    { key: "tax_id", label: "Tax ID" },
    { key: "founded_year", label: "Founded Year" },
    { key: "staff_count", label: "Staff Count" },
    { key: "website", label: "Website" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Company Information</CardTitle>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!editing && !existing ? (
          <p className="text-muted-foreground text-sm">No company info saved yet. Click Edit to add your details.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {editing ? (
                  <Input
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.label}
                  />
                ) : (
                  <p className="text-sm font-medium">{content[f.key] || "—"}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
