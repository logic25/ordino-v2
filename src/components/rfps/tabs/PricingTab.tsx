import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Save, X, Calculator, Plus, Trash2, Users } from "lucide-react";
import { useRfpContent, useCreateRfpContent, useUpdateRfpContent } from "@/hooks/useRfpContent";
import { useToast } from "@/hooks/use-toast";

interface LaborClassification {
  title: string;
  regular: number;
  overtime: number;
  doubletime: number;
}

interface PricingContent {
  labor_classifications: LaborClassification[];
  annual_escalation: number;
}

const defaultPricing: PricingContent = {
  labor_classifications: [],
  annual_escalation: 0.05,
};

export function PricingTab() {
  const { data: items = [], isLoading } = useRfpContent("pricing");
  const { data: staffBios = [], isLoading: staffLoading } = useRfpContent("staff_bio");
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const existing = items[0];
  const content = (existing?.content as unknown as PricingContent) || defaultPricing;

  const [form, setForm] = useState<PricingContent>(content);

  // Extract staff members with hourly rates
  const staffWithRates = staffBios
    .map((s) => {
      const c = s.content as any;
      return { name: c?.name || "", title: c?.title || "", hourly_rate: c?.hourly_rate || 0 };
    })
    .filter((s) => s.name);

  const startEdit = () => {
    setForm(content);
    setEditing(true);
  };

  const importFromStaff = () => {
    const imported: LaborClassification[] = staffWithRates.map((s) => ({
      title: `${s.name} - ${s.title}`,
      regular: s.hourly_rate || 0,
      overtime: Math.round((s.hourly_rate || 0) * 1.5),
      doubletime: (s.hourly_rate || 0) * 2,
    }));
    setForm({ ...form, labor_classifications: imported });
    setEditing(true);
    toast({ title: `Imported ${imported.length} staff rates` });
  };

  const updateRate = (idx: number, field: keyof LaborClassification, value: string) => {
    const updated = [...form.labor_classifications];
    if (field === "title") {
      updated[idx] = { ...updated[idx], title: value };
    } else {
      updated[idx] = { ...updated[idx], [field]: parseFloat(value) || 0 };
    }
    setForm({ ...form, labor_classifications: updated });
  };

  const addRow = () => {
    setForm({
      ...form,
      labor_classifications: [
        ...form.labor_classifications,
        { title: "", regular: 0, overtime: 0, doubletime: 0 },
      ],
    });
  };

  const removeRow = (idx: number) => {
    setForm({
      ...form,
      labor_classifications: form.labor_classifications.filter((_, i) => i !== idx),
    });
  };

  const handleSave = async () => {
    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id, content: form as any });
      } else {
        await createMutation.mutateAsync({
          content_type: "pricing",
          title: "Standard Hourly Rates",
          content: form as any,
          tags: ["all_agencies"],
        });
      }
      toast({ title: "Pricing saved" });
      setEditing(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading || staffLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Hourly Rate Schedule</CardTitle>
          <div className="flex gap-2 flex-wrap">
            {staffWithRates.length > 0 && !editing && (
              <Button variant="outline" size="sm" onClick={importFromStaff}>
                <Users className="h-4 w-4 mr-1" /> Import Staff Rates
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              <Calculator className="h-4 w-4 mr-1" /> {showPreview ? "Hide" : "Show"} Multi-Year
            </Button>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing && (
            <div className="mb-4 flex items-end gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Annual Escalation (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="w-32"
                  value={(form.annual_escalation * 100).toFixed(0)}
                  onChange={(e) => setForm({ ...form, annual_escalation: parseFloat(e.target.value) / 100 || 0 })}
                />
              </div>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Add Row
              </Button>
              {staffWithRates.length > 0 && (
                <Button variant="outline" size="sm" onClick={importFromStaff}>
                  <Users className="h-4 w-4 mr-1" /> Sync from Staff
                </Button>
              )}
            </div>
          )}

          {(editing ? form : content).labor_classifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No rate classifications yet.</p>
              <p className="mt-1">
                {staffWithRates.length > 0
                  ? 'Click "Import Staff Rates" to pull hourly rates from your Staff Bios, or add rows manually.'
                  : 'Add staff bios with hourly rates first, or add classifications manually.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classification</TableHead>
                  <TableHead className="text-right">Regular</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead className="text-right">Double Time</TableHead>
                  {editing && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(editing ? form : content).labor_classifications.map((lc, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      {editing ? (
                        <Input value={lc.title} onChange={(e) => updateRate(idx, "title", e.target.value)} className="h-8" />
                      ) : (
                        <span className="font-medium">{lc.title}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? (
                        <Input type="number" value={lc.regular} onChange={(e) => updateRate(idx, "regular", e.target.value)} className="h-8 w-24 ml-auto text-right" />
                      ) : (
                        `$${lc.regular}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? (
                        <Input type="number" value={lc.overtime} onChange={(e) => updateRate(idx, "overtime", e.target.value)} className="h-8 w-24 ml-auto text-right" />
                      ) : (
                        `$${lc.overtime}`
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? (
                        <Input type="number" value={lc.doubletime} onChange={(e) => updateRate(idx, "doubletime", e.target.value)} className="h-8 w-24 ml-auto text-right" />
                      ) : (
                        `$${lc.doubletime}`
                      )}
                    </TableCell>
                    {editing && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {(editing ? form : content).labor_classifications.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Annual escalation: {((editing ? form : content).annual_escalation * 100).toFixed(0)}%
            </p>
          )}
        </CardContent>
      </Card>

      {showPreview && content.labor_classifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Multi-Year Rate Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {[1, 2, 3, 4, 5].map((year) => {
              const multiplier = Math.pow(1 + content.annual_escalation, year - 1);
              return (
                <div key={year} className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Year {year}</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Classification</TableHead>
                        <TableHead className="text-right">Regular</TableHead>
                        <TableHead className="text-right">Overtime</TableHead>
                        <TableHead className="text-right">Double Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {content.labor_classifications.map((lc, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{lc.title}</TableCell>
                          <TableCell className="text-right">${Math.round(lc.regular * multiplier)}</TableCell>
                          <TableCell className="text-right">${Math.round(lc.overtime * multiplier)}</TableCell>
                          <TableCell className="text-right">${Math.round(lc.doubletime * multiplier)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
