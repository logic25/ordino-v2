import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, AlertTriangle, FileText, Shield, User, Link, DollarSign, Clock } from "lucide-react";
import { SignalStatusBadge } from "./SignalStatusBadge";
import { SignalEnrollDialog } from "./SignalEnrollDialog";
import { useSignalViolations, summarizeViolations } from "@/hooks/useSignalViolations";
import { useSignalApplications } from "@/hooks/useSignalApplications";
import type { SignalSubscription } from "@/hooks/useSignalSubscriptions";
import { differenceInDays, parseISO, isPast } from "date-fns";

interface SignalSectionProps {
  propertyId: string;
  propertyAddress: string;
  subscription: SignalSubscription | null | undefined;
}

function ExpirationCountdown({ expiresAt }: { expiresAt: string }) {
  const expDate = parseISO(expiresAt);
  if (isPast(expDate)) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  }
  const days = differenceInDays(expDate, new Date());
  const color = days <= 30 ? "text-destructive" : "text-muted-foreground";
  return <span className={`text-xs ${color}`}>Expires in {days} day{days !== 1 ? "s" : ""}</span>;
}

export function SignalSection({ propertyId, propertyAddress, subscription }: SignalSectionProps) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { data: violations = [] } = useSignalViolations(propertyId);
  const { data: externalApps = [] } = useSignalApplications(propertyId);
  const summaries = summarizeViolations(violations);

  const linkedProjectClosed = subscription?.linked_project_phase === "closeout";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          CitiSignal
        </p>
        <div className="flex items-center gap-2">
          <SignalStatusBadge status={subscription?.status || null} isComplimentary={subscription?.is_complimentary} showIcon={false} />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEnrollOpen(true)}>
            {subscription ? "Manage" : "Enroll"}
          </Button>
        </div>
      </div>

      {!subscription && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 flex items-start gap-2">
          <Shield className="h-4 w-4 mt-0.5 shrink-0" />
          <span>This property is not monitored by CitiSignal. Enroll to track violations and external applications.</span>
        </div>
      )}

      {/* Attribution & subscription details */}
      {subscription && (
        <div className="space-y-1.5 text-sm">
          {/* Enrolled by */}
          {subscription.enrolled_by_name && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Sold by: <span className="text-foreground font-medium">{subscription.enrolled_by_name}</span></span>
            </div>
          )}

          {/* Complimentary with linked project */}
          {subscription.is_complimentary && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Link className="h-3.5 w-3.5" />
              {subscription.linked_project_name ? (
                <span>Complimentary — linked to <span className="text-foreground font-medium">{subscription.linked_project_name}</span></span>
              ) : (
                <span>Complimentary — no project linked yet</span>
              )}
            </div>
          )}

          {/* Paid rate */}
          {!subscription.is_complimentary && subscription.monthly_rate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Paid — ${subscription.monthly_rate.toLocaleString()}/mo</span>
            </div>
          )}

          {/* Expiration countdown */}
          {subscription.expires_at && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <ExpirationCountdown expiresAt={subscription.expires_at} />
            </div>
          )}

          {/* Warning: linked project closed */}
          {subscription.is_complimentary && linkedProjectClosed && (
            <div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Linked project closed — review subscription
            </div>
          )}
        </div>
      )}

      {/* Violations Summary */}
      {summaries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Violations</p>
          <div className="grid gap-2">
            {summaries.map((s) => (
              <div key={s.agency} className="flex items-center justify-between bg-background rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{s.agency}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.open} open · {s.resolved} resolved
                      {s.totalPenalty > 0 && ` · $${s.totalPenalty.toLocaleString()} penalties`}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={s.open > 0 ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}>
                  {s.total}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Applications */}
      {externalApps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">External Applications ({externalApps.length})</p>
          <div className="grid gap-2">
            {externalApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between bg-background rounded-md border px-3 py-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {app.application_type}
                      {app.job_number && <span className="text-muted-foreground font-normal ml-2">#{app.job_number}</span>}
                    </p>
                    {app.applicant_name && <p className="text-xs text-muted-foreground">Filed by: {app.applicant_name}</p>}
                  </div>
                </div>
                <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                  <Radio className="h-3 w-3" />
                  CitiSignal
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <SignalEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        propertyId={propertyId}
        propertyAddress={propertyAddress}
        existing={subscription}
      />
    </div>
  );
}
