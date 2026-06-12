import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Printer, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COMPANY = {
  org: "Green Light Expediting",
  url: "https://www.greenlightexpediting.com",
  // ADR format: PO Box; Extended; Street; City; Region; Postal; Country
  adr: ";;26 Broadway, 3rd Floor;New York;NY;10004;USA",
  addressDisplay: "26 Broadway, 3rd Floor\nNew York, NY 10004",
};

// Format any US-ish number to (xxx) xxx-xxxx for display.
function fmtPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw || "";
}

// vCard wants a tel-uri-ish value; keep digits + ext as pause.
function telValue(phone: string, ext: string): string {
  const d = (phone || "").replace(/\D/g, "");
  const e164 = d.length === 10 ? `+1${d}` : d.startsWith("1") ? `+${d}` : d;
  return ext ? `${e164};ext=${ext}` : e164;
}

type Fields = {
  first: string; last: string; title: string; email: string;
  phone: string; extension: string; mobile: string; linkedin: string;
  address: string;
};

function vCard(p: Fields) {
  // If user provided a personal address, use that as ADR — semicolon-separated;
  // newlines become "extended" segments. Fall back to company HQ.
  const adr = p.address
    ? ";;" + p.address.replace(/\n+/g, ", ").replace(/;/g, ",") + ";;;;"
    : COMPANY.adr;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${p.last};${p.first};;;`,
    `FN:${p.first} ${p.last}`.trim(),
    `ORG:${COMPANY.org}`,
    p.title && `TITLE:${p.title}`,
    p.phone && `TEL;TYPE=WORK,VOICE:${telValue(p.phone, p.extension)}`,
    p.mobile && `TEL;TYPE=CELL,VOICE:${telValue(p.mobile, "")}`,
    p.email && `EMAIL;TYPE=WORK:${p.email}`,
    `URL:${COMPANY.url}`,
    p.linkedin && `URL;TYPE=LinkedIn:${p.linkedin}`,
    p.linkedin && `X-SOCIALPROFILE;TYPE=linkedin:${p.linkedin}`,
    `ADR;TYPE=WORK:${adr}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

const LS_KEY = "qr-card-fields";

export function BdMyCardTab() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const [fields, setFields] = useState<Fields>({
    first: "", last: "", title: "", email: "",
    phone: "", extension: "", mobile: "", linkedin: "", address: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    const prefs = (profile as any)?.preferences?.bd_card ?? {};
    setFields({
      first: profile?.first_name ?? "",
      last: profile?.last_name ?? "",
      title: (profile as any)?.job_title ?? "",
      email: user?.email ?? "",
      phone: (profile as any)?.phone ?? saved.phone ?? "",
      extension: (profile as any)?.phone_extension ?? saved.extension ?? "",
      mobile: prefs.mobile ?? saved.mobile ?? "",
      linkedin: prefs.linkedin ?? saved.linkedin ?? "",
      address: prefs.address ?? saved.address ?? "",
    });
  }, [profile?.id, user?.email]);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({
      phone: fields.phone, extension: fields.extension,
      mobile: fields.mobile, linkedin: fields.linkedin, address: fields.address,
    }));
  }, [fields.phone, fields.extension, fields.mobile, fields.linkedin, fields.address]);

  const card = useMemo(() => vCard(fields), [fields]);

  const downloadVcf = () => {
    const blob = new Blob([card], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fields.first}-${fields.last}-GLE.vcf`.replace(/\s+/g, "");
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToProfile = async () => {
    if (!profile?.id) {
      toast.error("Profile not loaded yet");
      return;
    }
    setSaving(true);
    try {
      const existingPrefs = (profile as any)?.preferences ?? {};
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: fields.first || null,
          last_name: fields.last || null,
          job_title: fields.title || null,
          phone: fields.phone || null,
          phone_extension: fields.extension || null,
          preferences: {
            ...existingPrefs,
            bd_card: {
              mobile: fields.mobile || null,
              linkedin: fields.linkedin || null,
              address: fields.address || null,
            },
          },
        })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success("Saved to your profile");
      if (typeof refreshProfile === "function") await refreshProfile();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const phoneDisplay = fmtPhone(fields.phone);
  const mobileDisplay = fmtPhone(fields.mobile);
  const addressDisplay = fields.address || COMPANY.addressDisplay;

  return (
    <div className="space-y-4">
      <Card className="print:shadow-none print:border-2">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <div className="bg-white p-4 rounded-lg">
            <QRCode value={card} size={220} level="M" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-lg">{fields.first} {fields.last}</p>
            {fields.title && <p className="text-sm text-muted-foreground">{fields.title}</p>}
            <p className="text-sm">
              <span className="font-medium" style={{ color: "#6aa84f" }}>GREEN LIGHT</span> EXPEDITING
            </p>
            <div className="text-xs text-muted-foreground pt-2 space-y-0.5">
              {phoneDisplay && (
                <p>
                  {phoneDisplay}
                  {fields.extension && <span> · ext {fields.extension}</span>}
                </p>
              )}
              {mobileDisplay && <p>Cell {mobileDisplay}</p>}
              {fields.email && <p>{fields.email}</p>}
              <p className="whitespace-pre-line">{addressDisplay}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 print:hidden">
        <Button className="flex-1" onClick={downloadVcf}><Download className="mr-2 h-4 w-4" />Download .vcf</Button>
        <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
      </div>

      <Card className="print:hidden">
        <CardContent className="p-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>First name</Label><Input value={fields.first} onChange={set("first")} /></div>
          <div className="space-y-1.5"><Label>Last name</Label><Input value={fields.last} onChange={set("last")} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Title</Label><Input value={fields.title} onChange={set("title")} placeholder="e.g. Senior Project Manager" /></div>
          <div className="space-y-1.5 col-span-2"><Label>Email</Label><Input value={fields.email} onChange={set("email")} /></div>
          <div className="space-y-1.5"><Label>Office phone</Label><Input placeholder="(718) 392-1969" value={fields.phone} onChange={set("phone")} /></div>
          <div className="space-y-1.5"><Label>Extension</Label><Input placeholder="12" value={fields.extension} onChange={set("extension")} /></div>
          <div className="space-y-1.5 col-span-2"><Label>Cell</Label><Input placeholder="(347) 555-1234" value={fields.mobile} onChange={set("mobile")} /></div>
          <div className="space-y-1.5 col-span-2"><Label>LinkedIn URL</Label>
            <Input placeholder="https://linkedin.com/in/…" value={fields.linkedin} onChange={set("linkedin")} /></div>
          <div className="space-y-1.5 col-span-2">
            <Label>Address (leave blank to use GLE HQ)</Label>
            <Textarea
              rows={2}
              placeholder={COMPANY.addressDisplay}
              value={fields.address}
              onChange={set("address")}
            />
          </div>
          <div className="col-span-2">
            <Button className="w-full" onClick={saveToProfile} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save to my profile
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Auto-saves to this browser as you type. Click Save to sync across all devices.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
