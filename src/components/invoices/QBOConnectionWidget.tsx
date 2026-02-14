import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, RefreshCw, Unplug, Settings, Loader2, Wifi, WifiOff } from "lucide-react";
import { getQBOConnectionStatus, syncCustomers, type QBOConnectionStatus } from "@/lib/mockQBO";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export function QBOConnectionWidget() {
  const [status, setStatus] = useState<QBOConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getQBOConnectionStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncCustomers();
      setStatus((prev) => prev ? { ...prev, lastSyncAt: new Date().toISOString() } : prev);
      toast({ title: `Synced ${result.synced} customers from QuickBooks` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-3 px-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Checking QuickBooks connection...</span>
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">QuickBooks not connected</span>
          </div>
          <Button size="sm" variant="outline">
            Connect QuickBooks
          </Button>
        </CardContent>
      </Card>
    );
  }

  const syncTimeAgo = status.lastSyncAt
    ? formatDistanceToNow(new Date(status.lastSyncAt), { addSuffix: true })
    : "Never";

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">Connected to QuickBooks Online</span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {status.companyName}
          </span>
          <Badge variant="outline" className="text-xs gap-1">
            <Wifi className="h-3 w-3" />
            Synced {syncTimeAgo}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline ml-1">Sync Now</span>
          </Button>
          <Button size="sm" variant="ghost">
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground">
            <Unplug className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
