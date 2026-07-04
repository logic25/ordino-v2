import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCompanyProfiles } from "@/hooks/useProfiles";
import {
  useBdBonusLedger, useBdCompPlans, useIsCompAdmin,
  useUpdateBonusEntry, useUpsertCompPlan,
} from "@/hooks/useBdComp";
import { money } from "@/lib/bdComp";

export function BdCompAdminSettings() {
  const isCompAdmin = useIsCompAdmin();
  const { data: people = [] } = useCompanyProfiles();
  const plans = useBdCompPlans();
  const ledger = useBdBonusLedger();
  const updateEntry = useUpdateBonusEntry();
  const upsertPlan = useUpsertCompPlan();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const byPerson = useMemo(() => {
    const map = new Map<string, { accrued: number; approved: number; paid: number }>();
    for (const r of ledger.data ?? []) {
      const cur = map.get(r.person_id) ?? { accrued: 0, approved: 0, paid: 0 };
      if (r.status === "ACCRUED") cur.accrued += Number(r.amount);
      if (r.status === "APPROVED") cur.approved += Number(r.amount);
      if (r.status === "PAID") cur.paid += Number(r.amount);
      map.set(r.person_id, cur);
    }
    return map;
  }, [ledger.data]);

  if (!isCompAdmin) {
    return <p className="text-sm text-muted-foreground">Comp-admins only.</p>;
  }

  const startEdit = (personId: string) => {
    const p = plans.data?.find((x) => x.person_id === personId);
    setEditing(personId);
    setDraft({
      base_salary: p?.base_salary ?? 0,
      event_bonus_amount: p?.event_bonus_amount ?? 250,
      new_client_bonus_amount: p?.new_client_bonus_amount ?? 1000,
      small_contract_pct: p?.small_contract_pct ?? 50,
      small_contract_threshold: p?.small_contract_threshold ?? 2000,
      revenue_bonus_pct: p?.revenue_bonus_pct ?? 2,
      revenue_window_months: p?.revenue_window_months ?? 12,
    });
  };

  const savePlan = () => {
    if (!editing) return;
    upsertPlan.mutate(
      { person_id: editing, active: true, ...draft },
      {
        onSuccess: () => { toast.success("Plan saved"); setEditing(null); },
        onError: (e: any) => toast.error(e?.message ?? "Save failed"),
      }
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">BD Comp Rollup</CardTitle></CardHeader>
        <CardContent>
          {plans.isLoading || ledger.isLoading ? <Skeleton className="h-32" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left py-2">Person</th><th className="text-right">Accrued</th><th className="text-right">Approved</th><th className="text-right">Paid</th><th className="text-right">Plan</th></tr>
                </thead>
                <tbody>
                  {people.map((p) => {
                    const t = byPerson.get(p.id) ?? { accrued: 0, approved: 0, paid: 0 };
                    const plan = plans.data?.find((pl) => pl.person_id === p.id);
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="py-2">{p.display_name ?? p.first_name}</td>
                        <td className="text-right">{money(t.accrued)}</td>
                        <td className="text-right">{money(t.approved)}</td>
                        <td className="text-right">{money(t.paid)}</td>
                        <td className="text-right">
                          <Button size="sm" variant="outline" onClick={() => startEdit(p.id)}>
                            {plan ? "Edit" : "Create"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader><CardTitle className="text-base">Edit comp plan</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["base_salary", "Base salary"],
              ["event_bonus_amount", "Event bonus $"],
              ["new_client_bonus_amount", "New-client bonus $"],
              ["small_contract_pct", "Small-contract %"],
              ["small_contract_threshold", "Small-contract threshold"],
              ["revenue_bonus_pct", "Revenue bonus %"],
              ["revenue_window_months", "Revenue window (months)"],
            ].map(([k, label]) => (
              <div key={k}>
                <label className="text-xs text-muted-foreground">{label}</label>
                <Input type="number" value={draft[k] ?? 0} onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))} />
              </div>
            ))}
            <div className="col-span-full flex gap-2">
              <Button onClick={savePlan} disabled={upsertPlan.isPending}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Ledger — pending actions</CardTitle></CardHeader>
        <CardContent>
          {(ledger.data ?? []).filter((r) => r.status !== "PAID").length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <div className="space-y-2">
              {(ledger.data ?? []).filter((r) => r.status !== "PAID").map((r) => {
                const personName = people.find((p) => p.id === r.person_id)?.display_name ?? "—";
                return (
                  <div key={r.id} className="flex items-center justify-between border-b py-2 last:border-0">
                    <div className="text-sm">
                      <Badge variant="outline" className="mr-2 text-[10px]">{r.type}</Badge>
                      <span className="font-medium">{personName}</span>
                      <span className="text-muted-foreground"> · {r.notes ?? r.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{money(Number(r.amount))}</span>
                      <Badge variant="outline">{r.status}</Badge>
                      {r.status === "ACCRUED" && (
                        <Button size="sm" variant="outline" onClick={() => updateEntry.mutate({ id: r.id, status: "APPROVED" })}>Approve</Button>
                      )}
                      {r.status === "APPROVED" && (
                        <Button size="sm" onClick={() => updateEntry.mutate({ id: r.id, status: "PAID", paid_at: new Date().toISOString() })}>Mark Paid</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BdCompAdminSettings;
