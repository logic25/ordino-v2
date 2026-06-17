import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, PenLine, Palmtree } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function ProfileSettings() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [phoneExtension, setPhoneExtension] = useState((profile as any)?.phone_extension || "");
  const [hourlyRate, setHourlyRate] = useState("");

  // Load own hourly rate from employee_compensation via RPC (compensation
  // is no longer stored on profiles).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_my_hourly_rate");
      if (!active || error) return;
      if (data != null) setHourlyRate(String(data));
    })();
    return () => { active = false; };
  }, []);

  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?";

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          display_name: displayName.trim() || [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null,
          phone: phone.trim() || null,
          phone_extension: phoneExtension.trim() || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profile updated" });

    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName || [firstName, lastName].filter(Boolean).join(" ") || "—"}</p>
              <p className="text-sm text-muted-foreground capitalize">{profile.role}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How your name appears to others" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
            <div className="space-y-2">
              <Label>Extension</Label>
              <Input value={phoneExtension} onChange={(e) => setPhoneExtension(e.target.value)} placeholder="x12" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              Hourly Rate
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
              className="max-w-[200px]"
            />
            <p className="text-xs text-muted-foreground">Used for billing calculations and time tracking reports</p>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Out of Office */}
      <OOOSection />
    </div>
  );
}

function OOOSection() {
  const { profile, refreshProfile } = useAuth();
  const { data: companyProfiles = [] } = useCompanyProfiles();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const profileAny = profile as any;
  const isOOO = !!(profileAny?.ooo_from && profileAny?.ooo_to);

  const [oooFrom, setOooFrom] = useState(profileAny?.ooo_from || "");
  const [oooTo, setOooTo] = useState(profileAny?.ooo_to || "");
  const [coveringPmId, setCoveringPmId] = useState(profileAny?.ooo_covering_pm_id || "");
  const [oooNote, setOooNote] = useState(profileAny?.ooo_note || "");
  const [enabled, setEnabled] = useState(isOOO);

  const eligiblePMs = companyProfiles.filter(
    (p) => p.id !== profile?.id && p.is_active && ["pm", "manager", "admin"].includes(p.role)
  );

  const handleToggle = async (on: boolean) => {
    setEnabled(on);
    if (!on) {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            ooo_from: null,
            ooo_to: null,
            ooo_covering_pm_id: null,
            ooo_note: null,
          } as any)
          .eq("id", profile!.id);
        if (error) throw error;
        await refreshProfile();
        setOooFrom("");
        setOooTo("");
        setCoveringPmId("");
        setOooNote("");
        toast({ title: "Out of Office cleared" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setEnabled(true);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!oooFrom || !oooTo) {
      toast({ title: "Please set both dates", variant: "destructive" });
      return;
    }
    if (!coveringPmId) {
      toast({ title: "Please select a covering PM", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          ooo_from: oooFrom,
          ooo_to: oooTo,
          ooo_covering_pm_id: coveringPmId,
          ooo_note: oooNote.trim() || null,
        } as any)
        .eq("id", profile!.id);
      if (error) throw error;
      await refreshProfile();
      // Fire-and-forget handoff summary to covering PM
      supabase.functions.invoke("generate-ooo-handoff").catch((err) => {
        console.warn("OOO handoff failed", err);
      });
      toast({ title: "Out of Office set", description: "Handoff summary sent to your cover." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const coveringPm = companyProfiles.find((p) => p.id === coveringPmId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Out of Office</CardTitle>
              <CardDescription>Set your absence and designate a covering PM</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={oooFrom} onChange={(e) => setOooFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={oooTo} onChange={(e) => setOooTo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Covering PM</Label>
            <Select value={coveringPmId} onValueChange={setCoveringPmId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member..." />
              </SelectTrigger>
              <SelectContent>
                {eligiblePMs.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.display_name || `${pm.first_name} ${pm.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Handoff Notes (optional)</Label>
            <Textarea
              value={oooNote}
              onChange={(e) => setOooNote(e.target.value)}
              placeholder="Any context for your covering PM..."
              className="min-h-[80px]"
            />
          </div>

          {isOOO && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-sm">
              <p className="font-medium flex items-center gap-2">
                <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 text-xs">OOO</Badge>
                {format(new Date(profileAny.ooo_from + "T00:00:00"), "MMM d")} – {format(new Date(profileAny.ooo_to + "T00:00:00"), "MMM d, yyyy")}
              </p>
              {coveringPm && (
                <p className="text-muted-foreground text-xs mt-1">
                  Covered by {coveringPm.display_name || `${coveringPm.first_name} ${coveringPm.last_name}`}
                </p>
              )}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {isOOO ? "Update OOO" : "Set OOO"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
