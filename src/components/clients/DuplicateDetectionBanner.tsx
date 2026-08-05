import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Merge, ChevronDown, ChevronUp, X, Split } from "lucide-react";
import type { Client } from "@/hooks/useClients";
import { MergeClientsDialog } from "./MergeClientsDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DuplicateGroup {
  key: string;
  reason: string;
  clients: Client[];
}

function normalize(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function findDuplicateGroups(clients: Client[], exclusions: Set<string>): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];

  // 1. Group by similar company name
  const nameMap = new Map<string, Client[]>();
  for (const c of clients) {
    const name = normalize(c.name);
    if (!name) continue;
    let matched = false;
    for (const [key, group] of nameMap) {
      if (name === key || name.includes(key) || key.includes(name)) {
        group.push(c);
        matched = true;
        break;
      }
    }
    if (!matched) {
      nameMap.set(name, [c]);
    }
  }
  for (const [, group] of nameMap) {
    const reviewable = group.filter((client, index) =>
      group.some((other, otherIndex) => index !== otherIndex && !exclusions.has(pairKey(client.id, other.id)))
    );
    if (reviewable.length >= 2) {
      groups.push({
        key: `name-${group[0].id}`,
        reason: `Similar company name`,
        clients: reviewable,
      });
    }
  }

  // 2. Group by exact phone match (not already grouped)
  const allGroupedIds = new Set(groups.flatMap((g) => g.clients.map((c) => c.id)));
  const phoneRemaining = clients.filter((c) => !allGroupedIds.has(c.id));
  const phoneMap = new Map<string, Client[]>();
  for (const c of phoneRemaining) {
    const phone = (c.phone || "").replace(/\D/g, "");
    if (phone.length < 7) continue;
    if (!phoneMap.has(phone)) phoneMap.set(phone, []);
    phoneMap.get(phone)!.push(c);
  }
  for (const [phone, group] of phoneMap) {
    const reviewable = group.filter((client, index) =>
      group.some((other, otherIndex) => index !== otherIndex && !exclusions.has(pairKey(client.id, other.id)))
    );
    if (reviewable.length >= 2) {
      groups.push({
        key: `phone-${phone}`,
        reason: `Same phone: ${group[0].phone}`,
        clients: reviewable,
      });
    }
  }

  return groups;
}

interface DuplicateDetectionBannerProps {
  clients: Client[];
}

export function DuplicateDetectionBanner({ clients }: DuplicateDetectionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup | null>(null);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exclusions = [] } = useQuery({
    queryKey: ["client-duplicate-exclusions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_duplicate_exclusions")
        .select("client_id_low, client_id_high");
      if (error) throw error;
      return data || [];
    },
  });

  const excludedPairs = useMemo(
    () => new Set(exclusions.map((row) => pairKey(row.client_id_low, row.client_id_high))),
    [exclusions],
  );

  const groups = useMemo(() => findDuplicateGroups(clients, excludedPairs), [clients, excludedPairs]);

  const keepSeparate = async (group: DuplicateGroup) => {
    const companyId = group.clients[0]?.company_id;
    const { data: { user } } = await supabase.auth.getUser();
    if (!companyId || !user) return;
    setSavingGroup(group.key);
    const rows = group.clients.flatMap((client, index) =>
      group.clients.slice(index + 1).map((other) => {
        const [client_id_low, client_id_high] = [client.id, other.id].sort();
        return { company_id: companyId, client_id_low, client_id_high, created_by: user.id };
      })
    );
    const { error } = await supabase.from("client_duplicate_exclusions").upsert(rows, {
      onConflict: "company_id,client_id_low,client_id_high",
      ignoreDuplicates: true,
    });
    setSavingGroup(null);
    if (error) {
      toast({ title: "Could not save review", description: error.message, variant: "destructive" });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["client-duplicate-exclusions"] });
    toast({ title: "Companies kept separate", description: "This pair will not be suggested as a duplicate again." });
  };

  if (groups.length === 0 || dismissed) return null;

  const totalDuplicates = groups.reduce((sum, g) => sum + g.clients.length, 0);

  return (
    <>
      <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
          <div className="flex-1 min-w-0">
            <AlertDescription className="text-sm font-medium">
              {groups.length} potential duplicate group{groups.length > 1 ? "s" : ""} detected ({totalDuplicates} records)
            </AlertDescription>
            {expanded && (
              <div className="mt-3 space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className="flex items-center justify-between gap-2 rounded-md border border-yellow-500/30 bg-background/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.clients.map((c) => (
                          <Badge key={c.id} variant="secondary" className="text-xs font-normal">
                            {c.name}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{group.reason}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={savingGroup === group.key}
                        onClick={() => keepSeparate(group)}
                      >
                        <Split className="mr-1 h-3 w-3" />
                        Keep separate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-yellow-500/50 hover:bg-yellow-500/10"
                        onClick={() => setMergeGroup(group)}
                      >
                        <Merge className="h-3 w-3 mr-1" />
                        Merge
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>Hide <ChevronUp className="h-3 w-3 ml-1" /></>
              ) : (
                <>Review <ChevronDown className="h-3 w-3 ml-1" /></>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/10"
              onClick={() => setDismissed(true)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Alert>

      {mergeGroup && (
        <MergeClientsDialog
          open={!!mergeGroup}
          onOpenChange={(open) => { if (!open) setMergeGroup(null); }}
          clients={mergeGroup.clients}
          onComplete={() => setMergeGroup(null)}
        />
      )}
    </>
  );
}
