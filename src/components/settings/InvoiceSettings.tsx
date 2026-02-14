import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, WifiOff, Save, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

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

const DEFAULT_DEMAND_TEMPLATE = `Dear {{client_name}},

This letter serves as a formal demand for payment of the outstanding balance on invoice {{invoice_number}}, dated {{invoice_date}}, in the amount of {{amount_due}}.

Payment was due on {{due_date}} and is now {{days_overdue}} days past due.

Despite previous reminders, we have not received payment or a response regarding this matter. We respectfully request that full payment be remitted within ten (10) business days of the date of this letter.

Failure to remit payment may result in further collection action, including but not limited to referral to a collections agency or legal proceedings. Any costs associated with such actions will be added to the outstanding balance.

Please direct payment to the address on file or contact our office immediately to discuss resolution.

Sincerely,
{{company_name}}`;

const MERGE_FIELDS = [
  { key: "{{client_name}}", label: "Client Name" },
  { key: "{{invoice_number}}", label: "Invoice Number" },
  { key: "{{invoice_date}}", label: "Invoice Date" },
  { key: "{{amount_due}}", label: "Amount Due" },
  { key: "{{due_date}}", label: "Due Date" },
  { key: "{{days_overdue}}", label: "Days Overdue" },
  { key: "{{company_name}}", label: "Your Company Name" },
  { key: "{{project_name}}", label: "Project Name" },
];

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
  const { data: companyData } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [defaultTerms, setDefaultTerms] = useState("Net 30");
  const [reminderDays, setReminderDays] = useState("30");
  const [secondReminder, setSecondReminder] = useState("60");
  const [demandLetterDays, setDemandLetterDays] = useState("90");
  const [autoReminders, setAutoReminders] = useState(false);
  const [rules] = useState<ClientBillingRule[]>(MOCK_RULES);
  const [demandTemplate, setDemandTemplate] = useState(DEFAULT_DEMAND_TEMPLATE);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (companyData?.settings?.demand_letter_template) {
      setDemandTemplate(companyData.settings.demand_letter_template);
    }
  }, [companyData]);

  const handleSaveGeneral = () => {
    toast({ title: "Invoice settings saved" });
  };

  const handleSaveTemplate = async () => {
    if (!companyData) return;
    try {
      await updateSettings.mutateAsync({
        companyId: companyData.companyId,
        settings: {
          ...companyData.settings,
          demand_letter_template: demandTemplate,
        },
      });
      toast({ title: "Demand letter template saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const previewText = demandTemplate
    .replace(/\{\{client_name\}\}/g, "Rudin Management")
    .replace(/\{\{invoice_number\}\}/g, "INV-00042")
    .replace(/\{\{invoice_date\}\}/g, "November 14, 2025")
    .replace(/\{\{amount_due\}\}/g, "$2,950.00")
    .replace(/\{\{due_date\}\}/g, "December 14, 2025")
    .replace(/\{\{days_overdue\}\}/g, "62")
    .replace(/\{\{company_name\}\}/g, "Green Light Expediting LLC")
    .replace(/\{\{project_name\}\}/g, "340 Park Ave - Lehman Reno");

  const insertField = (field: string) => {
    setDemandTemplate((prev) => prev + field);
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

      {/* Demand Letter Template */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Demand Letter Template</CardTitle>
              <CardDescription>
                Customize the formal demand letter sent to clients. Use merge fields to auto-fill invoice details.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Available Merge Fields</Label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MERGE_FIELDS.map((f) => (
                <Badge
                  key={f.key}
                  variant="secondary"
                  className="text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => insertField(f.key)}
                  title={`Click to insert ${f.label}`}
                >
                  {f.key}
                </Badge>
              ))}
            </div>
          </div>

          <Textarea
            value={demandTemplate}
            onChange={(e) => setDemandTemplate(e.target.value)}
            rows={16}
            className="font-mono text-sm"
            placeholder="Enter your demand letter template..."
          />

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveTemplate} disabled={updateSettings.isPending}>
              <Save className="h-4 w-4 mr-2" /> Save Template
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDemandTemplate(DEFAULT_DEMAND_TEMPLATE)}
            >
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demand Letter Preview</DialogTitle>
            <DialogDescription>
              This is how the letter will look with sample data filled in.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif">
            {previewText}
          </div>
        </DialogContent>
      </Dialog>

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
