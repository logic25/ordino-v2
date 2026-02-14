import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Library, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RfpKanbanBoard } from "@/components/rfps/RfpKanbanBoard";

export default function Rfps() {
  const navigate = useNavigate();

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/rfps/library")}>
              <Library className="h-4 w-4 mr-2" /> Content Library
            </Button>
            <Button>
              <Upload className="h-4 w-4 mr-2" /> New RFP
            </Button>
          </div>
        </div>

        <RfpKanbanBoard />
      </div>
    </AppLayout>
  );
}
