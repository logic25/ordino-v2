import { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { CollapsibleSettingsCard } from "./CollapsibleSettingsCard";
import {
  CheckCircle, Save, Plus, Trash2, Eye, Loader2, CreditCard, Building2,
  Mail, RefreshCw, Clock, Upload, Image, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCompanySettings, useUpdateCompanySettings, type CompanySettings } from "@/hooks/useCompanySettings";
import {
  useClientBillingRules, useCreateClientBillingRule,
  useUpdateClientBillingRule, useDeleteClientBillingRule, type ClientBillingRule,
} from "@/hooks/useClientBillingRules";
import { useClients } from "@/hooks/useClients";
import { BillingRuleDocumentsSection } from "./BillingRuleDocuments";

const DEFAULT_DEMAND_TEMPLATE = `Dear {{client_name}},

This letter serves as a formal demand for payment of the outstanding balance on invoice {{invoice_number}}, dated {{invoice_date}}, in the amount of {{amount_due}}.

Payment was due on {{due_date}} and is now {{days_overdue}} days past due.

Despite previous reminders, we have not received payment or a response regarding this matter. We respectfully request that full payment be remitted within ten (10) business days of the date of this letter.

Failure to remit payment may result in further collection action, including but not limited to referral to a collections agency or legal proceedings. Any costs associated with such actions will be added to the outstanding balance.

Please direct payment to the address on file or contact our office immediately to discuss resolution.

Sincerely,
{{company_name}}`;

const DEMAND_MERGE_FIELDS = [
  { key: "{{client_name}}", label: "Client Name" },
  { key: "{{invoice_number}}", label: "Invoice Number" },
  { key: "{{invoice_date}}", label: "Invoice Date" },
  { key: "{{amount_due}}", label: "Amount Due" },
  { key: "{{due_date}}", label: "Due Date" },
  { key: "{{days_overdue}}", label: "Days Overdue" },
  { key: "{{company_name}}", label: "Your Company Name" },
  { key: "{{project_name}}", label: "Project Name" },
];

const DEFAULT_ACH_TEMPLATE = `ACH DEBIT AUTHORIZATION AGREEMENT

I hereby authorize {{company_name}} ("Company") to initiate electronic debit entries to my bank account indicated below for payment of amounts owed under invoice {{invoice_number}}.

PAYMENT SCHEDULE:
Total Amount: {{total_amount}}
{{payment_schedule}}

TERMS & CONDITIONS:
1. This authorization is to remain in full force and effect until the Company has received written notification from me of its termination in such time and manner as to afford the Company a reasonable opportunity to act on it.
2. I understand that if any debit is returned unpaid, I may be subject to a return fee.
3. I may revoke this authorization at any time by providing written notice to the Company at least 3 business days prior to the next scheduled debit date.
4. The Company will provide at least 10 days advance notice of any changes to the debit amount or schedule.

This authorization is provided in compliance with the National Automated Clearing House Association (NACHA) Operating Rules.

Effective Date: {{effective_date}}`;

const ACH_MERGE_FIELDS = [
  { key: "{{company_name}}", label: "Company Name" },
  { key: "{{invoice_number}}", label: "Invoice Number" },
  { key: "{{total_amount}}", label: "Total Amount" },
  { key: "{{payment_schedule}}", label: "Payment Schedule" },
  { key: "{{effective_date}}", label: "Effective Date" },
];

const EMAIL_MERGE_FIELDS = [
  { key: "{{client_name}}", label: "Client Name" },
  { key: "{{contact_name}}", label: "Contact Name" },
  { key: "{{invoice_number}}", label: "Invoice Number" },
  { key: "{{project_number}}", label: "Project Number" },
  { key: "{{project_name}}", label: "Project Name" },
  { key: "{{amount_due}}", label: "Amount Due" },
  { key: "{{due_date}}", label: "Due Date" },
  { key: "{{payment_terms}}", label: "Payment Terms" },
  { key: "{{company_name}}", label: "Your Company Name" },
];

const DEFAULT_EMAIL_SUBJECT = "Invoice #{{invoice_number}} - Project #{{project_number}} ({{project_name}})";
const DEFAULT_EMAIL_BODY = `Hi {{contact_name}},

Please find attached Invoice #{{invoice_number}} for services completed on Project #{{project_number}} - {{project_name}}.

INVOICE SUMMARY:
Amount Due: {{amount_due}}
Payment Terms: {{payment_terms}}
Due Date: {{due_date}}

If you have any questions about this invoice, please don't hesitate to reach out.

Best regards,
{{company_name}}`;

export function InvoiceSettings() {
  const { data: companyData } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const { data: billingRules = [] } = useClientBillingRules();
  const createRule = useCreateClientBillingRule();
  const updateRule = useUpdateClientBillingRule();
  const deleteRule = useDeleteClientBillingRule();
  const { data: clients = [] } = useClients();

  const s = companyData?.settings || {} as CompanySettings;

  // Expand/Collapse all sections
  const [allExpanded, setAllExpanded] = useState(true);
  const [sectionStates, setSectionStates] = useState<Record<string, boolean>>({});
  
  const toggleAll = useCallback(() => {
    const next = !allExpanded;
    setAllExpanded(next);
    setSectionStates({
      company: next, payment: next, terms: next, email: next,
      collections: next, demand: next, ach: next, rules: next, qbo: next,
    });
  }, [allExpanded]);

  const setSectionOpen = useCallback((key: string, open: boolean) => {
    setSectionStates(prev => ({ ...prev, [key]: open }));
  }, []);

  // General
  const [defaultTerms, setDefaultTerms] = useState("Net 30");
  // Company info
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyFax, setCompanyFax] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  // Payment methods
  const [checkAddress, setCheckAddress] = useState("");
  const [wireBankName, setWireBankName] = useState("");
  const [wireRouting, setWireRouting] = useState("");
  const [wireAccount, setWireAccount] = useState("");
  const [zelleId, setZelleId] = useState("");
  const [ccEnabled, setCcEnabled] = useState(false);
  const [ccUrl, setCcUrl] = useState("");
  // Collections
  const [reminderDays, setReminderDays] = useState("30");
  const [secondReminder, setSecondReminder] = useState("60");
  const [demandLetterDays, setDemandLetterDays] = useState("90");
  const [autoReminders, setAutoReminders] = useState(false);
  const [earlyDiscount, setEarlyDiscount] = useState(false);
  const [earlyDiscountPct, setEarlyDiscountPct] = useState("2");
  // Demand letter
  const [demandTemplate, setDemandTemplate] = useState(DEFAULT_DEMAND_TEMPLATE);
  const [showDemandPreview, setShowDemandPreview] = useState(false);
  // ACH template
  const [achTemplate, setAchTemplate] = useState(DEFAULT_ACH_TEMPLATE);
  const [showAchPreview, setShowAchPreview] = useState(false);
  // Email template
  const [emailSubject, setEmailSubject] = useState(DEFAULT_EMAIL_SUBJECT);
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_BODY);
  // QBO
  const [qboSyncFreq, setQboSyncFreq] = useState("daily");
  // Logo & PDF branding
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  // Billing rule dialog
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ClientBillingRule | null>(null);
  const [newRuleClientId, setNewRuleClientId] = useState("");
  const [newRuleVendorId, setNewRuleVendorId] = useState("");
  const [newRulePropertyId, setNewRulePropertyId] = useState("");
  const [newRuleWaiver, setNewRuleWaiver] = useState(false);
  const [newRulePayApp, setNewRulePayApp] = useState(false);
  const [newRuleWireFee, setNewRuleWireFee] = useState("");
  const [newRuleCcMarkup, setNewRuleCcMarkup] = useState("");
  const [newRulePortal, setNewRulePortal] = useState(false);
  const [newRulePortalUrl, setNewRulePortalUrl] = useState("");
  const [newRuleInstructions, setNewRuleInstructions] = useState("");

  // Hydrate from settings
  useEffect(() => {
    if (!companyData?.settings) return;
    const st = companyData.settings;
    if (st.default_terms) setDefaultTerms(st.default_terms);
    if (st.company_address) setCompanyAddress(st.company_address);
    if (st.company_phone) setCompanyPhone(st.company_phone);
    if (st.company_fax) setCompanyFax(st.company_fax);
    if (st.company_email) setCompanyEmail(st.company_email);
    if (st.company_website) setCompanyWebsite(st.company_website);
    if (st.payment_check_address) setCheckAddress(st.payment_check_address);
    if (st.payment_wire_bank_name) setWireBankName(st.payment_wire_bank_name);
    if (st.payment_wire_routing) setWireRouting(st.payment_wire_routing);
    if (st.payment_wire_account) setWireAccount(st.payment_wire_account);
    if (st.payment_zelle_id) setZelleId(st.payment_zelle_id);
    if (st.payment_cc_enabled !== undefined) setCcEnabled(st.payment_cc_enabled);
    if (st.payment_cc_url) setCcUrl(st.payment_cc_url);
    if (st.collections_first_reminder_days) setReminderDays(String(st.collections_first_reminder_days));
    if (st.collections_second_reminder_days) setSecondReminder(String(st.collections_second_reminder_days));
    if (st.collections_demand_letter_days) setDemandLetterDays(String(st.collections_demand_letter_days));
    if (st.collections_auto_reminders !== undefined) setAutoReminders(st.collections_auto_reminders);
    if (st.collections_early_payment_discount !== undefined) setEarlyDiscount(st.collections_early_payment_discount);
    if (st.collections_early_payment_discount_percent) setEarlyDiscountPct(String(st.collections_early_payment_discount_percent));
    if (st.demand_letter_template) setDemandTemplate(st.demand_letter_template);
    if (st.ach_authorization_template) setAchTemplate(st.ach_authorization_template);
    if (st.invoice_email_subject_template) setEmailSubject(st.invoice_email_subject_template);
    if (st.invoice_email_body_template) setEmailBody(st.invoice_email_body_template);
    if (st.qbo_sync_frequency) setQboSyncFreq(st.qbo_sync_frequency);
    if (st.company_logo_url) setLogoUrl(st.company_logo_url);
    if (st.invoice_header_text) setHeaderText(st.invoice_header_text);
    if (st.invoice_footer_text) setFooterText(st.invoice_footer_text);
  }, [companyData]);

  const saveAll = async () => {
    if (!companyData) return;
    try {
      await updateSettings.mutateAsync({
        companyId: companyData.companyId,
        settings: {
          ...companyData.settings,
          default_terms: defaultTerms,
          company_address: companyAddress,
          company_phone: companyPhone,
          company_fax: companyFax,
          company_email: companyEmail,
          company_website: companyWebsite,
          payment_check_address: checkAddress,
          payment_wire_bank_name: wireBankName,
          payment_wire_routing: wireRouting,
          payment_wire_account: wireAccount,
          payment_zelle_id: zelleId,
          payment_cc_enabled: ccEnabled,
          payment_cc_url: ccUrl,
          collections_first_reminder_days: parseInt(reminderDays) || 30,
          collections_second_reminder_days: parseInt(secondReminder) || 60,
          collections_demand_letter_days: parseInt(demandLetterDays) || 90,
          collections_auto_reminders: autoReminders,
          collections_early_payment_discount: earlyDiscount,
          collections_early_payment_discount_percent: parseFloat(earlyDiscountPct) || 2,
          demand_letter_template: demandTemplate,
          ach_authorization_template: achTemplate,
          invoice_email_subject_template: emailSubject,
          invoice_email_body_template: emailBody,
          qbo_sync_frequency: qboSyncFreq,
          company_logo_url: logoUrl,
          invoice_header_text: headerText,
          invoice_footer_text: footerText,
        },
      });
      toast({ title: "All invoice settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // handleAddRule removed — replaced by handleSaveRule below

  const resetRuleForm = () => {
    setNewRuleClientId("");
    setNewRuleVendorId("");
    setNewRulePropertyId("");
    setNewRuleWaiver(false);
    setNewRulePayApp(false);
    setNewRuleWireFee("");
    setNewRuleCcMarkup("");
    setNewRulePortal(false);
    setNewRulePortalUrl("");
    setNewRuleInstructions("");
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule.mutateAsync(id);
      toast({ title: "Billing rule removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openEditRule = (rule: ClientBillingRule) => {
    setEditingRule(rule);
    setNewRuleClientId(rule.client_id);
    setNewRuleVendorId(rule.vendor_id || "");
    setNewRulePropertyId(rule.property_id || "");
    setNewRuleWaiver(rule.require_waiver || false);
    setNewRulePayApp(rule.require_pay_app || false);
    setNewRuleWireFee(rule.wire_fee ? String(rule.wire_fee) : "");
    setNewRuleCcMarkup(rule.cc_markup ? String(rule.cc_markup) : "");
    setNewRulePortal(rule.special_portal_required || false);
    setNewRulePortalUrl(rule.portal_url || "");
    setNewRuleInstructions(rule.special_instructions || "");
    setAddRuleOpen(true);
  };

  const handleSaveRule = async () => {
    if (!newRuleClientId || !companyData) return;
    const payload = {
      company_id: companyData.companyId,
      client_id: newRuleClientId,
      vendor_id: newRuleVendorId || null,
      property_id: newRulePropertyId || null,
      require_waiver: newRuleWaiver,
      require_pay_app: newRulePayApp,
      wire_fee: newRuleWireFee ? parseFloat(newRuleWireFee) : null,
      cc_markup: newRuleCcMarkup ? parseInt(newRuleCcMarkup) : null,
      special_portal_required: newRulePortal,
      portal_url: newRulePortalUrl || null,
      special_instructions: newRuleInstructions || null,
    };
    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...payload });
        toast({ title: "Billing rule updated" });
      } else {
        await createRule.mutateAsync(payload);
        toast({ title: "Billing rule added" });
      }
      setAddRuleOpen(false);
      setEditingRule(null);
      resetRuleForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyData) return;
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${companyData.companyId}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast({ title: "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  };

  const demandPreviewText = demandTemplate
    .replace(/\{\{client_name\}\}/g, "Rudin Management")
    .replace(/\{\{invoice_number\}\}/g, "INV-00042")
    .replace(/\{\{invoice_date\}\}/g, "November 14, 2025")
    .replace(/\{\{amount_due\}\}/g, "$2,950.00")
    .replace(/\{\{due_date\}\}/g, "December 14, 2025")
    .replace(/\{\{days_overdue\}\}/g, "62")
    .replace(/\{\{company_name\}\}/g, "Green Light Expediting LLC")
    .replace(/\{\{project_name\}\}/g, "340 Park Ave - Lehman Reno");

  const achPreviewText = achTemplate
    .replace(/\{\{company_name\}\}/g, "Green Light Expediting LLC")
    .replace(/\{\{invoice_number\}\}/g, "INV-00042")
    .replace(/\{\{total_amount\}\}/g, "$2,950.00")
    .replace(/\{\{payment_schedule\}\}/g, "  1. $983.34 due March 1, 2026\n  2. $983.33 due April 1, 2026\n  3. $983.33 due May 1, 2026")
    .replace(/\{\{effective_date\}\}/g, "February 14, 2026");

  return (
    <div className="space-y-4">
      {/* Expand / Collapse All */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
      </div>

      {/* Company Info */}
      <CollapsibleSettingsCard
        title="Company Info"
        description="This information appears on your invoice PDF header"
        icon={<Building2 className="h-4 w-4" />}
        isOpen={sectionStates.company ?? true}
        onOpenChange={(o) => setSectionOpen("company", o)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Image className="h-3.5 w-3.5" /> Company Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Company logo" className="h-14 w-auto max-w-[200px] object-contain rounded border p-1 bg-white" />
              ) : (
                <div className="h-14 w-32 rounded border border-dashed flex items-center justify-center text-xs text-muted-foreground">No logo</div>
              )}
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={logoUploading}>
                  <span>
                    {logoUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {logoUploading ? "Uploading..." : "Upload Logo"}
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} rows={2} placeholder="26 Broadway, 3rd Fl&#10;New York, NY 10004" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="718-392-1969" />
            </div>
            <div className="space-y-2">
              <Label>Fax</Label>
              <Input value={companyFax} onChange={(e) => setCompanyFax(e.target.value)} placeholder="718-228-9112" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="info@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="www.company.com" />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Invoice Header Text</Label>
            <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder="Optional text above invoice content" />
          </div>
          <div className="space-y-2">
            <Label>Invoice Footer Text</Label>
            <Textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} rows={2} placeholder="Thank you for your business. Payment due within terms specified above." />
          </div>
        </div>
      </CollapsibleSettingsCard>

      {/* Payment Methods */}
      <CollapsibleSettingsCard
        title="Payment Methods"
        description="Configure how clients can pay — shown on invoices and emails"
        icon={<CreditCard className="h-4 w-4" />}
        isOpen={sectionStates.payment ?? true}
        onOpenChange={(o) => setSectionOpen("payment", o)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Check — Mailing Address</Label>
            <Input value={checkAddress} onChange={(e) => setCheckAddress(e.target.value)} placeholder="26 Broadway, 3rd Fl, New York, NY 10004" />
          </div>
          <Separator />
          <Label className="text-sm font-medium">Wire Transfer</Label>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bank Name</Label>
              <Input value={wireBankName} onChange={(e) => setWireBankName(e.target.value)} placeholder="Chase" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Routing #</Label>
              <Input value={wireRouting} onChange={(e) => setWireRouting(e.target.value)} placeholder="021000021" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Account #</Label>
              <Input value={wireAccount} onChange={(e) => setWireAccount(e.target.value)} placeholder="•••••1234" />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Zelle ID</Label>
            <Input value={zelleId} onChange={(e) => setZelleId(e.target.value)} placeholder="payments@company.com" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Credit Card Payments</Label>
              <p className="text-xs text-muted-foreground">Enable credit card / ACH payments (Stripe)</p>
            </div>
            <Switch checked={ccEnabled} onCheckedChange={setCcEnabled} />
          </div>
          {ccEnabled && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Payment Link URL</Label>
              <Input value={ccUrl} onChange={(e) => setCcUrl(e.target.value)} placeholder="https://pay.stripe.com/..." />
            </div>
          )}
        </div>
      </CollapsibleSettingsCard>

      {/* Default Payment Terms */}
      <CollapsibleSettingsCard
        title="Default Payment Terms"
        description="Set the default payment terms for new invoices"
        isOpen={sectionStates.terms ?? true}
        onOpenChange={(o) => setSectionOpen("terms", o)}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Default Terms</Label>
            <Select value={defaultTerms} onValueChange={setDefaultTerms}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
      </CollapsibleSettingsCard>

      {/* Invoice Email Template */}
      <CollapsibleSettingsCard
        title="Invoice Email Template"
        description="Customize the email sent with each invoice"
        icon={<Mail className="h-4 w-4" />}
        isOpen={sectionStates.email ?? true}
        onOpenChange={(o) => setSectionOpen("email", o)}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Available Merge Fields</Label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {EMAIL_MERGE_FIELDS.map((f) => (
                <Badge
                  key={f.key} variant="secondary"
                  className="text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setEmailBody((p) => p + f.key)}
                  title={`Click to insert ${f.label}`}
                >
                  {f.key}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Subject Line</Label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Email Body</Label>
            <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={12} className="font-mono text-sm" />
          </div>
        </div>
      </CollapsibleSettingsCard>

      {/* Collections Timeline */}
      <CollapsibleSettingsCard
        title="Collections Timeline"
        description="Configure when follow-up actions are triggered for overdue invoices"
        isOpen={sectionStates.collections ?? true}
        onOpenChange={(o) => setSectionOpen("collections", o)}
      >
        <div className="space-y-4">
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
              <Input type="number" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} min={1} />
              <p className="text-xs text-muted-foreground">Attention level</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Second Reminder (days)</Label>
              <Input type="number" value={secondReminder} onChange={(e) => setSecondReminder(e.target.value)} min={1} />
              <p className="text-xs text-muted-foreground">Urgent level</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Demand Letter (days)</Label>
              <Input type="number" value={demandLetterDays} onChange={(e) => setDemandLetterDays(e.target.value)} min={1} />
              <p className="text-xs text-muted-foreground">Critical level</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Early payment discount</Label>
              <p className="text-xs text-muted-foreground">Offer a discount if paid within 15 days</p>
            </div>
            <Switch checked={earlyDiscount} onCheckedChange={setEarlyDiscount} />
          </div>
          {earlyDiscount && (
            <div className="space-y-2 w-32">
              <Label className="text-xs text-muted-foreground">Discount %</Label>
              <Input type="number" value={earlyDiscountPct} onChange={(e) => setEarlyDiscountPct(e.target.value)} min={0} max={100} step={0.5} />
            </div>
          )}
        </div>
      </CollapsibleSettingsCard>

      {/* Demand Letter Template */}
      <CollapsibleSettingsCard
        title="Demand Letter Template"
        description="Customize the formal demand letter sent to clients"
        isOpen={sectionStates.demand ?? true}
        onOpenChange={(o) => setSectionOpen("demand", o)}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setShowDemandPreview(true)}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Available Merge Fields</Label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DEMAND_MERGE_FIELDS.map((f) => (
                <Badge
                  key={f.key} variant="secondary"
                  className="text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setDemandTemplate((p) => p + f.key)}
                  title={`Click to insert ${f.label}`}
                >
                  {f.key}
                </Badge>
              ))}
            </div>
          </div>
          <Textarea value={demandTemplate} onChange={(e) => setDemandTemplate(e.target.value)} rows={14} className="font-mono text-sm" />
          <Button size="sm" variant="ghost" onClick={() => setDemandTemplate(DEFAULT_DEMAND_TEMPLATE)}>
            Reset to Default
          </Button>
        </div>
      </CollapsibleSettingsCard>

      {/* Demand Letter Preview Dialog */}
      <Dialog open={showDemandPreview} onOpenChange={setShowDemandPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demand Letter Preview</DialogTitle>
            <DialogDescription>This is how the letter will look with sample data.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif">
            {demandPreviewText}
          </div>
        </DialogContent>
      </Dialog>

      {/* ACH Authorization Template */}
      <CollapsibleSettingsCard
        title="ACH Authorization Template"
        description="Customize the ACH debit authorization agreement for payment plans"
        isOpen={sectionStates.ach ?? true}
        onOpenChange={(o) => setSectionOpen("ach", o)}
        headerAction={
          <Button variant="outline" size="sm" onClick={() => setShowAchPreview(true)}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Available Merge Fields</Label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ACH_MERGE_FIELDS.map((f) => (
                <Badge
                  key={f.key} variant="secondary"
                  className="text-[10px] cursor-pointer hover:bg-primary/20 transition-colors"
                  onClick={() => setAchTemplate((p) => p + f.key)}
                  title={`Click to insert ${f.label}`}
                >
                  {f.key}
                </Badge>
              ))}
            </div>
          </div>
          <Textarea value={achTemplate} onChange={(e) => setAchTemplate(e.target.value)} rows={14} className="font-mono text-sm" />
          <Button size="sm" variant="ghost" onClick={() => setAchTemplate(DEFAULT_ACH_TEMPLATE)}>
            Reset to Default
          </Button>
        </div>
      </CollapsibleSettingsCard>

      {/* ACH Authorization Preview Dialog */}
      <Dialog open={showAchPreview} onOpenChange={setShowAchPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ACH Authorization Preview</DialogTitle>
            <DialogDescription>This is how the authorization will look with sample data.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-6 bg-background whitespace-pre-wrap text-sm leading-relaxed font-serif">
            {achPreviewText}
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Billing Rules */}
      <CollapsibleSettingsCard
        title="Client Billing Rules"
        description="Special billing procedures per client"
        isOpen={sectionStates.rules ?? true}
        onOpenChange={(o) => setSectionOpen("rules", o)}
        headerAction={
          <Button size="sm" variant="outline" onClick={() => setAddRuleOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Rule
          </Button>
        }
      >
        {billingRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No billing rules configured yet</p>
        ) : (
          <div className="space-y-3">
            {billingRules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{rule.clients?.name || "Unknown Client"}</h4>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditRule(rule)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {(rule.vendor_id || rule.property_id) && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {rule.vendor_id && <span>Vendor ID: <span className="font-mono">{rule.vendor_id}</span></span>}
                    {rule.property_id && <span>Property ID: <span className="font-mono">{rule.property_id}</span></span>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {rule.require_waiver && <Badge variant="secondary" className="text-[10px]">Waiver Required</Badge>}
                  {rule.require_pay_app && <Badge variant="secondary" className="text-[10px]">Pay App Required</Badge>}
                  {(rule.wire_fee ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">Wire Fee: ${rule.wire_fee}</Badge>}
                  {(rule.cc_markup ?? 0) > 0 && <Badge variant="secondary" className="text-[10px]">CC Markup: {rule.cc_markup}%</Badge>}
                  {rule.special_portal_required && <Badge variant="secondary" className="text-[10px]">Portal Required</Badge>}
                </div>
                {rule.portal_url && (
                  <p className="text-xs text-muted-foreground">Portal: <a href={rule.portal_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{rule.portal_url}</a></p>
                )}
                {rule.special_instructions && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{rule.special_instructions}</p>
                )}
                <BillingRuleDocumentsSection billingRuleId={rule.id} />
              </div>
            ))}
          </div>
        )}
      </CollapsibleSettingsCard>

      {/* Add/Edit Billing Rule Dialog */}
      <Dialog open={addRuleOpen} onOpenChange={(open) => { setAddRuleOpen(open); if (!open) { setEditingRule(null); resetRuleForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit" : "Add"} Client Billing Rule</DialogTitle>
            <DialogDescription>Configure special billing procedures for a client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={newRuleClientId} onValueChange={setNewRuleClientId} disabled={!!editingRule}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Vendor ID</Label>
                <Input value={newRuleVendorId} onChange={(e) => setNewRuleVendorId(e.target.value)} placeholder="e.g. 06GRLIEX" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Property ID</Label>
                <Input value={newRulePropertyId} onChange={(e) => setNewRulePropertyId(e.target.value)} placeholder="e.g. NY109" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Require Waiver</Label>
                <Switch checked={newRuleWaiver} onCheckedChange={setNewRuleWaiver} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Require Pay App</Label>
                <Switch checked={newRulePayApp} onCheckedChange={setNewRulePayApp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Wire Fee ($)</Label>
                <Input type="number" value={newRuleWireFee} onChange={(e) => setNewRuleWireFee(e.target.value)} placeholder="15" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">CC Markup (%)</Label>
                <Input type="number" value={newRuleCcMarkup} onChange={(e) => setNewRuleCcMarkup(e.target.value)} placeholder="4" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Special Portal Required</Label>
              <Switch checked={newRulePortal} onCheckedChange={setNewRulePortal} />
            </div>
            {newRulePortal && (
              <div className="space-y-2">
                <Label className="text-sm">Portal URL</Label>
                <Input value={newRulePortalUrl} onChange={(e) => setNewRulePortalUrl(e.target.value)} placeholder="https://connectedbynexus.com/..." />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm">Special Instructions</Label>
              <Textarea value={newRuleInstructions} onChange={(e) => setNewRuleInstructions(e.target.value)} rows={4} placeholder="e.g. Email invoices to specific address, submit by 15th of each month, CC Antonio on all invoices..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRuleOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRule} disabled={!newRuleClientId || createRule.isPending || updateRule.isPending}>
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? "Save Changes" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QuickBooks Online */}
      <CollapsibleSettingsCard
        title="QuickBooks Online"
        description="Manage your QuickBooks Online integration"
        isOpen={sectionStates.qbo ?? true}
        onOpenChange={(o) => setSectionOpen("qbo", o)}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Connected to Green Light Expediting LLC</p>
                <p className="text-xs text-muted-foreground">Mock connection — Real QBO credentials required for production</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-destructive">Disconnect</Button>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Sync Frequency</Label>
              <Select value={qboSyncFreq} onValueChange={setQboSyncFreq}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="6hours">Every 6 Hours</SelectItem>
                  <SelectItem value="daily">Daily (2 AM)</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" /> Sync Now
              </Button>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <h5 className="text-xs font-medium text-muted-foreground mb-2">Recent Sync Activity</h5>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span>Last sync: Mock — enable QBO for live data</span>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSettingsCard>

      {/* Master Save */}
      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" /> Save All Settings
        </Button>
      </div>
    </div>
  );
}
