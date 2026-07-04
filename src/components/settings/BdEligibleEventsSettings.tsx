import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useBdEligibleEvents, useUpsertBdEligibleEvent, useDeleteBdEligibleEvent,
} from "@/hooks/useBdComp";

export function BdEligibleEventsSettings() {
  const { data = [], isLoading } = useBdEligibleEvents();
  const upsert = useUpsertBdEligibleEvent();
  const del = useDeleteBdEligibleEvent();
  const [draft, setDraft] = useState({ name: "", organization: "", cadence: "" });

  const add = () => {
    if (!draft.name.trim()) return;
    upsert.mutate(
      { ...draft, active: true },
      {
        onSuccess: () => { setDraft({ name: "", organization: "", cadence: "" }); toast.success("Added"); },
        onError: (e: any) => toast.error(e?.message ?? "Failed"),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">BD Eligible Events</CardTitle>
        <p className="text-sm text-muted-foreground">Bonus-eligible event series (REBNY, AIA, etc.).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Name (e.g. REBNY Breakfast Series)" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <Input placeholder="Organization" value={draft.organization} onChange={(e) => setDraft((d) => ({ ...d, organization: e.target.value }))} />
          <Input placeholder="Cadence (monthly, quarterly…)" value={draft.cadence} onChange={(e) => setDraft((d) => ({ ...d, cadence: e.target.value }))} />
          <Button onClick={add} disabled={!draft.name.trim() || upsert.isPending}>
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>
        <div className="space-y-1">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : data.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p>
            : data.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{row.name}</span>
                  {row.organization && <span className="text-muted-foreground"> · {row.organization}</span>}
                  {row.cadence && <span className="text-muted-foreground"> · {row.cadence}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={!!row.active} onCheckedChange={(v) => upsert.mutate({ id: row.id, name: row.name, active: v })} />
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(row.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default BdEligibleEventsSettings;
