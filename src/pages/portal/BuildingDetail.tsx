import { useParams, Link } from "react-router-dom";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { FlatGrid } from "./Portfolio";
import { useBuildings, usePortalProjects } from "@/hooks/usePortal";
import { ArrowLeft, MapPin } from "lucide-react";

export default function BuildingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: buildings = [] } = useBuildings();
  const building = buildings.find((b) => b.id === id);
  const { data: projects = [] } = usePortalProjects({ buildingId: id });

  return (
    <PortalLayout>
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Portfolio
      </Link>

      {building && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            <span>Building</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{building.address}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {building.bin && <span>BIN <span className="font-mono text-foreground">{building.bin}</span></span>}
            {building.pm_name && <span>PM: <span className="text-foreground">{building.pm_name}</span></span>}
            {building.pm_email && (
              <a href={`mailto:${building.pm_email}`} className="text-sky-700 hover:underline">
                {building.pm_email}
              </a>
            )}
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
        Projects at this building
      </h2>
      <FlatGrid projects={projects} />
    </PortalLayout>
  );
}
