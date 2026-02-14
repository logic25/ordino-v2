import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Zap, Check, X, Clock, Mail, ArrowUpCircle, Eye, Loader2, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import {
  useAutomationLogs, useApproveAutomationLog, useRejectAutomationLog,
  type AutomationLog,
} from "@/hooks/useAutomationRules";
import { toast } from "@/hooks/use-toast";

const RESULT_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "text-muted-foreground bg-muted", icon: Clock },
  awaiting_approval: { label: "Needs Approval", color: "text-warning bg-warning/10 border-warning/30", icon: AlertTriangle },
  approved: { label: "Approved", color: "text-primary bg-primary/10 border-primary/30", icon: Check },
  sent: { label: "Sent", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950", icon: Mail },
  escalated: { label: "Escalated", color: "text-destructive bg-destructive/10 border-destructive/30", icon: ArrowUpCircle },
  skipped: { label: "Declined", color: "text-muted-foreground bg-muted", icon: X },
  failed: { label: "Failed", color: "text-destructive bg-destructive/10", icon: X },
};

export function AutomationActivityPanel() {
  const { data: logs = [], isLoading } = useAutomationLogs(30);
  const approveLog = useApproveAutomationLog();
  const rejectLog = useRejectAutomationLog();
  const [previewLog, setPreviewLog] = useState<AutomationLog | null>(null);

  const pendingApproval = logs.filter((l) => l.result === "awaiting_approval");
  const recentActivity = logs.filter((l) => l.result !== "awaiting_approval").slice(0, 10);

  const handleApprove = async (logId: string) => {
    try {
      await approveLog.mutateAsync(logId);
      toast({ title: "Approved", description: "Message approved for sending." });
      setPreviewLog(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (logId: string) => {
    try {
      await rejectLog.mutateAsync(logId);
      toast({ title: "Declined", description: "Automation action was declined." });
      setPreviewLog(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const parseMessage = (msg: string | null) => {
    if (!msg) return null;
    try {
      return JSON.parse(msg) as { subject: string; body: string };
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No automation activity yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure rules in Settings → Invoices & Billing to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Approval */}
      {pendingApproval.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-3 bg-warning/5 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle className="text-sm font-semibold text-warning">
                  Awaiting Your Approval
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-warning border-warning/30">
                {pendingApproval.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="space-y-2">
              {pendingApproval.map((log) => {
                const message = parseMessage(log.generated_message);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-md border bg-background">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {log.invoice?.invoice_number || "—"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {log.client?.name || "Unknown"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {log.rule?.name || "Automation"} — {message?.subject || log.action_taken}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setPreviewLog(log)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-emerald-600"
                        onClick={() => handleApprove(log.id)}
                        disabled={approveLog.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        onClick={() => handleReject(log.id)}
                        disabled={rejectLog.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Recent Automation Activity</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5">
              {recentActivity.map((log) => {
                const config = RESULT_CONFIG[log.result] || RESULT_CONFIG.pending;
                const Icon = config.icon;
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color.split(" ")[0]}`} />
                      <span className="font-mono text-xs">{log.invoice?.invoice_number}</span>
                      <span className="text-muted-foreground truncate">{log.action_taken}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {config.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewLog} onOpenChange={(o) => !o && setPreviewLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review AI-Generated Message</DialogTitle>
            <DialogDescription>
              {previewLog?.rule?.name} — {previewLog?.invoice?.invoice_number} ({previewLog?.client?.name})
            </DialogDescription>
          </DialogHeader>
          {previewLog && (() => {
            const message = parseMessage(previewLog.generated_message);
            return message ? (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="text-sm font-medium">{message.subject}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Body</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Approving will mark this message for sending. You can still edit it before sending from the Collections view.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                {previewLog.action_taken}
              </p>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewLog(null)}>Close</Button>
            {previewLog?.result === "awaiting_approval" && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => previewLog && handleReject(previewLog.id)}
                  disabled={rejectLog.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Decline
                </Button>
                <Button
                  size="sm"
                  onClick={() => previewLog && handleApprove(previewLog.id)}
                  disabled={approveLog.isPending}
                >
                  {approveLog.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Check className="h-4 w-4 mr-1" /> Approve & Send
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
