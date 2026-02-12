import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  FileText,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Linkedin,
  Star,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useClientContacts,
  useDeleteClient,
  useUpdateClient,
  type Client,
  type ClientFormInput,
} from "@/hooks/useClients";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useCompanyProfiles, type Profile } from "@/hooks/useProfiles";

function useClientDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["client-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
    enabled: !!id,
  });
}

function useClientStats(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const [projectsRes, proposalsRes] = await Promise.all([
        supabase.from("projects").select("id, status").eq("client_id", clientId),
        supabase.from("proposals").select("id, status, total_amount").eq("client_id", clientId),
      ]);

      const projects = projectsRes.data || [];
      const proposals = proposalsRes.data || [];

      const totalProposals = proposals.length;
      const proposalsSent = proposals.filter((p) => p.status !== "draft").length;
      const proposalsConverted = proposals.filter(
        (p) => p.status === "accepted" || p.status === "signed_client"
      ).length;
      const conversionRate =
        proposalsSent > 0 ? Math.round((proposalsConverted / proposalsSent) * 100) : 0;
      const totalValue = proposals
        .filter((p) => p.status === "accepted" || p.status === "signed_client")
        .reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const activeProjects = projects.filter((p) => p.status === "open").length;
      const totalProjects = projects.length;

      return { totalProposals, proposalsSent, proposalsConverted, conversionRate, totalValue, activeProjects, totalProjects };
    },
    enabled: !!clientId,
  });
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

function getProfileName(profiles: Profile[], id: string | null) {
  if (!id) return null;
  const p = profiles.find((pr) => pr.id === id);
  return p ? (p.display_name || `${p.first_name || ""} ${p.last_name || ""}`.trim()) : null;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: client, isLoading } = useClientDetail(id);
  const { data: contacts = [], isLoading: contactsLoading } = useClientContacts(id);
  const { data: stats } = useClientStats(id);
  const { data: profiles = [] } = useCompanyProfiles();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client deleted" });
      navigate("/clients");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: ClientFormInput) => {
    if (!id) return;
    try {
      await updateClient.mutateAsync({ id, ...data });
      toast({ title: "Client updated" });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-24">
          <h2 className="text-xl font-semibold">Client not found</h2>
          <Button variant="link" onClick={() => navigate("/clients")} className="mt-2">
            ← Back to Clients
          </Button>
        </div>
      </AppLayout>
    );
  }

  const primaryContact = contacts.find((c) => c.is_primary);
  const leadOwnerName = getProfileName(profiles, client.lead_owner_id);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/clients")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
                {client.is_sia && (
                  <Badge variant="secondary" className="text-xs">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    SIA
                  </Badge>
                )}
              </div>
              {primaryContact && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Primary: {primaryContact.first_name} {primaryContact.last_name}
                  {primaryContact.title ? ` · ${primaryContact.title}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate("/proposals")}>
              <FileText className="h-4 w-4 mr-1.5" />
              Proposals
            </Button>
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => navigate("/proposals")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Proposal
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/projects")}>
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Projects
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <InfoRow label="Name" value={client.name} />
                <InfoRow label="Email" value={client.email} />
                <InfoRow label="Phone" value={client.phone} />
                <InfoRow label="Fax" value={client.fax} />
                <InfoRow label="Address" value={client.address} />
                <InfoRow label="Lead Owner" value={leadOwnerName} />
                <InfoRow label="Tax ID" value={client.tax_id} />
                {client.notes && <InfoRow label="Notes" value={client.notes} />}
              </CardContent>
            </Card>

            {/* Regulatory Card */}
            {(client.ibm_number || client.hic_license || client.dob_tracking) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">License / Regulatory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  <InfoRow label="IBM Number" value={client.ibm_number} />
                  <InfoRow label="IBM Expiration" value={client.ibm_number_expiration} />
                  <InfoRow label="HIC License" value={client.hic_license} />
                  <InfoRow label="DOB Tracking #" value={client.dob_tracking} />
                  <InfoRow label="DOB Tracking Exp." value={client.dob_tracking_expiration} />
                </CardContent>
              </Card>
            )}

            {/* Proposals Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Proposals Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <InfoRow label="Proposals" value={stats?.totalProposals?.toString()} />
                <InfoRow label="Sent" value={stats?.proposalsSent?.toString()} />
                <InfoRow label="Converted" value={stats?.proposalsConverted?.toString()} />
                <InfoRow label="Conversion Rate" value={stats ? `${stats.conversionRate}%` : undefined} />
                <InfoRow label="Total Value" value={stats ? formatCurrency(stats.totalValue) : undefined} />
                <InfoRow label="Active Projects" value={stats?.activeProjects?.toString()} />
                <InfoRow label="Total Projects" value={stats?.totalProjects?.toString()} />
              </CardContent>
            </Card>
          </div>

          {/* Right: Contacts Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Contacts
                  <Badge variant="secondary" className="text-xs">{contacts.length}</Badge>
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No contacts yet.</p>
                  <p className="text-xs mt-1">Click Edit or Add Contact to add people.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Name</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>LinkedIn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="pr-0">
                            {contact.is_primary && (
                              <Star className="h-3.5 w-3.5 text-accent fill-accent" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.title || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.company_name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.phone || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {contact.mobile || "—"}
                          </TableCell>
                          <TableCell>
                            {contact.email ? (
                              <a href={`mailto:${contact.email}`} className="text-primary hover:underline text-sm">
                                {contact.email}
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {contact.linkedin_url ? (
                              <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 text-sm">
                                <Linkedin className="h-3.5 w-3.5" />
                                Profile
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleUpdate}
        client={client}
        isLoading={updateClient.isPending}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client, all their contacts, and unlink any proposals and projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground font-medium shrink-0">{label}:</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}
