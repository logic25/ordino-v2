import { useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, UserPlus, RotateCcw, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCreateLead } from "@/hooks/useLeads";

interface ScannedContact {
  readable?: boolean;
  full_name?: string; company?: string; role?: string; email?: string;
  phone?: string; mobile?: string; website?: string; address?: string;
}

// Format US-ish number to (xxx) xxx-xxxx.
function fmtPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw || "";
}

async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function BdScanTab() {
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { profile } = useAuth();
  const createLead = useCreateLead();
  const fileRef = useRef<HTMLInputElement>(null);

  const [eventId, setEventId] = useState<string>(params.get("event") ?? "");
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedCount, setCapturedCount] = useState(0);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [hot, setHot] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["bd-events-capture"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_events")
        .select("id, name, start_date, status")
        .in("status", ["APPROVED", "REGISTERED", "ATTENDED"])
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const defaultEventId = useMemo(() => {
    if (eventId) return eventId;
    const today = new Date().toISOString().slice(0, 10);
    const todayEv = (events as any[]).find((e) => e.start_date === today);
    if (todayEv) return todayEv.id;
    const upcoming = (events as any[]).find((e) => e.start_date >= today);
    return upcoming?.id ?? "";
  }, [eventId, events]);

  const resetForm = () => {
    setFullName(""); setCompany(""); setRole(""); setEmail(""); setPhone("");
    setNotes(""); setHot(false); setPreview(null);
  };

  const handlePhoto = async (file: File) => {
    setScanning(true);
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      const { data, error } = await supabase.functions.invoke("scan-business-card", {
        body: { image_base64: dataUrl, mime: "image/jpeg" },
      });
      if (error) throw error;
      const c: ScannedContact = data?.contact ?? {};
      if (c.readable === false) {
        toast({ title: "Couldn't read the card", description: "Try again — closer, flat, good light. Or type it in below." });
      } else {
        setFullName(c.full_name ?? ""); setCompany(c.company ?? "");
        setRole(c.role ?? ""); setEmail(c.email ?? ""); setPhone(c.phone ?? "");
        toast({ title: "Card scanned", description: c.full_name ?? "Review the fields below" });
      }
    } catch (e: any) {
      toast({ title: "Scan failed", description: e?.message ?? "Type the contact in manually.", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) return;
    try {
      await createLead.mutateAsync({
        full_name: fullName.trim(),
        source_type: "EVENT",
        event_id: defaultEventId || null,
        company: company.trim() || null,
        role: role.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        hot_opportunity: hot,
        assigned_to: profile?.id ?? null,
        notes: notes.trim() || null,
      });
      setCapturedCount((n) => n + 1);
      toast({ title: `Lead captured (${capturedCount + 1} this session)`, description: fullName.trim() });
      resetForm();
    } catch (e: any) {
      toast({ title: "Could not save lead", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {capturedCount > 0 && (
        <div className="flex items-center justify-end gap-1 text-sm font-medium text-green-600">
          <CheckCircle2 className="h-4 w-4" />{capturedCount} captured
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Event</Label>
        <Select value={defaultEventId} onValueChange={setEventId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Pick the event…" /></SelectTrigger>
          <SelectContent>
            {(events as any[]).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}{e.start_date ? ` — ${new Date(e.start_date + "T12:00:00").toLocaleDateString()}` : ""}
              </SelectItem>
            ))}
            {events.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No approved events — add one in BD → Events</div>}
          </SelectContent>
        </Select>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ""; }} />
      <Button className="w-full h-14 text-base" onClick={() => fileRef.current?.click()} disabled={scanning}>
        {scanning
          ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Reading card…</>
          : <><Camera className="mr-2 h-5 w-5" />Scan business card</>}
      </Button>
      {preview && (
        <Card><CardContent className="p-2">
          <img src={preview} alt="Card preview" className="rounded max-h-36 mx-auto" />
        </CardContent></Card>
      )}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5"><Label>Name *</Label>
            <Input className="h-11" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Company</Label>
              <Input className="h-11" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Role</Label>
              <Input className="h-11" value={role} onChange={(e) => setRole(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label>
            <Input className="h-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Phone</Label>
            <Input className="h-11" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Context</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <label className="flex items-center gap-2 py-1">
            <Checkbox checked={hot} onCheckedChange={(c) => setHot(!!c)} />
            <span className="text-sm">🔥 Hot — follow up first</span>
          </label>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11" onClick={resetForm}><RotateCcw className="h-4 w-4" /></Button>
            <Button className="flex-1 h-11" onClick={handleSave} disabled={!fullName.trim() || createLead.isPending}>
              {createLead.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Save & next
            </Button>
          </div>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Leads appear in <Link to="/bd/leads" className="underline">BD → Leads</Link> with source = Event.
      </p>
    </div>
  );
}
