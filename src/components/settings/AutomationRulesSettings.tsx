import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CollapsibleSettingsCard } from "./CollapsibleSettingsCard";
import {
  Plus, Trash2, Pencil, Loader2, Zap, Clock, AlertTriangle,
  Mail, BellRing, ArrowUpCircle, Power, PowerOff, GripVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useAutomationRules, useCreateAutomationRule, useUpdateAutomationRule,
  useDeleteAutomationRule, useToggleAutomationRule,
  type AutomationRule, type AutomationRuleInput,
} from "@/hooks/useAutomationRules";
import { useCompanyProfiles } from "@/hooks/useProfiles";

const RULE_TYPES = [
  { value: "collection_reminder", label: "Collection Reminder", icon: Mail },
  { value: "escalation", label: "Escalation Alert", icon: ArrowUpCircle },
  { value: "status_change", label: "Status Change", icon: AlertTriangle },
];

const TRIGGER_TYPES = [
  { value: "days_overdue", label: "Days Overdue" },
  { value: "days_since_last_contact", label: "Days Since Last Contact" },
  { value: "promise_broken", label: "Promise Broken" },
];

const ACTION_TYPES = [
  { value: "generate_reminder", label: "Generate AI Reminder (PM Approves)" },
  { value: "escalate", label: "Escalate to Manager/Admin" },
  { value: "notify", label: "Send Notification" },
];

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "firm", label: "Firm" },
  { value: "urgent", label: "Urgent" },
  { value: "final_notice", label: "Final Notice" },
];

