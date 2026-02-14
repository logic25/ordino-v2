import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function CompanySettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-settings", profile?.company_id],
    enabled: !!profile?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", profile!.company_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name || "");
      setEmail(company.email || "");
      setPhone(company.phone || "");
      setAddress(company.address || "");
      setWebsite(company.website || "");
    }
  }, [company]);

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          website: website.trim() || null,
        })
        .eq("id", profile.company_id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast({ title: "Company updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
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
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Update your organization's details. This information appears on invoices and proposals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Company Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="123 Main St, New York, NY 10001" />
          </div>

          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://company.com" />
          </div>

          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
