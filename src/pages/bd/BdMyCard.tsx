import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * My QR Card — the give-them-YOUR-info half of the Popl replacement.
 * The QR encodes a vCard directly: any phone camera scans it and offers
 * "Add Contact" instantly — no app, no webpage, works offline at a venue.
 */

const COMPANY = {
  org: "Green Light Expediting",
  url: "https://www.greenlightexpediting.com",
  adr: ";;26 Broadway, 3rd Floor;New York;NY;10004;USA",
};

function vCard(p: { first: string; last: string; title: string; email: string; phone: string; mobile: string }) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${p.last};${p.first};;;`,
    `FN:${p.first} ${p.last}`.trim(),
    `ORG:${COMPANY.org}`,
    p.title && `TITLE:${p.title}`,
    p.phone && `TEL;TYPE=WORK,VOICE:${p.phone}`,
    p.mobile && `TEL;TYPE=CELL:${p.mobile}`,
    p.email && `EMAIL;TYPE=WORK:${p.email}`,
    `URL:${COMPANY.url}`,
    `ADR;TYPE=WORK:${COMPANY.adr}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

const LS_KEY = "qr-card-fields";

export default function BdMyCard() {
  const { user, profile } = useAuth();
  const [fields, setFields] = useState({ first: "", last: "", title: "", email: "", phone: "", mobile: "" });

  // Prefill from profile once; phone/mobile persist locally (not on profiles for everyone).
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
    setFields((f) => ({
      first: profile?.first_name ?? f.first,
      last: profile?.last_name ?? f.last,
      title: (profile as any)?.job_title ?? f.title,
      email: user?.email ?? f.email,
      phone: saved.phone ?? (profile as any)?.phone ?? "",
      mobile: saved.mobile ?? "",
    }));
  }, [profile?.id, user?.email]);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ phone: fields.phone, mobile: fields.mobile }));
  }, [fields.phone, fields.mobile]);

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

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppLayout>
      <div className="max-w-md mx-auto space-y-4 animate-fade-in pb-10">
        <div className="print:hidden">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <QrCode className="h-5 w-5" />My QR Card
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let them scan YOU. Any phone camera reads this and offers "Add Contact" — no app needed.
          </p>
        </div>

        {/* The card */}
        <Card className="print:shadow-none print:border-2">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-lg">
              <QRCode value={card} size={220} level="M" />
            </div>
            <div className="text-center">
              <p className="font-semibold">{fields.first} {fields.last}</p>
              <p className="text-sm text-muted-foreground">{fields.title}</p>
              <p className="text-sm">
                <span className="font-medium" style={{ color: "#6aa84f" }}>GREEN LIGHT</span> EXPEDITING
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 print:hidden">
          <Button className="flex-1" onClick={downloadVcf}><Download className="mr-2 h-4 w-4" />Download .vcf</Button>
          <Button variant="outline" className="flex-1" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
        </div>

        {/* Fields */}
        <Card className="print:hidden">
          <CardContent className="p-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>First name</Label><Input value={fields.first} onChange={set("first")} /></div>
            <div className="space-y-1.5"><Label>Last name</Label><Input value={fields.last} onChange={set("last")} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Title</Label><Input value={fields.title} onChange={set("title")} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Email</Label><Input value={fields.email} onChange={set("email")} /></div>
            <div className="space-y-1.5"><Label>Office phone</Label><Input placeholder="718-392-1969 x12" value={fields.phone} onChange={set("phone")} /></div>
            <div className="space-y-1.5"><Label>Cell</Label><Input placeholder="347-…" value={fields.mobile} onChange={set("mobile")} /></div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center print:hidden">
          Tip: save the QR to your phone's lock-screen widget or wallet for instant access at events.
          When THEY give YOU a card, use BD → Capture.
        </p>
      </div>
    </AppLayout>
  );
}
