import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, WifiOff, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ClientBillingRule {
  id: string;
  clientName: string;
  requireWaiver: boolean;
  requirePayApp: boolean;
  wireFee: number;
  ccMarkup: number;
  specialPortalRequired: boolean;
  portalUrl: string;
  specialInstructions: string;
}

// Mock data for demo
const MOCK_RULES: ClientBillingRule[] = [
  {
    id: "1",
    clientName: "Silverstein Properties",
    requireWaiver: true,
    requirePayApp: true,
    wireFee: 25,
    ccMarkup: 3,
    specialPortalRequired: true,
    portalUrl: "https://portal.silversteinproperties.com",
    specialInstructions: "Submit via vendor portal. Invoice must reference PO number.",
  },
  {
    id: "2",
    clientName: "Related Companies",
    requireWaiver: false,
    requirePayApp: false,
    wireFee: 0,
    ccMarkup: 0,
    specialPortalRequired: false,
    portalUrl: "",
    specialInstructions: "Standard Net 30 terms apply.",
  },
];

export function InvoiceSettings() {
  const [defaultTerms, setDefaultTerms] = useState("Net 30");
  const [reminderDays, setReminderDays] = useState("30");
  const [secondReminder, setSecondReminder] = useState("60");
  const [demandLetterDays, setDemandLetterDays] = useState("90");
  const [autoReminders, setAutoReminders] = useState(false);
  const [rules] = useState<ClientBillingRule[]>(MOCK_RULES);

  const handleSaveGeneral = () => {
    toast({ title: "Invoice settings saved" });
  };

  return (
    <div className="space-y-6">
      {/* Default Payment Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Payment Terms</CardTitle>
          <CardDescription>Set the default payment terms for new invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Terms</Label>
              <Select value={defaultTerms} onValueChange={setDefaultTerms}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                  <SelectItem value="Net 15">Net 15</SelectItem>
                  <SelectItem value="Net 30">Net 30</SelectItem>
                  <SelectItem value="Net 60">Net 60</SelectItem>
                  <SelectItem value="Net 90">Net 90</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={handleSaveGeneral}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </CardContent>
      </Card>

      {/* Collections Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collections Timeline</CardTitle>
          <CardDescription>Configure when follow-up actions are triggered for overdue invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-send reminders</Label>
              <p className="text-xs text-muted-foreground">Automatically send payment reminders at configured intervals</p>
            </div>
            <Switch checked={autoReminders} onCheckedChange={setAutoReminders} />
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">First Reminder (days)</Label>
              <Input
                type="number"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                min={1}
              />
              <p className="text-xs text-muted-foreground">Attention level</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Second Reminder (days)</Label>
              <Input
                type="number"
                value={secondReminder}
                onChange={(e) => setSecondReminder(e.target.value)}
                min={1}
              />
              <p className="text-xs text-muted-foreground">Urgent level</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Demand Letter (days)</Label>
              <Input
                type="number"
                value={demandLetterDays}
                onChange={(e) => setDemandLetterDays(e.target.value)}
                min={1}
              />
              <p className="text-xs text-muted-foreground">Critical level</p>
            </div>
          </div>

          <Button size="sm" onClick={handleSaveGeneral}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </CardContent>
      </Card>

      {/* Client Billing Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Client Billing Rules</CardTitle>
              <CardDescription>Special billing procedures per client</CardDescription>
            </div>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No billing rules configured yet
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{rule.clientName}</h4>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Edit</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.requireWaiver && <Badge variant="secondary" className="text-[10px]">Waiver Required</Badge>}
                    {rule.requirePayApp && <Badge variant="secondary" className="text-[10px]">Pay App Required</Badge>}
                    {rule.wireFee > 0 && <Badge variant="secondary" className="text-[10px]">Wire Fee: ${rule.wireFee}</Badge>}
                    {rule.ccMarkup > 0 && <Badge variant="secondary" className="text-[10px]">CC Markup: {rule.ccMarkup}%</Badge>}
                    {rule.specialPortalRequired && <Badge variant="secondary" className="text-[10px]">Portal Required</Badge>}
                  </div>
                  {rule.specialInstructions && (
                    <p className="text-xs text-muted-foreground">{rule.specialInstructions}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QBO Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">QuickBooks Online</CardTitle>
          <CardDescription>Manage your QuickBooks Online integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Connected to Green Light Expediting LLC</p>
                <p className="text-xs text-muted-foreground">Mock connection — Real QBO credentials required for production</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-destructive">
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
