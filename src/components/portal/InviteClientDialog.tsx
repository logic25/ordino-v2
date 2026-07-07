import { useState } from "react";
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
  };

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


      const PRODUCTION_URL = "https://ordinopm.com";
      const link = `${PRODUCTION_URL}/auth`;
      const orgName = orgs.find((o) => o.id === orgId)?.name ?? "your projects";
      const inviteeName = firstName.trim() || "there";

      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#1e293b;padding:20px 24px;border-radius:12px 12px 0 0">
              <h1 style="color:#f59e0b;margin:0;font-size:22px">Ordino Client Portal</h1>
            </div>
            <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <p style="font-size:16px;color:#1e293b;margin:0 0 12px">Hi ${inviteeName},</p>
              <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
                Green Light Expediting invited you to track <strong>${orgName}</strong>'s permits in real time on the Ordino Client Portal.
              </p>
              <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
                Sign in with this email (<strong>${cleaned}</strong>) to see project status, action items, and documents.
              </p>
              <div style="text-align:center;margin:24px 0">
                <a href="${link}" style="background:#1e293b;color:#f59e0b;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
                  Open the Client Portal
                </a>
              </div>
              <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">
                This invite expires in 14 days.
              </p>
            </div>
          </div>`;

        try {
          await supabase.functions.invoke("gmail-send", {
            body: {
              to: cleaned,
              subject: `You're invited to the Ordino Client Portal`,
              html_body: emailHtml,
            },
          });
        } catch (emailErr) {
          console.warn("Invite email failed (invite still created):", emailErr);
        }
      }

      await navigator.clipboard.writeText(link).catch(() => {});
      toast({
        title: "Client invited",
        description: `Invite sent to ${cleaned}. Sign-in link copied.`,
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

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText("https://ordinopm.com/auth");
    toast({ title: "Sign-in link copied" });
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
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Client organization</Label>
              {!creatingOrg && (
                <button
                  type="button"
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => { setCreatingOrg(true); setOrgId(""); }}
                >
                  + Create new
                </button>
              )}
            </div>
            {creatingOrg ? (
              <div className="space-y-2 rounded-md border border-dashed p-2">
                <Input
                  placeholder="Organization name (e.g. Acme Retail)"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Select value={newOrgType} onValueChange={(v) => setNewOrgType(v as any)}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brand">National brand</SelectItem>
                      <SelectItem value="gc">General contractor</SelectItem>
                      <SelectItem value="design">Design firm</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newOrgName.trim() || !profile?.company_id}
                    onClick={async () => {
                      const { data, error } = await supabase
                        .from("client_orgs")
                        .insert({
                          company_id: profile!.company_id!,
                          name: newOrgName.trim(),
                          type: newOrgType,
                        } as any)
                        .select("id")
                        .single();
                      if (error) {
                        toast({ title: "Could not create", description: error.message, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Organization created" });
                      setOrgId(data.id);
                      setCreatingOrg(false);
                      setNewOrgName("");
                      qc.invalidateQueries({ queryKey: ["portal", "orgs"] });
                    }}
                  >
                    Create
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingOrg(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder={orgs.length ? "Pick an organization" : "No organizations yet — click + Create new"} />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              placeholder="client@company.com"
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
          <p className="text-[11px] text-muted-foreground">
            When the client signs in with this email, they'll join their org's portal automatically. Invite expires in 14 days.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" className="gap-1 mr-auto" onClick={handleCopyLink}>
            <Copy className="h-3 w-3" /> Copy sign-in link
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleInvite} disabled={saving || !email || !orgId}>
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
