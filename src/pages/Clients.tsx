import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Search, Loader2, UserPlus, Contact, Download, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ClientTable } from "@/components/clients/ClientTable";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  Client,
  ClientFormInput,
} from "@/hooks/useClients";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { subDays, format } from "date-fns";

function useClientMetrics(clients: Client[]) {
  const contactsQuery = useQuery({
    queryKey: ["all-client-contacts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("client_contacts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const totalClients = clients.length;
  const totalContacts = contactsQuery.data || 0;

  // Unique company names from contacts
  const uniqueCompanies = new Set<string>();
  // We'll get this from a separate query
  const companiesQuery = useQuery({
    queryKey: ["contact-companies-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("company_name")
        .not("company_name", "is", null);
      if (error) throw error;
      const unique = new Set(data?.map((c) => c.company_name?.toLowerCase().trim()).filter(Boolean));
      return unique.size;
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
  const newClients = clients.filter((c) => c.created_at && c.created_at >= thirtyDaysAgo).length;

  return {
    totalClients,
    totalContacts,
    uniqueCompanies: companiesQuery.data || 0,
    newClients,
  };
}

export default function Clients() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const metrics = useClientMetrics(clients);

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query) ||
      c.address?.toLowerCase().includes(query) ||
      (c as any).client_type?.toLowerCase().includes(query) ||
      (c as any).tax_id?.toLowerCase().includes(query)
    );
  });

  const handleOpenCreate = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: ClientFormInput) => {
    try {
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, ...data });
        toast({ title: "Client updated" });
      } else {
        await createClient.mutateAsync(data);
        toast({ title: "Client added" });
      }
      setDialogOpen(false);
      setEditingClient(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient.mutateAsync(id);
      toast({ title: "Client deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Name", "Type", "Email", "Phone", "Fax", "Address", "Tax ID", "SIA", "Added"];
    const rows = filteredClients.map((c) => [
      c.name || "",
      (c as any).client_type || "",
      c.email || "",
      c.phone || "",
      c.fax || "",
      c.address || "",
      c.tax_id || "",
      c.is_sia ? "Yes" : "No",
      c.created_at ? format(new Date(c.created_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `companies-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
            <p className="text-muted-foreground mt-1">
              Manage your companies and relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredClients.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-around gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{metrics.totalClients}</p>
                <p className="text-xs text-muted-foreground">Companies</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold">{metrics.totalContacts}</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-2xl font-bold text-primary">{metrics.newClients}</p>
                <p className="text-xs text-muted-foreground">New (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search companies..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Companies
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredClients.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Property owners, architects, contractors, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No companies yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Add your first company to start managing relationships
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </div>
            ) : (
              <ClientTable
                clients={filteredClients}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={(client) => navigate(`/clients/${client.id}`)}
                isDeleting={deleteClient.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        client={editingClient}
        isLoading={createClient.isPending || updateClient.isPending}
      />
    </AppLayout>
  );
}
