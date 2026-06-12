import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Markets from "./Markets";
import BdMarketSignals from "./bd/BdMarketSignals";

// One nav entry, two tabs: "Markets" (expansion cities + playbooks) and "Signals"
// (the email-derived BD news feed). Each underlying page renders in `embedded` mode
// so it skips its own AppLayout (the hub provides the single layout).
export default function MarketsHub({ defaultTab = "markets" }: { defaultTab?: "markets" | "signals" }) {
  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="markets">Markets</TabsTrigger>
            <TabsTrigger value="signals">Signals</TabsTrigger>
          </TabsList>
          <TabsContent value="markets" className="mt-4">
            <Markets embedded />
          </TabsContent>
          <TabsContent value="signals" className="mt-4">
            <BdMarketSignals embedded />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
