import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, UserPlus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAssignableProfiles } from "@/hooks/useProfiles";
import { useCreateBdReferral } from "@/hooks/useBdReferrals";
import { useToast } from "@/hooks/use-toast";
import {
  ALL_STAGES,
  STAGE_META,
  SOURCE_TYPE_META,
  type ReferralStage,
  type ReferralSourceType,
} from "@/components/bd/referralConstants";

const schema = z.object({
  source_contact_id: z.string().nullable(),
  source_label: z.string().nullable(),
  source_type: z.enum(["ARCHITECT", "GC", "OWNER", "PM", "OTHER"]),
  referred_name: z.string().min(1, "Required"),
  referred_company: z.string().optional(),
  referred_email: z.string().email().optional().or(z.literal("")),
  referred_phone: z.string().optional(),
  assigned_to: z.string().min(1, "Pick an owner"),
  stage: z.enum(["ASK_MADE", "INTRO_RECEIVED", "MEETING_SET", "PROPOSAL", "WON", "LOST"]),
  next_action_at: z.string().optional(),
  notes: z.string().optional(),
});
type FormVals = z.infer<typeof schema>;

/** Searchable client_contacts picker. Surfaces is_referrer=true contacts first.
 *  Toggle "Show all" reveals the rest. */
function SourceContactPicker({
  contactId,
  name,
  onChange,
}: {
  contactId: string | null;
  name: string;
  onChange: (v: { contactId: string | null; name: string }) => void;
}) {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: contacts = [] } = useQuery({
    queryKey: ["referral-source-contacts", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_contacts")
        .select("id, name, company_name, email, is_referrer")
        // referrers first, then alpha
        .order("is_referrer", { ascending: false })
        .order("name");
      return data || [];
    },
  });

  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = (contacts as any[]).filter((c) => (showAll ? true : c.is_referrer));
    if (!q) return base.slice(0, 12);
    return base
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company_name?.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [search, contacts, showAll]);

  if (name) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate">
          {name}
          {!contactId && " (new)"}
        </span>
        <button
          type="button"
          onClick={() => onChange({ contactId: null, name: "" })}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={showAll ? "Search all contacts..." : "Search referrer contacts..."}
        className="h-9 text-sm"
      />
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox
          id="show-all-contacts"
          checked={showAll}
          onCheckedChange={(v) => setShowAll(!!v)}
        />
        <Label htmlFor="show-all-contacts" className="text-xs font-normal cursor-pointer">
          Show all contacts (not just referrers)
        </Label>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-9 mt-1 z-[9999] rounded-md border bg-popover shadow-lg max-h-[240px] overflow-y-auto">
          {results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {showAll ? "No matches." : "No referrer contacts. Toggle “Show all” or add new."}
            </div>
          )}
          {results.map((c: any) => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              onClick={() => {
                onChange({ contactId: c.id, name: c.name });
                setSearch("");
                setOpen(false);
              }}
            >
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {c.name}
                  {c.is_referrer && (
                    <span className="ml-1.5 text-[10px] text-amber-700 font-medium">REFERRER</span>
                  )}
                </div>
                {(c.company_name || c.email) && (
                  <div className="text-xs text-muted-foreground truncate">
                    {c.company_name || c.email}
                  </div>
                )}
              </div>
            </button>
          ))}
          {search.trim() && (
            <>
              <div className="border-t" />
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left text-primary"
                onClick={() => {
                  onChange({ contactId: null, name: search.trim() });
                  setOpen(false);
                }}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                <span>Use "{search.trim()}" (not in system)</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ReferralCaptureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { profile } = useAuth();
  const { data: profiles = [] } = useAssignableProfiles();
  const create = useCreateBdReferral();
  const { toast } = useToast();

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      source_contact_id: null,
      source_label: null,
      source_type: "ARCHITECT",
      referred_name: "",
      referred_company: "",
      referred_email: "",
      referred_phone: "",
      assigned_to: profile?.id ?? "",
      stage: "ASK_MADE",
      next_action_at: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open && profile?.id && !form.getValues("assigned_to")) {
      form.setValue("assigned_to", profile.id);
    }
  }, [open, profile?.id, form]);

  const [source, setSource] = useState<{ contactId: string | null; name: string }>({
    contactId: null,
    name: "",
  });

  const onSubmit = async (vals: FormVals) => {
    if (!source.name.trim()) {
      toast({ title: "Source required", description: "Pick or type a source contact.", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        source_contact_id: source.contactId,
        source_label: source.contactId ? null : source.name.trim(),
        source_type: vals.source_type as ReferralSourceType,
        referred_name: vals.referred_name.trim(),
        referred_company: vals.referred_company?.trim() || null,
        referred_email: vals.referred_email?.trim() || null,
        referred_phone: vals.referred_phone?.trim() || null,
        assigned_to: vals.assigned_to,
        stage: vals.stage as ReferralStage,
        next_action_at: vals.next_action_at || null,
        notes: vals.notes?.trim() || null,
      });
      toast({ title: "Referral added" });
      form.reset();
      setSource({ contactId: null, name: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New referral</DialogTitle>
          <DialogDescription>Log a referral and who's chasing it.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source contact</Label>
            <SourceContactPicker
              contactId={source.contactId}
              name={source.name}
              onChange={setSource}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source type</Label>
              <Select
                value={form.watch("source_type")}
                onValueChange={(v) => form.setValue("source_type", v as ReferralSourceType)}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_TYPE_META) as ReferralSourceType[]).map((k) => (
                    <SelectItem key={k} value={k}>{SOURCE_TYPE_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select
                value={form.watch("stage")}
                onValueChange={(v) => form.setValue("stage", v as ReferralStage)}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Referred person *</Label>
            <Input className="h-9" {...form.register("referred_name")} placeholder="Full name" />
            {form.formState.errors.referred_name && (
              <p className="text-xs text-red-600">{form.formState.errors.referred_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input className="h-9" {...form.register("referred_company")} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input className="h-9" {...form.register("referred_phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input className="h-9" type="email" {...form.register("referred_email")} />
            {form.formState.errors.referred_email && (
              <p className="text-xs text-red-600">{form.formState.errors.referred_email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assigned to *</Label>
              <Select
                value={form.watch("assigned_to")}
                onValueChange={(v) => form.setValue("assigned_to", v)}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Pick owner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => {
                    const label = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.id === profile?.id ? `${label} (me)` : label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Next action date</Label>
              <Input className="h-9" type="date" {...form.register("next_action_at")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Add referral
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
