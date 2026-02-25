import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2, Shield, Palette, Upload, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format, isPast } from "date-fns";

interface InsurancePolicy {
  type: string;
  carrier: string;
  policy_number: string;
  coverage_amount: string;
  expiration_date: string;
}

const INSURANCE_TYPES = [
  "General Liability",
  "Workers Compensation",
  "Professional Liability",
  "Umbrella / Excess",
  "Auto Liability",
  "Pollution / Environmental",
  "Cyber Liability",
  "Railroad Protective",
];

function InsuranceStatusBadge({ expirationDate }: { expirationDate: string }) {
  if (!expirationDate) return null;
  const date = new Date(expirationDate);
  const daysUntil = differenceInDays(date, new Date());
  const expired = isPast(date);

  if (expired) {
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertTriangle className="h-3 w-3" /> Expired {format(date, "MM/dd/yy")}
      </Badge>
    );
  }
  if (daysUntil <= 30) {
    return (
      <Badge className="text-xs gap-1 bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
        <AlertTriangle className="h-3 w-3" /> Expires in {daysUntil}d
      </Badge>
    );
  }
  if (daysUntil <= 90) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        Expires {format(date, "MMM d, yyyy")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1 text-green-700 dark:text-green-400 border-green-500/30">
      <CheckCircle2 className="h-3 w-3" /> Active until {format(date, "MMM d, yyyy")}
    </Badge>
  );
}

export function CompanySettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-settings", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile!.company_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [ein, setEin] = useState("");
  const [insurances, setInsurances] = useState<InsurancePolicy[]>([]);
  const [primaryColor, setPrimaryColor] = useState("#d97706");
  const [accentColor, setAccentColor] = useState("#0284c7");
  const [logoUrl, setLogoUrl] = useState("");
  const [gchatEnabled, setGchatEnabled] = useState(false);
  const [gchatSpaceId, setGchatSpaceId] = useState("");
  useEffect(() => {
    if (company) {
      setName(company.name || "");
      setEmail(company.email || "");
      setPhone(company.phone || "");
      setAddress(company.address || "");
      setWebsite(company.website || "");
      setEin((company as any).ein || "");
      const settings = company.settings as Record<string, any> | null;
      setInsurances(settings?.insurances || []);
      const theme = (company as any).theme as Record<string, any> | null;
      setPrimaryColor(theme?.primary_color || "#d97706");
      setAccentColor(theme?.accent_color || "#0284c7");
      setLogoUrl(theme?.logo_url || company.logo_url || "");
      setGchatEnabled(!!settings?.gchat_enabled);
      setGchatSpaceId(settings?.gchat_space_id || "");
    }
  }, [company]);

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const currentSettings = (company?.settings as Record<string, any>) || {};
      const { error } = await supabase
        .from("companies")
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          website: website.trim() || null,
          ein: ein.trim() || null,
          settings: { ...currentSettings, insurances, gchat_enabled: gchatEnabled, gchat_space_id: gchatSpaceId.trim() || null } as any,
          theme: { primary_color: primaryColor, accent_color: accentColor, logo_url: logoUrl } as any,
          logo_url: logoUrl || null,
        } as any)
        .eq("id", profile.company_id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Company updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addInsurance = () => {
    setInsurances([...insurances, { type: "", carrier: "", policy_number: "", coverage_amount: "", expiration_date: "" }]);
  };

  const updateInsurance = (idx: number, field: keyof InsurancePolicy, value: string) => {
    setInsurances(insurances.map((ins, i) => i === idx ? { ...ins, [field]: value } : ins));
  };

  const removeInsurance = (idx: number) => {
    setInsurances(insurances.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const expiredCount = insurances.filter((i) => i.expiration_date && isPast(new Date(i.expiration_date))).length;
  const expiringCount = insurances.filter((i) => {
    if (!i.expiration_date) return false;
    const d = differenceInDays(new Date(i.expiration_date), new Date());
    return d > 0 && d <= 30;
  }).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Update your organization's details. This information appears on invoices and proposals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>EIN / Tax ID</Label>
              <Input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="123 Main St, New York, NY 10001" />
          </div>

          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" />
          </div>
        </CardContent>
      </Card>

      {/* Insurance Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Insurance Policies
              </CardTitle>
              <CardDescription>Track your company's insurance policies and expiration dates.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {expiredCount > 0 && (
                <Badge variant="destructive" className="text-xs">{expiredCount} expired</Badge>
              )}
              {expiringCount > 0 && (
                <Badge className="text-xs bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                  {expiringCount} expiring soon
                </Badge>
              )}
              <Button size="sm" variant="outline" onClick={addInsurance}>
                <Plus className="h-4 w-4 mr-1" /> Add Policy
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {insurances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No insurance policies added yet. Click "Add Policy" to track your coverage.
            </p>
          ) : (
            <div className="space-y-4">
              {insurances.map((ins, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ins.type || `Policy ${idx + 1}`}</span>
                      <InsuranceStatusBadge expirationDate={ins.expiration_date} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeInsurance(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={ins.type}
                        onChange={(e) => updateInsurance(idx, "type", e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {INSURANCE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Carrier</Label>
                      <Input
                        value={ins.carrier}
                        onChange={(e) => updateInsurance(idx, "carrier", e.target.value)}
                        placeholder="e.g. Hartford"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Policy #</Label>
                      <Input
                        value={ins.policy_number}
                        onChange={(e) => updateInsurance(idx, "policy_number", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Coverage Amount</Label>
                      <Input
                        value={ins.coverage_amount}
                        onChange={(e) => updateInsurance(idx, "coverage_amount", e.target.value)}
                        placeholder="$1,000,000"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiration Date</Label>
                      <Input
                        type="date"
                        value={ins.expiration_date}
                        onChange={(e) => updateInsurance(idx, "expiration_date", e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Brand Theme
          </CardTitle>
          <CardDescription>Customize your brand colors and logo for RFP exports and documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Logo URL</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://yourcompany.com/logo.png"
            />
            {logoUrl && (
              <div className="border rounded-lg p-3 bg-muted/30 flex items-center gap-3">
                <img src={logoUrl} alt="Logo preview" className="h-10 w-auto max-w-[160px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-md border border-input cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-md border border-input cursor-pointer"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These colors will be used in RFP response previews and exported documents.
          </p>
        </CardContent>
      </Card>

      {/* Google Chat Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Google Chat Integration
          </CardTitle>
          <CardDescription>Post tasks to a Google Chat Space and allow team members to complete them directly in chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Google Chat notifications</Label>
              <p className="text-xs text-muted-foreground">New tasks will be posted as cards to the configured space.</p>
            </div>
            <Switch checked={gchatEnabled} onCheckedChange={setGchatEnabled} />
          </div>
          {gchatEnabled && (
            <div className="space-y-2">
              <Label>GChat Space ID</Label>
              <Input
                value={gchatSpaceId}
                onChange={(e) => setGchatSpaceId(e.target.value)}
                placeholder="spaces/AAAA..."
              />
              <p className="text-xs text-muted-foreground">
                Find this in Google Chat: open the Space, click the space name → "Space details". The space ID is the last part of the URL.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving || !name.trim()}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Save Changes
      </Button>
    </div>
  );
}
