import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, AlertTriangle, FileText, Shield } from "lucide-react";
import { SignalStatusBadge } from "./SignalStatusBadge";
import { SignalEnrollDialog } from "./SignalEnrollDialog";
import { useSignalViolations, summarizeViolations } from "@/hooks/useSignalViolations";
import { useSignalApplications } from "@/hooks/useSignalApplications";
import type { SignalSubscription } from "@/hooks/useSignalSubscriptions";

interface SignalSectionProps {
  propertyId: string;
  propertyAddress: string;
  subscription: SignalSubscription | null | undefined;
}

export function SignalSection({ propertyId, propertyAddress, subscription }: SignalSectionProps) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const { data: violations = [] } = useSignalViolations(propertyId);
  const { data: externalApps = [] } = useSignalApplications(propertyId);
  const summaries = summarizeViolations(violations);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          Signal
        </p>
        <div className="flex items-center gap-2">
          <SignalStatusBadge status={subscription?.status || null} showIcon={false} />
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEnrollOpen(true)}>
            {subscription ? "Manage" : "Enroll"}
          </Button>
        </div>
      </div>

      {!subscription && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 flex items-start gap-2">
          <Shield className="h-4 w-4 mt-0.5 shrink-0" />
          <span>This property is not monitored by Signal. Enroll to track violations and external applications.</span>
        </div>
      )}

      {/* Violations Summary */}
      {summaries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Violations</p>
          <div className="grid gap-2">
            {summaries.map((s) => (
              <div
                key={s.agency}
                className="flex items-center justify-between bg-background rounded-md border px-3 py-2"
              >
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
          <p className="text-xs font-medium text-muted-foreground">
            External Applications ({externalApps.length})
          </p>
          <div className="grid gap-2">
            {externalApps.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between bg-background rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {app.application_type}
                      {app.job_number && (
                        <span className="text-muted-foreground font-normal ml-2">
                          #{app.job_number}
                        </span>
                      )}
                    </p>
                    {app.applicant_name && (
                      <p className="text-xs text-muted-foreground">
                        Filed by: {app.applicant_name}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                  <Radio className="h-3 w-3" />
                  Signal
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
