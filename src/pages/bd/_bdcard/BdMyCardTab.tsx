import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Save, Loader2, Mail, Phone, Smartphone, MapPin, Linkedin, QrCode, Camera, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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

function ContactRow({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground/70 shrink-0">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
      {content}
    </a>
  ) : (
    content
  );
}

export function BdMyCardTab() {
  const { user, profile, refreshProfile } = useAuth() as any;
  const [fields, setFields] = useState<Fields>({
    first: "", last: "", title: "", email: "",
    phone: "", extension: "", mobile: "", linkedin: "", address: "",
  });
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState<null | "avatar" | "cover">(null);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const uploadImage = async (file: File, kind: "avatar" | "cover"): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user!.id}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signErr || !signed?.signedUrl) throw signErr || new Error("Could not sign URL");
    return signed.signedUrl;
  };

  const handleImageFile = (kind: "avatar" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id || !profile?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setUploading(kind);
    try {
      const url = await uploadImage(file, kind);
      if (kind === "avatar") {
        const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
        if (error) throw error;
      } else {
        const existingPrefs = (profile as any)?.preferences ?? {};
        const { error } = await supabase
          .from("profiles")
          .update({
            preferences: {
              ...existingPrefs,
              bd_card: { ...(existingPrefs.bd_card ?? {}), cover_url: url },
            },
          })
          .eq("id", profile.id);
        if (error) throw error;
        setCoverUrl(url);
      }
      toast.success(kind === "avatar" ? "Photo updated" : "Cover image updated");
      if (typeof refreshProfile === "function") await refreshProfile();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const clearCover = async () => {
    if (!profile?.id) return;
    const existingPrefs = (profile as any)?.preferences ?? {};
    const { error } = await supabase
      .from("profiles")
      .update({
        preferences: {
          ...existingPrefs,
          bd_card: { ...(existingPrefs.bd_card ?? {}), cover_url: null },
        },
      })
      .eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    setCoverUrl("");
    if (typeof refreshProfile === "function") await refreshProfile();
  };



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
    setCoverUrl(prefs.cover_url ?? "");
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

  const avatarUrl = (profile as any)?.avatar_url ?? "";
  const initials = `${(fields.first[0] ?? "").toUpperCase()}${(fields.last[0] ?? "").toUpperCase()}` || "GLE";

  return (
    <div className="mx-auto w-full max-w-[440px] space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
        </Button>
      </div>
      {/* Card */}
      <Card className="overflow-hidden print:shadow-none print:border-2 shadow-lg">
        {/* Banner */}
        <div
          className="relative h-28 bg-cover bg-center"
          style={{
            backgroundImage: coverUrl
              ? `url("${coverUrl}")`
              : "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 40%, #6aa84f 100%)",
          }}
        >
          {coverUrl && <div className="absolute inset-0 bg-black/20" />}
          <div className="absolute top-3 right-3 text-[10px] font-bold tracking-widest text-white/90 drop-shadow">
            GREEN LIGHT EXPEDITING
          </div>
          {/* Cover image edit controls */}
          <div className="absolute top-2 left-2 flex gap-1 print:hidden">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-[11px] bg-white/85 hover:bg-white text-foreground shadow"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === "cover"}
            >
              {uploading === "cover" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3 mr-1" />}
              {coverUrl ? "Change cover" : "Add cover"}
            </Button>
            {coverUrl && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-[11px] bg-white/85 hover:bg-white text-foreground shadow"
                onClick={clearCover}
              >
                Reset
              </Button>
            )}
          </div>

          {/* Avatar with always-visible edit button */}
          <div className="absolute -bottom-10 left-5">
            <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={`${fields.first} ${fields.last}`} />}
              <AvatarFallback className="text-xl font-semibold" style={{ backgroundColor: "#6aa84f", color: "white" }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploading === "avatar"}
              className="print:hidden absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-foreground text-background shadow-md ring-2 ring-background flex items-center justify-center hover:scale-105 transition"
              title="Change photo"
              aria-label="Change photo"
            >
              {uploading === "avatar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>

          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile("avatar")} />
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile("cover")} />
        </div>

        {/* Identity */}
        <CardContent className="pt-12 pb-4 px-5">
          <h2 className="text-xl font-bold leading-tight">
            {fields.first} {fields.last}
          </h2>
          {fields.title && (
            <p className="text-sm text-muted-foreground">{fields.title}</p>
          )}

          {/* Contact rows */}
          <div className="mt-4 space-y-2">
            {fields.email && (
              <ContactRow icon={<Mail className="h-4 w-4" />} label={fields.email} href={`mailto:${fields.email}`} />
            )}
            {phoneDisplay && (
              <ContactRow
                icon={<Phone className="h-4 w-4" />}
                label={`${phoneDisplay}${fields.extension ? ` · ext ${fields.extension}` : ""}`}
                href={`tel:${telValue(fields.phone, fields.extension)}`}
              />
            )}
            {mobileDisplay && (
              <ContactRow icon={<Smartphone className="h-4 w-4" />} label={mobileDisplay} href={`tel:${telValue(fields.mobile, "")}`} />
            )}
            {fields.linkedin && (
              <ContactRow icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" href={/^https?:\/\//i.test(fields.linkedin) ? fields.linkedin : `https://${fields.linkedin.replace(/^\/+/, "")}`} />
            )}
            <ContactRow
              icon={<MapPin className="h-4 w-4" />}
              label={addressDisplay.split("\n").join(" · ")}
            />
          </div>
        </CardContent>

        {/* QR section */}
        <div className="border-t bg-muted/30 px-5 py-4 flex items-center gap-4">
          <div className="relative bg-white p-3 rounded-md shrink-0 border">
            <QRCode value={card} size={160} level="H" />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <QrCode className="h-3.5 w-3.5" /> Scan to save contact
            </div>
            <p className="text-muted-foreground mt-1 leading-snug">
              Opens directly in their phone's contacts app — no app required.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end print:hidden">
        <Button variant="ghost" size="sm" onClick={downloadVcf} className="text-xs text-muted-foreground hover:text-foreground h-7">
          <Download className="mr-1.5 h-3.5 w-3.5" />Save contact (.vcf)
        </Button>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit my card</SheetTitle>
            <SheetDescription>Update what shows on your QR card and vCard.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
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
              <Button className="w-full" onClick={async () => { await saveToProfile(); setEditOpen(false); }} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save to my profile
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Auto-saves to this browser as you type. Click Save to sync across all devices.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
}
