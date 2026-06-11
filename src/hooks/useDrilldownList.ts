import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import type { DrillInRow } from "@/components/dashboard/DrillInModal";

export type DrilldownKind =
  | "active-projects"
  | "active-proposals"
  | "ar-outstanding"
  | "proposal-followups"
  | "stale-projects";

interface Options {
  /** For stale-projects: only this PM */
  pmId?: string;
  /** For stale-projects: stale threshold */
  thresholdDays?: number;
  enabled?: boolean;
}

function nameOf(p: any) {
  return `${p?.first_name || ""} ${p?.last_name || ""}`.trim() || p?.display_name || "Unknown";
}

export function useDrilldownList(kind: DrilldownKind, opts: Options = {}) {
  const { profile } = useAuth() as any;
  const enabled = (opts.enabled ?? true) && !!profile?.company_id;
  return useQuery({
    queryKey: ["drilldown-list", kind, profile?.company_id, opts.pmId ?? null, opts.thresholdDays ?? null],
    enabled,
    queryFn: async (): Promise<DrillInRow[]> => {
      const companyId = profile.company_id as string;

      if (kind === "active-projects") {
        const { data } = await supabase
          .from("projects")
          .select("id, name, project_number, last_activity_at, clients(name), assigned_pm:profiles!projects_assigned_pm_id_fkey(first_name, last_name, display_name)")
          .eq("company_id", companyId)
          .eq("status", "open")
          .order("last_activity_at", { ascending: false })
          .limit(200);
        return (data || []).map((p: any) => ({
          id: p.id,
          primary: `${p.project_number ? p.project_number + " · " : ""}${p.name || "Untitled"}`,
          secondary: [p.clients?.name, p.assigned_pm ? nameOf(p.assigned_pm) : null].filter(Boolean).join(" · "),
          href: `/projects/${p.id}`,
        }));
      }

      if (kind === "active-proposals") {
        const { data } = await supabase
          .from("proposals")
          .select("id, title, status, total_amount, sent_at, clients(name)")
          .eq("company_id", companyId)
          .in("status", ["sent", "signed_client"])
          .order("sent_at", { ascending: false })
          .limit(200);
        return (data || []).map((p: any) => ({
          id: p.id,
          primary: p.title || "Untitled proposal",
          secondary: [p.clients?.name, formatCurrency(Number(p.total_amount) || 0)].filter(Boolean).join(" · "),
          badge: { label: p.status === "signed_client" ? "Signed" : "Sent", tone: p.status === "signed_client" ? "success" : "default" },
          href: `/proposals?id=${p.id}`,
        }));
      }

      if (kind === "ar-outstanding") {
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, status, total_due, payment_amount, due_date, clients(name)")
          .in("status", ["sent", "overdue"])
          .order("due_date", { ascending: true })
          .limit(200);
        return (data || []).map((i: any) => {
          const remaining = Math.max(0, (Number(i.total_due) || 0) - (Number(i.payment_amount) || 0));
          return {
            id: i.id,
            primary: `${i.invoice_number || "Invoice"} · ${formatCurrency(remaining)}`,
            secondary: [i.clients?.name, i.due_date ? `Due ${i.due_date}` : null].filter(Boolean).join(" · "),
            badge: { label: i.status === "overdue" ? "Overdue" : "Sent", tone: i.status === "overdue" ? "danger" : "default" },
            href: `/billing?invoice=${i.id}`,
          };
        });
      }

      if (kind === "proposal-followups") {
        const { data } = await supabase
          .from("proposals")
          .select("id, title, sent_at, next_follow_up_date, total_amount, clients(name)")
          .eq("company_id", companyId)
          .eq("status", "sent")
          .not("next_follow_up_date", "is", null)
          .lte("next_follow_up_date", new Date().toISOString())
          .order("next_follow_up_date", { ascending: true })
          .limit(200);
        return (data || []).map((p: any) => {
          const days = p.next_follow_up_date
            ? Math.max(0, Math.floor((Date.now() - new Date(p.next_follow_up_date).getTime()) / 86400000))
            : 0;
          return {
            id: p.id,
            primary: p.title || "Untitled proposal",
            secondary: [p.clients?.name, formatCurrency(Number(p.total_amount) || 0)].filter(Boolean).join(" · "),
            badge: { label: days === 0 ? "Today" : `${days}d overdue`, tone: days >= 7 ? "danger" : "warning" },
            href: `/proposals?id=${p.id}`,
          };
        });
      }

      if (kind === "stale-projects") {
        const threshold = opts.thresholdDays ?? 14;
        const cutoff = new Date(Date.now() - threshold * 86400000).toISOString();
        let q = supabase
          .from("projects")
          .select("id, name, project_number, last_activity_at, assigned_pm_id, clients(name), assigned_pm:profiles!projects_assigned_pm_id_fkey(first_name, last_name, display_name)")
          .eq("company_id", companyId)
          .eq("status", "open")
          .lt("last_activity_at", cutoff)
          .order("last_activity_at", { ascending: true })
          .limit(200);
        if (opts.pmId) q = q.eq("assigned_pm_id", opts.pmId);
        const { data } = await q;
        return (data || []).map((p: any) => {
          const days = p.last_activity_at
            ? Math.floor((Date.now() - new Date(p.last_activity_at).getTime()) / 86400000)
            : 9999;
          return {
            id: p.id,
            primary: `${p.project_number ? p.project_number + " · " : ""}${p.name || "Untitled"}`,
            secondary: [p.clients?.name, p.assigned_pm ? nameOf(p.assigned_pm) : "Unassigned"].filter(Boolean).join(" · "),
            badge: { label: days >= 9999 ? "No activity" : `${days}d idle`, tone: days >= 30 ? "danger" : "warning" },
            href: `/projects/${p.id}`,
          };
        });
      }

      return [];
    },
  });
}