export function AutomationRulesSettings() {
  const { data: rules = [], isLoading } = useAutomationRules();
  const { data: profiles = [] } = useCompanyProfiles();
  const createRule = useCreateAutomationRule();
  const updateRule = useUpdateAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const toggleRule = useToggleAutomationRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState("collection_reminder");
  const [triggerType, setTriggerType] = useState("days_overdue");
  const [triggerValue, setTriggerValue] = useState("30");
  const [actionType, setActionType] = useState("generate_reminder");
  const [tone, setTone] = useState("friendly");
  const [escalateTo, setEscalateTo] = useState("");
  const [cooldownHours, setCooldownHours] = useState("72");
  const [maxExecutions, setMaxExecutions] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [excludeDisputed, setExcludeDisputed] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);

  const resetForm = () => {
    setName("");
    setDescription("");
    setRuleType("collection_reminder");
    setTriggerType("days_overdue");
    setTriggerValue("30");
    setActionType("generate_reminder");
    setTone("friendly");
    setEscalateTo("");
    setCooldownHours("72");
    setMaxExecutions("");
    setMinAmount("");
    setExcludeDisputed(true);
    setIsEnabled(true);
    setEditingRule(null);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || "");
    setRuleType(rule.rule_type);
    setTriggerType(rule.trigger_type);
    setTriggerValue(String(rule.trigger_value));
    setActionType(rule.action_type);
    setTone(rule.action_config?.tone || "friendly");
    setEscalateTo(rule.action_config?.escalate_to || "");
    setCooldownHours(String(rule.cooldown_hours));
    setMaxExecutions(rule.max_executions ? String(rule.max_executions) : "");
    setMinAmount(rule.conditions?.min_amount ? String(rule.conditions.min_amount) : "");
    setExcludeDisputed(rule.conditions?.exclude_disputed ?? true);
    setIsEnabled(rule.is_enabled);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const input: AutomationRuleInput = {
      name: name.trim(),
      description: description.trim() || null,
      rule_type: ruleType,
      trigger_type: triggerType,
      trigger_value: parseInt(triggerValue) || 30,
      action_type: actionType,
      action_config: {
        tone,
        ...(escalateTo ? { escalate_to: escalateTo } : {}),
      },
      conditions: {
        ...(minAmount ? { min_amount: parseFloat(minAmount) } : {}),
        exclude_disputed: excludeDisputed,
      },
      is_enabled: isEnabled,
      cooldown_hours: parseInt(cooldownHours) || 72,
      max_executions: maxExecutions ? parseInt(maxExecutions) : null,
    };

    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...input });
        toast({ title: "Rule updated" });
      } else {
        await createRule.mutateAsync(input);
        toast({ title: "Rule created" });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "Rule deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleRule.mutateAsync({ id, is_enabled: enabled });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getRuleIcon = (type: string) => {
    const found = RULE_TYPES.find((r) => r.value === type);
    return found ? found.icon : Zap;
  };

  const getTriggerLabel = (type: string, value: number) => {
    switch (type) {
      case "days_overdue": return `${value} days overdue`;
      case "days_since_last_contact": return `${value} days since contact`;
      case "promise_broken": return "Promise broken";
      default: return type;
    }
  };

  const getActionLabel = (type: string) => {
    return ACTION_TYPES.find((a) => a.value === type)?.label || type;
  };

  const managers = profiles.filter((p) => p.role === "admin" || p.role === "manager");

  return (
    <div className="space-y-4">
      <CollapsibleSettingsCard
        title="Automation Rules"
        description="Configure automated collection reminders, escalations, and notifications"
        icon={<Zap className="h-4 w-4" />}
        headerAction={
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No automation rules configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create rules to automatically remind clients, escalate overdue invoices, and more.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Create Your First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const Icon = getRuleIcon(rule.rule_type);
              return (
                <div key={rule.id} className={`rounded-lg border p-4 space-y-2 transition-opacity ${!rule.is_enabled ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">{rule.name}</h4>
                      <Badge variant={rule.is_enabled ? "default" : "secondary"} className="text-[10px]">
                        {rule.is_enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(v) => handleToggle(rule.id, v)}
                        className="scale-75"
                      />
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => openEdit(rule)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {getTriggerLabel(rule.trigger_type, rule.trigger_value)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {getActionLabel(rule.action_type)}
                    </Badge>
                    {rule.action_config?.tone && (
                      <Badge variant="secondary" className="text-[10px]">
                        Tone: {rule.action_config.tone}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      Cooldown: {rule.cooldown_hours}h
                    </Badge>
                    {rule.max_executions && (
                      <Badge variant="secondary" className="text-[10px]">
                        Max: {rule.max_executions}x
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSettingsCard>

      {/* Presets */}
      <CollapsibleSettingsCard
        title="Quick Templates"
        description="Start with a common automation pattern"
        icon={<BellRing className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="grid gap-3">
          {[
            {
              name: "30-Day Friendly Reminder",
              desc: "Send a friendly AI-generated reminder when an invoice is 30 days overdue",
              preset: { rule_type: "collection_reminder", trigger_type: "days_overdue", trigger_value: "30", action_type: "generate_reminder", tone: "friendly", cooldown: "72" },
            },
            {
              name: "60-Day Firm Follow-Up",
              desc: "Send a firm reminder at 60 days with escalation warning",
              preset: { rule_type: "collection_reminder", trigger_type: "days_overdue", trigger_value: "60", action_type: "generate_reminder", tone: "firm", cooldown: "72" },
            },
            {
              name: "90-Day Escalation",
              desc: "Escalate to manager when invoice hits 90 days overdue",
              preset: { rule_type: "escalation", trigger_type: "days_overdue", trigger_value: "90", action_type: "escalate", tone: "urgent", cooldown: "168" },
            },
            {
              name: "Broken Promise Alert",
              desc: "Notify when a client breaks a payment promise",
              preset: { rule_type: "escalation", trigger_type: "promise_broken", trigger_value: "1", action_type: "notify", tone: "urgent", cooldown: "24" },
            },
          ].map((tmpl) => (
            <div key={tmpl.name} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{tmpl.name}</p>
                <p className="text-xs text-muted-foreground">{tmpl.desc}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setName(tmpl.name);
                  setDescription(tmpl.desc);
                  setRuleType(tmpl.preset.rule_type);
                  setTriggerType(tmpl.preset.trigger_type);
                  setTriggerValue(tmpl.preset.trigger_value);
                  setActionType(tmpl.preset.action_type);
                  setTone(tmpl.preset.tone);
                  setCooldownHours(tmpl.preset.cooldown);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Use
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleSettingsCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit" : "Create"} Automation Rule</DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Modify this automation rule's trigger and action."
                : "Define when and how this rule should fire. All AI-generated messages require PM approval before sending."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 30-Day Friendly Reminder" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What this rule does..." />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Rule Type</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Action</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((at) => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">When</Label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((tt) => (
                      <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {triggerType !== "promise_broken" && (
                <div className="space-y-2">
                  <Label className="text-sm">Threshold (days)</Label>
                  <Input type="number" value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} min={1} />
                </div>
              )}
            </div>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Action Config</p>
            {actionType === "generate_reminder" && (
              <div className="space-y-2">
                <Label className="text-sm">Email Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">AI will generate a message in this tone. PM must approve before it's sent.</p>
              </div>
            )}
            {actionType === "escalate" && (
              <div className="space-y-2">
                <Label className="text-sm">Escalate To</Label>
                <Select value={escalateTo} onValueChange={setEscalateTo}>
                  <SelectTrigger><SelectValue placeholder="Select manager/admin" /></SelectTrigger>
                  <SelectContent>
                    {managers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conditions & Limits</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Cooldown (hours)</Label>
                <Input type="number" value={cooldownHours} onChange={(e) => setCooldownHours(e.target.value)} min={1} />
                <p className="text-xs text-muted-foreground">Min time between re-triggers per invoice</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Max Executions</Label>
                <Input type="number" value={maxExecutions} onChange={(e) => setMaxExecutions(e.target.value)} placeholder="Unlimited" />
                <p className="text-xs text-muted-foreground">Per invoice (blank = unlimited)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Minimum Invoice Amount ($)</Label>
              <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="No minimum" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Exclude Disputed Invoices</Label>
                <p className="text-xs text-muted-foreground">Skip invoices with active disputes</p>
              </div>
              <Switch checked={excludeDisputed} onCheckedChange={setExcludeDisputed} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enabled</Label>
                <p className="text-xs text-muted-foreground">Rule runs when enabled</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || createRule.isPending || updateRule.isPending}>
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
