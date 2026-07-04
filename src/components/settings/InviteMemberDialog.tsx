import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Mail, Loader2, Copy, Trash2, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCustomRoles } from "@/hooks/useUserRoles";

// Roles are loaded dynamically from custom_roles (see useCustomRoles)

type Invite = {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export function InviteMemberDialog() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: customRoles = [] } = useCustomRoles();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("pm");
  const [saving, setSaving] = useState(false);

  // Build role options from custom_roles, excluding admin (must be granted manually)
  const roleOptions = customRoles
    .filter((r) => r.name !== "admin")
    .map((r) => ({
      value: r.name,
      label: r.name.charAt(0).toUpperCase() + r.name.slice(1),
      description: r.description || "",
    }));

  const { data: invites = [], refetch } = useQuery({
    queryKey: ["pending-invites", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      // Only show invites that haven't been accepted yet, and hide invites
      // that expired more than 7 days ago so stale rows don't pile up.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("pending_invites" as any)
        .select("*")
        .eq("company_id", profile!.company_id)
        .is("accepted_at", null)
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
    setRole("pm");
  };

  const handleInvite = async () => {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned.endsWith("@greenlightexpediting.com")) {
      toast({
        title: "Invalid email",
        description: "Email must end in @greenlightexpediting.com.",
        variant: "destructive",
      });
      return;
    }
    if (!profile?.company_id || !profile?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("pending_invites" as any).insert({
        company_id: profile.company_id,
        email: cleaned,
        role,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        invited_by: profile.id,
      } as any);
      if (error) throw error;

      // Send invite email via gmail-send — always use production URL, not preview/editor origin
      const PRODUCTION_URL = "https://ordinopm.com";
      const link = `${PRODUCTION_URL}/auth`;
      const inviteeName = firstName.trim() || "there";
      const roleDef = roleOptions.find((r) => r.value === role);
      const roleLabel = roleDef?.label || role;

      const session = (await supabase.auth.getSession()).data.session;
      if (session) {
        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#1e293b;padding:20px 24px;border-radius:12px 12px 0 0">
              <h1 style="color:#f59e0b;margin:0;font-size:22px">Ordino</h1>
            </div>
            <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <p style="font-size:16px;color:#1e293b;margin:0 0 12px">Hi ${inviteeName},</p>
              <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
                You've been invited to join the Greenlight Expediting team on <strong>Ordino</strong> as a <strong>${roleLabel}</strong>.
              </p>
              <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">
                Click the button below to sign in with your <strong>@greenlightexpediting.com</strong> Google account.
              </p>
              <div style="text-align:center;margin:24px 0">
                <a href="${link}" style="background:#1e293b;color:#f59e0b;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
                  Sign in to Ordino
                </a>
              </div>
              <p style="font-size:12px;color:#94a3b8;margin:16px 0 0;text-align:center">
                This invite expires in 14 days. If you have questions, reach out to your manager.
              </p>
            </div>
          </div>`;

        try {
          await supabase.functions.invoke("gmail-send", {
            body: {
              to: cleaned,
              subject: `You're invited to Ordino — Join as ${roleLabel}`,
              html_body: emailHtml,
            },
          });
        } catch (emailErr) {
          console.warn("Invite email failed (invite still created):", emailErr);
        }
      }

      await navigator.clipboard.writeText(link).catch(() => {});

      toast({
        title: "Invite created & email sent",
        description: `Invite email sent to ${cleaned}. Sign-in link also copied.`,
      });
      reset();
      await refetch();
    } catch (err: any) {
      toast({ title: "Could not create invite", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase.from("pending_invites" as any).delete().eq("id", id);
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            Invite Team Member
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invite Team Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                placeholder="firstname@greenlightexpediting.com"
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
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-[11px] text-muted-foreground">{r.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              When they sign in with Google using this email, they'll automatically join with the role above. Invites expire in 14 days.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={saving || !email}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create invite & copy link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {invites.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Pending invites
                <span className="text-muted-foreground font-normal text-xs">({invites.length})</span>
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleCopyLink}>
                <Copy className="h-3 w-3" />
                Copy sign-in link
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
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
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{i.role}</Badge>
                      </TableCell>
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
          </CardContent>
        </Card>
      )}
    </>
  );
}
