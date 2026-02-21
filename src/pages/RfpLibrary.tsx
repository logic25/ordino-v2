import { AppLayout } from "@/components/layout/AppLayout";
import { ContentLibraryTabs } from "@/components/rfps/ContentLibraryTabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RfpLibrary() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/rfps")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Content Library</h1>
              <p className="text-muted-foreground text-sm">
                Each tab saves independently. Edit any section, then click Save.
              </p>
            </div>
          </div>
          <Button onClick={() => navigate("/rfps")}>
            Done
          </Button>
        </div>
        <ContentLibraryTabs />
      </div>
    </AppLayout>
  );
}
