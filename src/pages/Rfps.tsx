import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Library, Upload, LayoutGrid, List } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RfpKanbanBoard } from "@/components/rfps/RfpKanbanBoard";
import { RfpTableView } from "@/components/rfps/RfpTableView";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function Rfps() {
  const navigate = useNavigate();
  const [view, setView] = useState<"kanban" | "table">("table");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">RFPs</h1>
            <p className="text-muted-foreground text-sm">
              Track and respond to Requests for Proposals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as "kanban" | "table")} size="sm" variant="outline">
              <ToggleGroupItem value="table" aria-label="Table view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" onClick={() => navigate("/rfps/library")}>
              <Library className="h-4 w-4 mr-2" /> Content Library
            </Button>
            <Button>
              <Upload className="h-4 w-4 mr-2" /> New RFP
            </Button>
          </div>
        </div>

        {view === "kanban" ? <RfpKanbanBoard /> : <RfpTableView />}
      </div>
    </AppLayout>
  );
}
