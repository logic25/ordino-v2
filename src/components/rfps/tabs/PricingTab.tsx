import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Save, X, Calculator } from "lucide-react";
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
  labor_classifications: [
    { title: "Principal", regular: 200, overtime: 300, doubletime: 400 },
    { title: "Senior Associate", regular: 175, overtime: 262, doubletime: 350 },
    { title: "Staff Associate", regular: 150, overtime: 225, doubletime: 300 },
    { title: "Clerical", regular: 125, overtime: 187, doubletime: 250 },
  ],
  annual_escalation: 0.05,
};

export function PricingTab() {
  const { data: items = [], isLoading } = useRfpContent("pricing");
  const createMutation = useCreateRfpContent();
  const updateMutation = useUpdateRfpContent();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const existing = items[0];
  const content = (existing?.content as unknown as PricingContent) || defaultPricing;

  const [form, setForm] = useState<PricingContent>(content);

  const startEdit = () => {
    setForm(content);
    setEditing(true);
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

  if (isLoading) {
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
          <div className="flex gap-2">
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
            <div className="mb-4 space-y-1">
              <Label className="text-xs">Annual Escalation (%)</Label>
              <Input
                type="number"
                step="0.01"
                className="w-32"
                value={(form.annual_escalation * 100).toFixed(0)}
                onChange={(e) => setForm({ ...form, annual_escalation: parseFloat(e.target.value) / 100 || 0 })}
              />
            </div>
          )}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">
            Annual escalation: {((editing ? form : content).annual_escalation * 100).toFixed(0)}%
          </p>
        </CardContent>
      </Card>

      {showPreview && (
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
