import { Mail, Link2Off, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useGmailConnection,
  useGetGmailAuthUrl,
  useDisconnectGmail,
  useSyncGmail,
} from "@/hooks/useGmailConnection";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export function GmailConnectButton() {
  const { data: connection, isLoading } = useGmailConnection();
  const getAuthUrl = useGetGmailAuthUrl();
  const disconnect = useDisconnectGmail();
  const sync = useSyncGmail();
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/emails`;
      const result = await getAuthUrl.mutateAsync(redirectUri);
      if (result.auth_url) {
        window.location.href = result.auth_url;
      }
    } catch {
      toast({
        title: "Gmail Setup Required",
        description:
          "Gmail API credentials haven't been configured yet. Contact your admin to set up the Google Cloud project.",
      });
    }
  };

  const handleSync = async () => {
    try {
      const result = await sync.mutateAsync();
      toast({
        title: "Sync Complete",
        description: `Synced ${result.synced} new emails (checked ${result.total_checked || "?"})`,
      });
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      toast({ title: "Gmail Disconnected" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return null;

  if (!connection) {
    return (
      <Button onClick={handleConnect} disabled={getAuthUrl.isPending} variant="outline" size="sm">
        <Mail className="h-4 w-4 mr-2" />
        {getAuthUrl.isPending ? "Connecting..." : "Connect Gmail"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm text-muted-foreground hidden sm:block">
        <span className="font-medium text-foreground">{connection.email_address}</span>
        {connection.last_sync_at && (
          <span className="ml-2">
            · Synced {format(new Date(connection.last_sync_at), "MMM d, h:mm a")}
          </span>
        )}
      </div>
      <Button
        onClick={handleSync}
        disabled={sync.isPending}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline ml-1">Sync</span>
      </Button>
      <Button onClick={handleDisconnect} disabled={disconnect.isPending} variant="ghost" size="sm">
        <Link2Off className="h-4 w-4" />
      </Button>
    </div>
  );
}
