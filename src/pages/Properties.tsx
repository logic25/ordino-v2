import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PropertyDialog, PropertyFormData } from "@/components/properties/PropertyDialog";
import { PropertyTable } from "@/components/properties/PropertyTable";
import {
  useProperties,
  useCreateProperty,
  useUpdateProperty,
  useDeleteProperty,
  Property,
} from "@/hooks/useProperties";
import { useApplications } from "@/hooks/useApplications";
import { useProjects } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";

export default function Properties() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: properties = [], isLoading: propertiesLoading } = useProperties();
  const { data: applications = [], isLoading: applicationsLoading } = useApplications();
  const { data: projects = [] } = useProjects();
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const deleteProperty = useDeleteProperty();

  const isLoading = propertiesLoading || applicationsLoading;

  // Merge properties with their applications and projects
  const propertiesWithApplications = useMemo(() => {
    return properties.map((property) => ({
      ...property,
      applications: applications.filter((app) => app.property_id === property.id),
      projects: projects.filter((proj) => proj.property_id === property.id),
    }));
  }, [properties, applications, projects]);

  const filteredProperties = propertiesWithApplications.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.address.toLowerCase().includes(query) ||
      p.bin?.toLowerCase().includes(query) ||
      p.block?.toLowerCase().includes(query) ||
      p.lot?.toLowerCase().includes(query) ||
      p.owner_name?.toLowerCase().includes(query)
    );
  });

  const handleOpenCreate = () => {
    setEditingProperty(null);
    setDialogOpen(true);
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: PropertyFormData) => {
    try {
      if (editingProperty) {
        await updateProperty.mutateAsync({ id: editingProperty.id, ...data });
        toast({
          title: "Property updated",
          description: "The property has been updated successfully.",
        });
      } else {
        await createProperty.mutateAsync(data);
        toast({
          title: "Property created",
          description: "The property has been added to your portfolio.",
        });
      }
      setDialogOpen(false);
      setEditingProperty(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
      toast({
        title: "Property deleted",
        description: "The property has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete property.",
        variant: "destructive",
      });
    }
  };

  const handleCreateProposal = (propertyId: string) => {
    // Navigate to proposals page with the property pre-selected
    navigate(`/proposals?property=${propertyId}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
            <p className="text-muted-foreground mt-1">
              Buildings and addresses with DOB applications
            </p>
          </div>
          <Button
            size="sm"
            className="bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by address, BIN, or block/lot..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              All Properties
              {!isLoading && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredProperties.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              View all properties with their associated projects. Click the arrow to expand and see related projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProperties.length === 0 && !searchQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No properties yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Add a property to start tracking all DOB applications at that address
                </p>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={handleOpenCreate}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            ) : (
              <PropertyTable
                properties={filteredProperties}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCreateProposal={handleCreateProposal}
                isDeleting={deleteProperty.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        property={editingProperty}
        isLoading={createProperty.isPending || updateProperty.isPending}
      />
    </AppLayout>
  );
}
