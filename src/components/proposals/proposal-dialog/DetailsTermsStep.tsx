import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LEAD_SOURCES, PROJECT_TYPES, formatCurrency } from "./proposalSchema";
import { SectionLabel } from "./DialogHelpers";
import { ReferredByCombobox } from "@/components/proposals/ReferredByCombobox";

interface DetailsTermsStepProps {
  form: any;
  profiles: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  subtotal: number;
}

export function DetailsTermsStep({ form, profiles, subtotal }: DetailsTermsStepProps) {
  return (
    <div className="px-6 py-5 space-y-6">
      <SectionLabel>Classification</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Project Type</Label>
          <Select value={form.watch("project_type") || ""} onValueChange={(v) => form.setValue("project_type", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Lead Source</Label>
          <Select value={form.watch("lead_source") || ""} onValueChange={(v) => form.setValue("lead_source", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {form.watch("lead_source")?.toLowerCase().includes("referral") && (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Referred By (Company)</Label>
              <ReferredByCombobox value={form.watch("referred_by") || ""} onChange={(v) => form.setValue("referred_by", v)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Referred By (Person)</Label>
              <ReferredByCombobox
                value={form.watch("referred_by_person") || ""}
                onChange={(v) => form.setValue("referred_by_person", v)}
                placeholder="Search contacts or type name..."
                searchMode="contacts"
              />
            </div>
          </>
        )}
      </div>

      <Separator className="my-2" />
      <SectionLabel>Assignment</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Assigned PM</Label>
          <Select value={form.watch("assigned_pm_id" as any) || ""} onValueChange={(v) => form.setValue("assigned_pm_id" as any, v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select PM…" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">PM assigned when proposal converts to a project.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sales Person</Label>
          <Select value={form.watch("sales_person_id") || ""} onValueChange={(v) => form.setValue("sales_person_id", v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Follow-up Reminder</Label>
          <Input type="date" className="h-9 text-sm" {...form.register("reminder_date")} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Valid Until</Label>
          <Input type="date" className="h-9 text-sm" {...form.register("valid_until")} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Switch checked={form.watch("notable") || false} onCheckedChange={(c) => form.setValue("notable", c)} />
        <Label className="text-sm cursor-pointer">Notable Project</Label>
      </div>

      <Separator className="my-2" />
      <SectionLabel>Financial</SectionLabel>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Deposit %</Label>
        <Input type="number" min="0" max="100" placeholder="50" className="h-9 text-sm" {...form.register("deposit_percentage")} />
        {(() => {
          const pct = Number(form.watch("deposit_percentage")) || 0;
          const retainerAmt = pct > 0 ? subtotal * pct / 100 : 0;
          return retainerAmt > 0 ? (
            <p className="text-xs text-muted-foreground">Retainer: {formatCurrency(retainerAmt)}</p>
          ) : null;
        })()}
      </div>

      <Separator className="my-2" />
      <SectionLabel>Terms & Notes</SectionLabel>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Terms & Conditions</Label>
        <Textarea placeholder="Enter terms and conditions..." rows={4} className="text-sm" {...form.register("terms_conditions")} />
        <p className="text-xs text-muted-foreground">Default terms can be set in Settings → Company</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Internal Sales Notes</Label>
        <Textarea placeholder="Strategy notes for your team only — e.g., 'Client is price-sensitive, offer 10% if needed'" rows={2} className="text-sm" {...form.register("notes")} />
        <p className="text-xs text-muted-foreground">Never shown on proposals or PDFs — internal use only.</p>
      </div>
    </div>
  );
}
