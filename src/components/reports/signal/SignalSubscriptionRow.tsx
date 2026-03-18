import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Gift, DollarSign } from "lucide-react";
import { SignalStatusBadge } from "@/components/properties/SignalStatusBadge";
import { format, differenceInDays, parseISO } from "date-fns";

interface SubscriptionRow {
  id: string;
  status: string;
  is_complimentary: boolean;
  monthly_rate: number | null;
  subscribed_at: string | null;
  expires_at: string | null;
  property_address?: string;
  enrolled_by_name?: string;
  project_name?: string;
}

export function SignalSubscriptionRow({ sub }: { sub: SubscriptionRow }) {
  const daysUntilExpiry = sub.expires_at ? differenceInDays(parseISO(sub.expires_at), new Date()) : null;

  return (
    <TableRow>
      <TableCell className="font-medium max-w-[220px] truncate">{sub.property_address}</TableCell>
      <TableCell>
        <SignalStatusBadge status={sub.status} isComplimentary={sub.is_complimentary} />
      </TableCell>
      <TableCell>
        {sub.is_complimentary ? (
          <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-600 border-purple-500/20">
            <Gift className="h-3 w-3" /> Comp
          </Badge>
        ) : Number(sub.monthly_rate) > 0 ? (
          <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <DollarSign className="h-3 w-3" /> Paid
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Not Set</Badge>
        )}
      </TableCell>
      <TableCell>
        {sub.is_complimentary ? (
          <span className="text-muted-foreground text-sm">—</span>
        ) : (
          <span className="font-medium">${Number(sub.monthly_rate || 0).toLocaleString()}</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{sub.enrolled_by_name}</TableCell>
      <TableCell className="text-sm">
        {sub.subscribed_at ? format(parseISO(sub.subscribed_at), "MMM d, yyyy") : "—"}
      </TableCell>
      <TableCell className="text-sm">
        {sub.expires_at ? (
          <span className={daysUntilExpiry !== null && daysUntilExpiry <= 30 ? "text-destructive font-medium" : ""}>
            {format(parseISO(sub.expires_at), "MMM d, yyyy")}
            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0 && (
              <span className="text-xs ml-1">({daysUntilExpiry}d)</span>
            )}
          </span>
        ) : "—"}
      </TableCell>
      <TableCell className="text-sm max-w-[180px] truncate">
        {sub.project_name || <span className="text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}
