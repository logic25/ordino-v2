import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Camera, QrCode } from "lucide-react";
import { BdScanTab } from "./_bdcard/BdScanTab";
import { BdMyCardTab } from "./_bdcard/BdMyCardTab";

export default function BdEventCard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "mycard" ? "mycard" : "scan";

  return (
    <AppLayout>
      <div className="max-w-md mx-auto pb-10 animate-fade-in">
        <div className="px-1 mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Event Card</h1>
          <p className="text-sm text-muted-foreground">Capture leads or share your own contact.</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan"><Camera className="h-4 w-4 mr-1.5" />Scan a card</TabsTrigger>
            <TabsTrigger value="mycard"><QrCode className="h-4 w-4 mr-1.5" />My QR card</TabsTrigger>
          </TabsList>
          <TabsContent value="scan" className="mt-4"><BdScanTab /></TabsContent>
          <TabsContent value="mycard" className="mt-4"><BdMyCardTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
