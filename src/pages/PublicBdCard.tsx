import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Mail, Phone, Smartphone, MapPin, Linkedin, Share2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import companyLogo from "@/assets/company-logo-hosted.webp";
import mbeSeal from "@/assets/mbe-seal.png";

const COMPANY = {
  org: "Green Light Expediting",
  url: "https://www.greenlightexpediting.com",
  adr: ";;26 Broadway, 3rd Floor;New York;NY;10004;USA",
  addressDisplay: "26 Broadway, 3rd Floor\nNew York, NY 10004",
};

type Fields = {
  first?: string; last?: string; title?: string; email?: string;
  phone?: string; extension?: string; mobile?: string; linkedin?: string; address?: string;
};

type LogoCfg = { height: number; top: number; right: number; width: number };
const LOGO_DEFAULT: LogoCfg = { height: 18, top: 12, right: 16, width: 224 };

function fmtPhone(raw?: string) {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return raw || "";
}
function telValue(phone?: string, ext?: string) {
  const d = (phone || "").replace(/\D/g, "");
  const e164 = d.length === 10 ? `+1${d}` : d.startsWith("1") ? `+${d}` : d;
  return ext ? `${e164};ext=${ext}` : e164;
}

export function buildVcf(p: Fields) {
  const adr = p.address
    ? ";;" + p.address.replace(/\n+/g, ", ").replace(/;/g, ",") + ";;;;"
    : COMPANY.adr;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${p.last || ""};${p.first || ""};;;`,
    `FN:${(p.first || "")} ${(p.last || "")}`.trim(),
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

function Row({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground/70 shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">{inner}</a> : inner;
}

export default function PublicBdCard() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<{
    fields: Fields; photo_url: string | null; cover_url: string | null; logo_cfg: LogoCfg;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("bd_cards")
        .select("fields, photo_url, cover_url, logo_cfg, published")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setCard(null);
      } else {
        setCard({
          fields: (data.fields ?? {}) as Fields,
          photo_url: data.photo_url,
          cover_url: data.cover_url,
          logo_cfg: { ...LOGO_DEFAULT, ...(data.logo_cfg ?? {}) },
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const vcf = useMemo(() => (card ? buildVcf(card.fields) : ""), [card]);
  const fullName = card ? `${card.fields.first ?? ""} ${card.fields.last ?? ""}`.trim() : "";

  useEffect(() => {
    if (fullName) {
      document.title = `${fullName} — ${COMPANY.org}`;
    }
  }, [fullName]);

  const saveContact = () => {
    if (!card) return;
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(card.fields.first || "contact")}-${(card.fields.last || "")}-GLE.vcf`.replace(/\s+/g, "");
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareCard = async () => {
    const url = window.location.href;
    const shareData: ShareData = { title: `${fullName} — ${COMPANY.org}`, text: `Contact card for ${fullName}`, url };
    try {
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message ?? "Share failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold mb-2">Card not found</h1>
          <p className="text-muted-foreground text-sm">This card may have been unpublished or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const { fields, photo_url, cover_url, logo_cfg } = card;
  const initials = `${(fields.first?.[0] ?? "").toUpperCase()}${(fields.last?.[0] ?? "").toUpperCase()}` || "GLE";
  const phoneDisplay = fmtPhone(fields.phone);
  const mobileDisplay = fmtPhone(fields.mobile);
  const addressDisplay = fields.address || COMPANY.addressDisplay;
  const qrValue = window.location.href;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto w-full max-w-[440px] space-y-4">
        <Card className="overflow-hidden shadow-lg">
          <div
            className="relative h-28 bg-cover bg-center"
            style={{
              backgroundImage: cover_url
                ? `url("${cover_url}")`
                : "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 40%, #6aa84f 100%)",
            }}
          >
            {cover_url && <div className="absolute inset-0 bg-black/20" />}
            <div className="absolute -bottom-10 left-5">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
                {photo_url && <AvatarImage src={photo_url} alt={fullName} />}
                <AvatarFallback className="text-xl font-semibold" style={{ backgroundColor: "#6aa84f", color: "white" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <CardContent className="pt-12 pb-4 px-5 relative">
            <div
              className="absolute"
              style={{
                top: `${logo_cfg.top}px`,
                right: `${logo_cfg.right}px`,
                height: `${logo_cfg.height}px`,
                width: `${logo_cfg.width}px`,
              }}
            >
              <img src={companyLogo} alt="Green Light Expediting" className="h-full w-full object-contain object-left" />
            </div>

            <h1 className="text-xl font-bold leading-tight">{fullName}</h1>
            {fields.title && <p className="text-sm text-muted-foreground">{fields.title}</p>}

            <div className="mt-4 space-y-2">
              {fields.email && <Row icon={<Mail className="h-4 w-4" />} label={fields.email} href={`mailto:${fields.email}`} />}
              {phoneDisplay && (
                <Row
                  icon={<Phone className="h-4 w-4" />}
                  label={`${phoneDisplay}${fields.extension ? ` · ext ${fields.extension}` : ""}`}
                  href={`tel:${telValue(fields.phone, fields.extension)}`}
                />
              )}
              {mobileDisplay && <Row icon={<Smartphone className="h-4 w-4" />} label={mobileDisplay} href={`tel:${telValue(fields.mobile, "")}`} />}
              {fields.linkedin && (
                <Row icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" href={/^https?:\/\//i.test(fields.linkedin) ? fields.linkedin : `https://${fields.linkedin.replace(/^\/+/, "")}`} />
              )}
              <Row icon={<MapPin className="h-4 w-4" />} label={addressDisplay.split("\n").join(" · ")} />
            </div>
          </CardContent>

          <div className="border-t bg-muted/30 px-5 py-4 flex items-center gap-4">
            <div className="relative bg-white p-3 rounded-md shrink-0 border">
              <QRCode value={qrValue} size={132} level="H" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <img src={mbeSeal} alt="NYC Minority Business Enterprise certified" className="h-12 w-12 self-start" loading="lazy" width={48} height={48} />
              <div className="flex flex-col gap-1.5">
                <Button size="sm" onClick={saveContact} className="h-8 text-xs justify-start">
                  <Download className="mr-1.5 h-3.5 w-3.5" />Save contact
                </Button>
                <Button size="sm" variant="outline" onClick={shareCard} className="h-8 text-xs justify-start">
                  <Share2 className="mr-1.5 h-3.5 w-3.5" />Share
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
