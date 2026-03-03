import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, Radio, CheckCircle2, Plus, Trash2, Loader2,
} from "lucide-react";
import { DEFAULT_CO_SIGN_OFFS, type CoSignOffInput, useSeedCoSignOffs } from "@/hooks/useCoSignOffs";
import { useToast } from "@/hooks/use-toast";

interface COSetupWizardProps {
  propertyId: string;
  propertyAddress: string;
  onComplete: () => void;
}

export function COSetupWizard({ propertyId, propertyAddress, onComplete }: COSetupWizardProps) {
  const { toast } = useToast();
  const seed = useSeedCoSignOffs();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reportType, setReportType] = useState<"CO" | "TCO">("CO");
  const [signOffs, setSignOffs] = useState<(CoSignOffInput & { selected: boolean })[]>(
    DEFAULT_CO_SIGN_OFFS.map(so => ({ ...so, selected: true }))
  );
  const [customName, setCustomName] = useState("");

  const selectedCount = signOffs.filter(s => s.selected).length;

  const toggleSignOff = (idx: number) => {
    setSignOffs(prev => prev.map((so, i) => i === idx ? { ...so, selected: !so.selected } : so));
  };

  const addCustom = () => {
    if (!customName.trim()) return;
    setSignOffs(prev => [...prev, {
      name: customName.trim(),
      status: "Pending",
      tco_required: false,
      sort_order: prev.length,
      selected: true,
    }]);
    setCustomName("");
  };

  const removeSignOff = (idx: number) => {
    setSignOffs(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFinish = async () => {
    const selected = signOffs.filter(s => s.selected).map((s, i) => ({
      name: s.name,
      status: s.status || "Pending",
      tco_required: s.tco_required ?? false,
      sort_order: i,
    }));
    if (selected.length === 0) {
      toast({ title: "Select at least one sign-off", variant: "destructive" });
      return;
    }
    try {
      await seed.mutateAsync({ propertyId, signOffs: selected });
      toast({ title: "CO tracking configured", description: `${selected.length} sign-offs set up for ${propertyAddress}.` });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="rounded-full bg-primary/10 p-4 inline-flex">
          <ClipboardList className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Set Up CO Tracking</h3>
        <p className="text-sm text-muted-foreground">{propertyAddress}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium
              ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 3 && <div className={`w-8 h-px ${step > s ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Report Type */}
      {step === 1 && (
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <Label>What type of certificate is this property pursuing?</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as "CO" | "TCO")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CO">CO — Certificate of Occupancy (Full Close-Out)</SelectItem>
                <SelectItem value="TCO">TCO — Temporary Certificate of Occupancy</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {reportType === "CO"
                ? "All applications must be closed, all violations resolved, and all sign-offs obtained."
                : "Partial close-out — only life-safety and critical sign-offs required. Some items can be deferred."}
            </p>
          </div>
          <Button className="w-full" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Select Sign-Offs */}
      {step === 2 && (
        <div className="w-full space-y-4">
          <div className="space-y-1">
            <Label>Select required sign-offs for this property</Label>
            <p className="text-xs text-muted-foreground">
              {selectedCount} selected · Uncheck any that don't apply · Add custom items below
            </p>
          </div>

          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {signOffs.map((so, idx) => (
              <div key={idx} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/5">
                <Checkbox
                  checked={so.selected}
                  onCheckedChange={() => toggleSignOff(idx)}
                />
                <span className="text-sm flex-1">{so.name}</span>
                {so.tco_required && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-500/10 text-blue-700 border-blue-500/20">
                    TCO
                  </Badge>
                )}
                {!DEFAULT_CO_SIGN_OFFS.find(d => d.name === so.name) && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSignOff(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add custom sign-off..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Button variant="outline" size="icon" onClick={addCustom} disabled={!customName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button onClick={() => setStep(3)} className="flex-1" disabled={selectedCount === 0}>
              Continue ({selectedCount} sign-offs)
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <Label>Review & Confirm</Label>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Report Type</span>
                <Badge variant="outline">{reportType}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sign-Offs</span>
                <span className="font-medium">{selectedCount} items</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {signOffs.filter(s => s.selected).map((so, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {so.name}
                    {so.tco_required && <Radio className="h-2.5 w-2.5 ml-1 text-blue-600" />}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You can edit sign-offs, update statuses, and add new ones at any time from the CO Summary tab.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
            <Button onClick={handleFinish} className="flex-1" disabled={seed.isPending}>
              {seed.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set Up CO Tracking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
