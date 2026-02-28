

## Restore Financial Summary Cards to Project Detail Page

### What happened
The financial summary cards (Contract, Change Orders, Total Value, Billed, Internal Cost, Margin) were removed in a previous edit. You want them back, along with the contract total visible at the bottom of the services table.

### What will be done

**1. Restore Financial Summary Cards** (above the tabbed content area)
- Add back the 6-card grid showing: Contract, Change Orders, Total Value, Billed, Internal Cost, and Margin
- These cards will use the existing calculated variables (`contractTotal`, `approvedCOs`, `adjustedTotal`, `billed`, `cost`, `margin`) which are still computed in the component
- Placed between the Readiness Checklist and the main tabbed content card

**2. Contract total at the bottom**
- The services table footer already displays Contract, Billed, Remaining, and Cost at the bottom of the services tab -- this is already working. No changes needed here.

### Technical details

**File**: `src/pages/ProjectDetail.tsx`

Insert the following grid at ~line 384 (before the tabs `<Card>`):

```tsx
<div className="grid grid-cols-2 md:grid-cols-6 gap-3">
  {[
    { label: "Contract", value: servicesLoading ? "..." : formatCurrency(contractTotal) },
    { label: "Change Orders", value: approvedCOs > 0 ? `+${formatCurrency(approvedCOs)}` : "--" },
    { label: "Total Value", value: servicesLoading ? "..." : formatCurrency(adjustedTotal) },
    { label: "Billed", value: servicesLoading ? "..." : formatCurrency(billed), color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Internal Cost", value: formatCurrency(cost) },
    { label: "Margin", value: servicesLoading ? "..." : `${margin}%`, color: margin > 50 ? "text-emerald-600" : margin < 20 ? "text-red-600" : "" },
  ].map((stat) => (
    <Card key={stat.label}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{stat.label}</div>
        <div className={`text-xl font-bold mt-1 ${stat.color || ""}`}>{stat.value}</div>
      </CardContent>
    </Card>
  ))}
</div>
```

This is a single-file change restoring the exact cards that were previously removed.
