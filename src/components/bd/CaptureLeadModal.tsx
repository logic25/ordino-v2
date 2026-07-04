import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2, UserPlus, ChevronDown, ChevronRight, Upload,
  CalendarDays, Users, Phone, Mail, Globe, Search, Snowflake, MoreHorizontal, User, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useCreateLead, type LeadSourceType, type LeadTimeline } from "@/hooks/useLeads";

const SOURCES: { value: LeadSourceType; label: string; icon: typeof Phone }[] = [
  { value: "EVENT", label: "Event", icon: CalendarDays },
  { value: "IN_PERSON", label: "In person", icon: Users },
  { value: "REFERRAL", label: "Referral", icon: Users },
  { value: "PHONE", label: "Phone", icon: Phone },
  { value: "EMAIL", label: "Email", icon: Mail },
  { value: "WEBSITE", label: "Website", icon: Globe },
  { value: "GOOGLE", label: "Google", icon: Search },
  { value: "COLD", label: "Cold", icon: Snowflake },
  { value: "OTHER", label: "Other", icon: MoreHorizontal },
];

const TIMELINES: { value: LeadTimeline; label: string }[] = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "MONTHS_1_3", label: "1-3 months" },
  { value: "MONTHS_3_6", label: "3-6 months" },
  { value: "MONTHS_6_PLUS", label: "6-12 months" },
  { value: "PLANNING", label: "Planning" },
  { value: "UNKNOWN", label: "Unknown" },
];

const CLIENT_TYPES = [
  { value: "homeowner", label: "Homeowner" },
  { value: "property_manager", label: "Property Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "architect", label: "Architect" },
  { value: "developer", label: "Developer" },
  { value: "management_company", label: "Management Company" },
  { value: "government", label: "Government / Agency" },
  { value: "other", label: "Other" },
];

interface CaptureLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (leadId: string) => void;
}

/** Searchable client_contacts picker for the Referral source. Returns id + name. */
function ReferralContactPicker({
  contactId, name, onChange,
}: {
  contactId: string | null;
  name: string;
  onChange: (v: { contactId: string | null; name: string }) => void;
}) {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: contacts = [] } = useQuery({
    queryKey: ["referral-contacts"],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("id, name, company_name, email")
        .order("name");
      return data || [];
    },
  });

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return (contacts as any[])
      .filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [search, contacts]);

  if (name) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate">{name}{!contactId && " (new)"}</span>
        <button type="button" onClick={() => onChange({ contactId: null, name: "" })}
          className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => search.trim() && setOpen(true)}
        placeholder="Search contacts..."
        className="h-9 text-sm"
      />
      {open && search.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] rounded-md border bg-popover shadow-lg max-h-[220px] overflow-y-auto">
          {results.map((c) => (
            <button key={c.id} type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => { onChange({ contactId: c.id, name: c.name }); setSearch(""); setOpen(false); }}>
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="truncate">{c.name}</div>
                {(c.company_name || c.email) && (
                  <div className="text-xs text-muted-foreground truncate">{c.company_name || c.email}</div>
                )}
              </div>
            </button>
          ))}
          <div className="border-t" />
          <button type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-primary"
            onClick={() => { onChange({ contactId: null, name: search.trim() }); setOpen(false); }}>
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            <span>Use "{search.trim()}" (not in system)</span>
          </button>
        </div>
      )}
    </div>
  );
}

const blankParty = {
  architect_name: "", architect_company: "", architect_phone: "", architect_email: "",
  architect_license_type: "", architect_license_number: "",
  gc_name: "", gc_company: "", gc_phone: "", gc_email: "",
  sia_name: "", sia_company: "", sia_phone: "", sia_email: "",
  tpp_name: "", tpp_email: "",
};

