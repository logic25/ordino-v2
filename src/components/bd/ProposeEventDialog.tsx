import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const EVENT_TYPES = [
  "CONFERENCE", "NETWORKING", "WEBINAR", "ROUNDTABLE", "AWARD_CEREMONY", "OTHER",
] as const;

interface FormState {
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  source_url: string;
  event_type: string;
  target_audience: string;
  why_it_matters: string;
  cost_low: string;
  cost_high: string;
  cost_member: string;
}

const EMPTY: FormState = {
  name: "", start_date: "", end_date: "", location: "", source_url: "",
  event_type: "CONFERENCE", target_audience: "", why_it_matters: "",
  cost_low: "", cost_high: "", cost_member: "",
};

export function ProposeEventDialog({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState("paste");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paste, setPaste] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleParse = async () => {
    if (!paste.trim()) return;
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-event-url", {
        body: { input: paste.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setForm((f) => ({
        ...f,
        name: data.title ?? f.name,
        start_date: data.start_date ?? f.start_date,
        end_date: data.end_date ?? f.end_date,
        location: data.location ?? f.location,
        source_url: data.source_url ?? f.source_url,
        event_type: data.event_type ?? f.event_type,
        target_audience: data.target_audience ?? f.target_audience,
        why_it_matters: data.why_it_matters ?? f.why_it_matters,
        cost_low: data.cost_low != null ? String(data.cost_low) : f.cost_low,
        cost_high: data.cost_high != null ? String(data.cost_high) : f.cost_high,
        cost_member: data.cost_member != null ? String(data.cost_member) : f.cost_member,
      }));
      setTab("form");
      toast({ title: "Parsed", description: "Review and submit." });
    } catch (e: any) {
      toast({ title: "Could not parse", description: e?.message ?? "Try the manual form.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile?.company_id || !profile?.id) return;
    if (!form.name.trim() || !form.start_date) {
      toast({ title: "Missing fields", description: "Name and start date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: ev, error } = await supabase.from("bd_events").insert({
        company_id: profile.company_id,
        created_by: profile.id,
        proposed_by: profile.id,
        status: "PENDING_APPROVAL",
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date || null,
        location: form.location.trim() || null,
        source_url: form.source_url.trim() || null,
        event_type: form.event_type,
        target_audience: form.target_audience.trim() || null,
        why_it_matters: form.why_it_matters.trim() || null,
        cost_low: form.cost_low ? Number(form.cost_low) : null,
        cost_high: form.cost_high ? Number(form.cost_high) : null,
        cost_member: form.cost_member ? Number(form.cost_member) : null,
        intel: {
          source_url: form.source_url.trim() || null,
          proposed_at: new Date().toISOString(),
        },
      } as any).select("id").single();
      if (error) throw error;

      // Notify all admins in the company
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .eq("company_id", profile.company_id)
        .eq("role", "admin");

      const proposerName =
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        profile.display_name || "Someone";

      const rows = (admins || []).map((a: any) => ({
        company_id: profile.company_id,
        user_id: a.id,
        type: "event_proposed",
        title: `${proposerName} proposed: ${form.name.trim()}`,
        body: "Review and approve or decline in BD → Events → Proposed tab.",
        link: `/bd/events/${ev.id}`,
        event_id: ev.id,
      }));
      if (rows.length > 0) {
        const { error: nErr } = await supabase.from("notifications").insert(rows as any);
        if (nErr) console.error("notify admins failed:", nErr.message);
      }

      qc.invalidateQueries({ queryKey: ["bd-events"] });
      toast({ title: "Event proposed", description: "Admins notified for approval." });
      setForm(EMPTY);
      setPaste("");
      onOpenChange(false);
      navigate(`/bd/events/${ev.id}`);
    } catch (e: any) {
      toast({ title: "Could not propose event", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Propose event</DialogTitle>
          <DialogDescription>Paste a URL/email or fill in the details manually. Admins will approve.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="paste"><Sparkles className="h-4 w-4 mr-1.5" />Quick-parse</TabsTrigger>
            <TabsTrigger value="form">Manual form</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 pt-3">
            <Label>Paste the event URL or email text from Sai</Label>
            <Textarea
              rows={8} value={paste} onChange={(e) => setPaste(e.target.value)}
              placeholder="https://example.com/event  — or paste the email body"
            />
            <Button onClick={handleParse} disabled={!paste.trim() || parsing} className="w-full">
              {parsing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Parse with AI
            </Button>
          </TabsContent>

          <TabsContent value="form" className="space-y-3 pt-3 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Event name *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Source URL</Label>
              <Input value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Event type</Label>
                <Select value={form.event_type} onValueChange={(v) => set("event_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target audience</Label>
                <Input value={form.target_audience} onChange={(e) => set("target_audience", e.target.value)}
                  placeholder="Architects, GCs, Owners…" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Why it matters</Label>
              <Textarea rows={2} value={form.why_it_matters} onChange={(e) => set("why_it_matters", e.target.value)}
                placeholder="1-sentence GLE relevance" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Cost low</Label>
                <Input type="number" value={form.cost_low} onChange={(e) => set("cost_low", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost high</Label>
                <Input type="number" value={form.cost_high} onChange={(e) => set("cost_high", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Member price</Label>
                <Input type="number" value={form.cost_member} onChange={(e) => set("cost_member", e.target.value)} />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !form.name.trim() || !form.start_date}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
