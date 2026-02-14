import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Library } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
          </div>
        </div>

        <div className="flex items-center justify-center py-24 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">RFP Kanban board coming in Phase 2</p>
            <Button variant="outline" onClick={() => navigate("/rfps/library")}>
              Set Up Content Library First →
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
