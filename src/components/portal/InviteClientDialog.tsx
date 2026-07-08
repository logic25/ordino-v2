import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Mail, Loader2, Trash2, CheckCircle2, Clock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePortalOrgs } from "@/hooks/usePortal";
import { useClientContacts } from "@/hooks/useClients";

const MANUAL_CONTACT_VALUE = "__manual__";

type Invite = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  client_org_id: string;
};

type ClientRow = { id: string; name: string; email: string | null; client_type: string | null };

export function InviteClientDialog() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: orgs = [] } = usePortalOrgs();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [contactId, setContactId] = useState<string>(""); // "" = none picked, MANUAL_CONTACT_VALUE = manual entry
  const [saving, setSaving] = useState(false);

  // All CRM clients for this company
  const { data: clients = [] } = useQuery({
    queryKey: ["invite-clients", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, email, client_type")
        .eq("company_id", profile!.company_id!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  // Contacts for the currently selected client
  const { data: contacts = [] } = useClientContacts(clientId || undefined);
  const hasContacts = contacts.length > 0;
  const isManual = contactId === MANUAL_CONTACT_VALUE || (!hasContacts && !!clientId);

  const { data: invites = [], refetch } = useQuery({
    queryKey: ["client-portal-invites", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("client_portal_invites" as any)
        .select("*")
        .gte("expires_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Invite[];
    },
  });

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setClientId("");
    setContactId("");
  };

  const splitName = (full: string | null | undefined): { first: string; last: string } => {
    const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: "", last: "" };
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };

  const pickContact = (id: string) => {
    setContactId(id);
    if (id === MANUAL_CONTACT_VALUE) {
      setEmail("");
      setFirstName("");
      setLastName("");
      return;
    }
    const c = contacts.find((x) => x.id === id);
    if (c) {
      setEmail((c.email ?? "").toLowerCase());
      const { first, last } = splitName(c.name);
      setFirstName(first);
      setLastName(last);
    }
  };

  // Auto-select primary contact (or the only contact) when contacts load
  // for a newly-picked client, unless the user has already made a choice.
  useEffect(() => {
    if (!clientId || contactId) return;
    if (contacts.length === 0) return;
    const primary = contacts.find((c) => c.is_primary && c.email);
    const pick = primary ?? (contacts.length === 1 && contacts[0].email ? contacts[0] : null);
    if (pick) pickContact(pick.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, contacts.length]);

  // Map CRM client_type → portal org type enum
  const mapType = (t: string | null): "brand" | "gc" | "design" | "other" => {
    const s = (t ?? "").toLowerCase();
    if (s.includes("brand") || s.includes("retail")) return "brand";
    if (s.includes("contractor") || s.includes("gc")) return "gc";
    if (s.includes("design") || s.includes("architect")) return "design";
    return "other";
  };

  const handleInvite = async () => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (!clientId) {
      toast({ title: "Pick a client", variant: "destructive" });
      return;
    }
    if (!profile?.company_id || !profile?.id) return;

    setSaving(true);
    try {
      // Find-or-create the portal client_orgs row linked to this CRM client
      let orgId: string;
      const { data: existingOrg } = await supabase
        .from("client_orgs")
        .select("id")
        .eq("client_id", clientId)
        .maybeSingle();

      if (existingOrg?.id) {
        orgId = existingOrg.id;
      } else {
        const client = clients.find((c) => c.id === clientId);
        const { data: newOrg, error: orgErr } = await supabase
          .from("client_orgs")
          .insert({
            company_id: profile.company_id,
            client_id: clientId,
            name: client?.name ?? "Client",
            type: mapType(client?.client_type ?? null),
          } as any)
          .select("id")
          .single();
        if (orgErr) throw orgErr;
        orgId = newOrg!.id;
        qc.invalidateQueries({ queryKey: ["portal", "orgs"] });
      }

      const { error } = await supabase.from("client_portal_invites" as any).insert({
        company_id: profile.company_id,
        client_org_id: orgId,
        email: cleaned,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        invited_by: profile.id,
      } as any);
      if (error) throw error;

      const orgName = orgs.find((o) => o.id === orgId)?.name ?? "your projects";

      // Server mints a magic link and sends the branded email in one step —
      // the recipient signs in with a single click, no /portal/auth detour.
      const { data: sendData, error: sendErr } = await supabase.functions.invoke(
        "send-portal-invite",
        {
          body: {
            email: cleaned,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            org_name: orgName,
            client_org_id: orgId,
          },
        },
      );
      if (sendErr) {
        console.warn("send-portal-invite failed (invite row still created):", sendErr, sendData);
      }

      // Silently persist manually-entered invitees as non-primary contacts
      // so they show up in this dropdown next time. Dedupe by email within
      // the selected client only.
      if (isManual) {
        try {
          const { data: dupe } = await supabase
            .from("client_contacts")
            .select("id")
            .eq("client_id", clientId)
            .ilike("email", cleaned)
            .maybeSingle();
          if (!dupe) {
            const fullName =
              [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
              cleaned.split("@")[0];
            await supabase.from("client_contacts").insert({
              client_id: clientId,
              name: fullName,
              email: cleaned,
              is_primary: false,
            } as any);
            qc.invalidateQueries({ queryKey: ["client-contacts", clientId] });
          }
        } catch (contactErr) {
          console.warn("Saving invitee to client_contacts failed:", contactErr);
        }
      }

      toast({
        title: sendErr ? "Invite created — email may have failed" : "Client invited",
        description: sendErr
          ? `Invite row saved for ${cleaned}, but the email couldn't be sent. Check your Gmail connection and try again.`
          : `${cleaned} will get a one-click sign-in email.`,
        variant: sendErr ? "destructive" : "default",
      });
      reset();
      await refetch();
      qc.invalidateQueries({ queryKey: ["client-portal-invites"] });
    } catch (err: any) {
      toast({
        title: "Could not create invite",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase
      .from("client_portal_invites" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invite revoked" });
    await refetch();
  };


  const statusOf = (i: Invite) => {
    if (i.accepted_at) return "accepted";
    if (new Date(i.expires_at) < new Date()) return "expired";
    return "pending";
  };

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Invite Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invite Client to Portal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Client (from your Clients list)</Label>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                // Reset contact selection & fields when switching clients.
                setContactId("");
                setEmail("");
                setFirstName("");
                setLastName("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={clients.length ? "Pick a client to invite" : "No clients yet — add one in Clients first"} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.client_type ? <span className="text-muted-foreground ml-2 text-[11px]">· {c.client_type}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              We'll auto-create the client's portal workspace the first time you invite them.
            </p>
          </div>

          {clientId && hasContacts && (
            <div>
              <Label className="text-xs">Contact (who's actually signing in)</Label>
              <Select value={contactId} onValueChange={pickContact}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.email ? <span className="text-muted-foreground ml-2 text-[11px]">· {c.email}</span> : null}
                      {c.is_primary ? <span className="text-muted-foreground ml-2 text-[11px]">· primary</span> : null}
                    </SelectItem>
                  ))}
                  <SelectItem value={MANUAL_CONTACT_VALUE}>
                    <span className="italic">Invite someone else…</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {clientId && !hasContacts && (
            <p className="text-[11px] text-muted-foreground -mt-1">
              No contacts on file for this client — enter their details below. We'll save them as a contact.
            </p>
          )}

          {clientId && isManual && (
            <>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  placeholder="person@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {clientId && contactId && !isManual && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              <div className="font-medium">
                {[firstName, lastName].filter(Boolean).join(" ") || "(no name on contact)"}
              </div>
              <div className="text-muted-foreground">{email || "(no email on contact)"}</div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            When they sign in with this email, they'll join their org's portal automatically. Invite expires in 14 days.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={saving || !email || !clientId}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send invite"}
          </Button>
        </DialogFooter>

        {invites.length > 0 && (
          <div className="mt-2 border-t pt-4">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Recent invites
              <span className="text-muted-foreground font-normal text-xs">({invites.length})</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => {
                  const status = statusOf(i);
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-sm">
                        <div>{i.email}</div>
                        {(i.first_name || i.last_name) && (
                          <div className="text-[11px] text-muted-foreground">
                            {[i.first_name, i.last_name].filter(Boolean).join(" ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{orgName(i.client_org_id)}</TableCell>
                      <TableCell>
                        {status === "accepted" ? (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-300 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Accepted
                          </Badge>
                        ) : status === "expired" ? (
                          <Badge variant="outline" className="text-xs">Expired</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 bg-amber-500/10 text-amber-700 border-amber-300">
                            <Clock className="h-3 w-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(i.expires_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        {!i.accepted_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRevoke(i.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