export function CaptureLeadModal({ open, onOpenChange, onCreated }: CaptureLeadModalProps) {
  const { toast } = useToast();
  const createLead = useCreateLead();
  const { data: pmProfiles = [] } = useAssignableProfiles();

  const [sourceType, setSourceType] = useState<LeadSourceType>("PHONE");
  const [eventId, setEventId] = useState<string>("");
  const [referrer, setReferrer] = useState<{ contactId: string | null; name: string }>({ contactId: null, name: "" });

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientType, setClientType] = useState("");

  const [subject, setSubject] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [party, setParty] = useState({ ...blankParty });
  const [openParty, setOpenParty] = useState<string | null>(null);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);

  const [timeline, setTimeline] = useState<LeadTimeline | "">("");
  const [expectedValue, setExpectedValue] = useState("");
  const [hot, setHot] = useState(false);
  const [contactOnly, setContactOnly] = useState(false);

  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  // Event options: approved/registered/attended within the last 90 days.
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }, [open]);
  const { data: events = [] } = useQuery({
    queryKey: ["bd-events-pickable"],
    enabled: open && sourceType === "EVENT",
    queryFn: async () => {
      const { data } = await supabase
        .from("bd_events")
        .select("id, name, start_date, status")
        .in("status", ["APPROVED", "REGISTERED", "ATTENDED"])
        .gte("start_date", ninetyDaysAgo)
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const reset = () => {
    setSourceType("PHONE"); setEventId(""); setReferrer({ contactId: null, name: "" });
    setFullName(""); setCompany(""); setRole(""); setEmail(""); setPhone(""); setClientType("");
    setSubject(""); setPropertyAddress(""); setParty({ ...blankParty }); setOpenParty(null);
    setDrawingFiles([]); setTimeline(""); setExpectedValue(""); setHot(false);
    setContactOnly(false);
    setAssignedTo(""); setNotes("");
  };

  const canSave =
    fullName.trim().length > 0 &&
    (sourceType !== "EVENT" || !!eventId) &&
    (sourceType !== "REFERRAL" || !!referrer.name);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      const leadId = await createLead.mutateAsync({
        full_name: fullName.trim(),
        source_type: sourceType,
        company: company.trim() || null,
        role: role.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        client_type: clientType || null,
        subject: subject.trim() || null,
        property_address: propertyAddress.trim() || null,
        event_id: sourceType === "EVENT" ? eventId : null,
        referred_by: sourceType === "REFERRAL" ? referrer.name || null : null,
        referred_by_contact_id: sourceType === "REFERRAL" ? referrer.contactId : null,
        project_timeline: (timeline || null) as LeadTimeline | null,
        expected_value: expectedValue ? Number(expectedValue) : null,
        hot_opportunity: hot,
        lead_kind: contactOnly ? "CONTACT" : "PROSPECT",
        assigned_to: assignedTo || null,
        notes: notes.trim() || null,
        drawings_uploaded: drawingFiles.length > 0,
        ...Object.fromEntries(Object.entries(party).map(([k, v]) => [k, v.trim() || null])),
      } as any);
      toast({ title: "Lead captured", description: fullName.trim() });
      reset();
      onOpenChange(false);
      onCreated?.(leadId);
    } catch (e: any) {
      toast({ title: "Could not save lead", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const partyHas = (...vals: string[]) => vals.some((v) => v.trim().length > 0);
  const setP = (k: keyof typeof blankParty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParty((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Capture New Lead</DialogTitle>
          <DialogDescription>Log new business from any source. Becomes a Company when you create a proposal.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* a) Source */}
          <div className="space-y-2">
            <Label>Lead Source</Label>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => {
                const Icon = s.icon;
                return (
                  <Badge key={s.value}
                    variant={sourceType === s.value ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1.5 text-xs gap-1.5"
                    onClick={() => setSourceType(s.value)}>
                    <Icon className="h-3.5 w-3.5" />{s.label}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* b) Conditional */}
          {sourceType === "EVENT" && (
            <div className="space-y-1.5">
              <Label>Event *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
                <SelectContent>
                  {(events as any[]).map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name}{ev.start_date ? ` — ${new Date(ev.start_date).toLocaleDateString()}` : ""}
                    </SelectItem>
                  ))}
                  {events.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No eligible events</div>}
                </SelectContent>
              </Select>
            </div>
          )}
          {sourceType === "REFERRAL" && (
            <div className="space-y-1.5">
              <Label>Referred By *</Label>
              <ReferralContactPicker contactId={referrer.contactId} name={referrer.name} onChange={setReferrer} />
            </div>
          )}

          {/* c) Identity */}
          <div className="space-y-1.5">
            <Label htmlFor="cl-name">Name *</Label>
            <Input id="cl-name" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input placeholder="Owner, PM…" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="john@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="123-456-7890" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Client Type</Label>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* d) Permit context */}
          <div className="space-y-1.5">
            <Label>Opportunity</Label>
            <Input placeholder="What's the work? (e.g. Façade LL11, New Building, Violation)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Property Address</Label>
            <Input placeholder="123 Main St, Brooklyn, NY 11201" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} />
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Known Project Parties (optional)</p>
            {[
              { key: "architect", title: "Architect / Engineer", has: partyHas(party.architect_name, party.architect_company) },
              { key: "gc", title: "General Contractor", has: partyHas(party.gc_name, party.gc_company) },
              { key: "sia", title: "Special Inspector (SIA)", has: partyHas(party.sia_name, party.sia_company) },
              { key: "tpp", title: "TPP Applicant", has: partyHas(party.tpp_name, party.tpp_email) },
            ].map((block) => (
              <Collapsible key={block.key} open={openParty === block.key}
                onOpenChange={(o) => setOpenParty(o ? block.key : null)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-sm font-medium h-9 px-3">
                    <span className="flex items-center gap-2">
                      {block.title}
                      {block.has && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Added</Badge>}
                    </span>
                    {openParty === block.key ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 px-3 pb-2">
                  <div className="grid grid-cols-2 gap-2">
                    {block.key === "architect" && <>
                      <Input placeholder="Name" value={party.architect_name} onChange={setP("architect_name")} />
                      <Input placeholder="Company" value={party.architect_company} onChange={setP("architect_company")} />
                      <Input placeholder="Phone" value={party.architect_phone} onChange={setP("architect_phone")} />
                      <Input type="email" placeholder="Email" value={party.architect_email} onChange={setP("architect_email")} />
                      <Select value={party.architect_license_type} onValueChange={(v) => setParty((p) => ({ ...p, architect_license_type: v }))}>
                        <SelectTrigger><SelectValue placeholder="License type…" /></SelectTrigger>
                        <SelectContent><SelectItem value="RA">RA</SelectItem><SelectItem value="PE">PE</SelectItem></SelectContent>
                      </Select>
                      <Input placeholder="License #" value={party.architect_license_number} onChange={setP("architect_license_number")} />
                    </>}
                    {block.key === "gc" && <>
                      <Input placeholder="Name" value={party.gc_name} onChange={setP("gc_name")} />
                      <Input placeholder="Company" value={party.gc_company} onChange={setP("gc_company")} />
                      <Input placeholder="Phone" value={party.gc_phone} onChange={setP("gc_phone")} />
                      <Input type="email" placeholder="Email" value={party.gc_email} onChange={setP("gc_email")} />
                    </>}
                    {block.key === "sia" && <>
                      <Input placeholder="Name" value={party.sia_name} onChange={setP("sia_name")} />
                      <Input placeholder="Company" value={party.sia_company} onChange={setP("sia_company")} />
                      <Input placeholder="Phone" value={party.sia_phone} onChange={setP("sia_phone")} />
                      <Input type="email" placeholder="Email" value={party.sia_email} onChange={setP("sia_email")} />
                    </>}
                    {block.key === "tpp" && <>
                      <Input placeholder="Name" value={party.tpp_name} onChange={setP("tpp_name")} />
                      <Input type="email" placeholder="Email" value={party.tpp_email} onChange={setP("tpp_email")} />
                    </>}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>

          {/* Plans / Drawings */}
          <div className="space-y-1.5">
            <Label>Plans / Drawings</Label>
            <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 text-center">
              <input type="file" id="cl-drawings" className="hidden" multiple
                accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png"
                onChange={(e) => { if (e.target.files) setDrawingFiles((prev) => [...prev, ...Array.from(e.target.files!)]); }} />
              <label htmlFor="cl-drawings" className="cursor-pointer flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click to attach drawings (PDF, DWG, JPG)</span>
              </label>
              {drawingFiles.length > 0 && (
                <div className="mt-2 text-left space-y-1">
                  {drawingFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button className="text-destructive ml-2" onClick={() => setDrawingFiles((prev) => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* e) Qualification */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Project Timeline</Label>
              <Select value={timeline} onValueChange={(v) => setTimeline(v as LeadTimeline)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {TIMELINES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expected Value</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input type="number" className="pl-6" placeholder="0" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="cl-hot" checked={hot} onCheckedChange={(c) => setHot(!!c)} />
            <Label htmlFor="cl-hot" className="text-sm font-normal cursor-pointer">🔥 Hot opportunity</Label>
          </div>

          {/* f) Assignment + notes */}
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Assign to admin/PM..." /></SelectTrigger>
              <SelectContent>
                {pmProfiles.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Initial context — becomes the first note on the lead…" rows={3}
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {/* g) Contact-only flag */}
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              id="cl-contact-only"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-amber-600"
              checked={contactOnly}
              onChange={(e) => setContactOnly(e.target.checked)}
            />
            <Label htmlFor="cl-contact-only" className="text-sm font-normal cursor-pointer leading-tight">
              <span className="font-medium">Save as Contact only</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Someone you met but aren't actively pursuing. Skips the pipeline, can be promoted to a Prospect later.
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave || createLead.isPending}>
            {createLead.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              : <><UserPlus className="mr-2 h-4 w-4" />Save Lead</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
