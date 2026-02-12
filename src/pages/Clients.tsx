import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Plus, Search, Loader2, Building2, UserPlus, Contact } from "lucide-react";
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
import { subDays } from "date-fns";

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
    const query = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.phone?.toLowerCase().includes(query)
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground mt-1">
              Manage your client relationships
            </p>
          </div>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.totalClients}</p>
                  <p className="text-xs text-muted-foreground">Total Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-accent/10 p-2">
                  <Contact className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.totalContacts}</p>
                  <p className="text-xs text-muted-foreground">Total Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-secondary/50 p-2">
                  <Building2 className="h-4 w-4 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.uniqueCompanies}</p>
                  <p className="text-xs text-muted-foreground">Companies</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics.newClients}</p>
                  <p className="text-xs text-muted-foreground">New (30 days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search clients..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Clients
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredClients.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Property owners, architects, and contractors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No clients yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Add your first client to start managing relationships
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
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
