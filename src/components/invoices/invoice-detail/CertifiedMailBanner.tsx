import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import { useCertifiedMailings, useAddCertifiedMailing, uspsTrackingUrl } from "@/hooks/useCertifiedMailings";
import { useInvoiceActivityLog } from "@/hooks/useInvoiceFollowUps";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  invoiceId: string;
}

export function CertifiedMailBanner({ invoiceId }: Props) {
  const { data: activity } = useInvoiceActivityLog(invoiceId);
  const { data: mailings } = useCertifiedMailings(invoiceId);
  const add = useAddCertifiedMailing();
  const [tracking, setTracking] = useState("");

  const hasDemandLetter = (activity || []).some((a: any) => a.action === "demand_letter");
  if (!hasDemandLetter) return null;

  const latestDemand = (activity || []).find((a: any) => a.action === "demand_letter");
  const existing = mailings || [];

  const handleSave = async () => {
    if (!tracking.trim()) return;
    try {
      await add.mutateAsync({
        invoiceId,
        trackingNumber: tracking,
        demandLetterActivityId: latestDemand?.id,
      });
      toast({ title: "Certified mail logged", description: `Tracking ${tracking.trim()} saved.` });
      setTracking("");
    } catch (err: any) {
      toast({ title: "Failed to log tracking #", description: err.message, variant: "destructive" });
    }
  };

  if (existing.length > 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-0.5">
          <div className="font-medium text-emerald-900">Certified mail logged</div>
          {existing.map(m => (
            <div key={m.id} className="text-xs text-emerald-800 flex items-center gap-2">
              <span>Mailed {format(new Date(m.mailed_date), "MMM d, yyyy")} · Tracking</span>
              <a href={uspsTrackingUrl(m.usps_tracking_number)} target="_blank" rel="noopener noreferrer"
                 className="font-mono underline hover:text-emerald-900 inline-flex items-center gap-1">
                {m.usps_tracking_number} <ExternalLink className="h-3 w-3" />
              </a>
              {m.delivered_date && <span>· Delivered {format(new Date(m.delivered_date), "MMM d")}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-4 w-4 text-amber-700" />
        <span className="font-medium text-amber-900">Certified mail not yet logged</span>
      </div>
      <p className="text-xs text-amber-800 mb-2">
        Paste the USPS tracking number from the certified-mail receipt to record proof of mailing.
      </p>
      <div className="flex gap-2">
        <Input value={tracking} onChange={e => setTracking(e.target.value)}
               placeholder="e.g. 9407 1234 5678 9012 3456 78"
               className="h-8 text-xs bg-white" />
        <Button size="sm" onClick={handleSave} disabled={!tracking.trim() || add.isPending}>
          {add.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />} Save
        </Button>
      </div>
    </div>
  );
}
