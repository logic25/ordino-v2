import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PaidSectionProps {
  monthlyRate: string;
  onMonthlyRateChange: (val: string) => void;
  billingStartDate: string;
  onBillingStartDateChange: (val: string) => void;
}

export function PaidSection({
  monthlyRate,
  onMonthlyRateChange,
  billingStartDate,
  onBillingStartDateChange,
}: PaidSectionProps) {
  return (
    <div className="space-y-3 border rounded-md p-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Monthly Rate ($)</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={monthlyRate}
            onChange={(e) => onMonthlyRateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Billing Start</Label>
          <Input
            type="date"
            value={billingStartDate}
            onChange={(e) => onBillingStartDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
