import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Widget definitions per role
export const ROLE_WIDGETS: Record<string, { id: string; label: string }[]> = {
  pm: [
    { id: "my-projects", label: "My Projects" },
    { id: "project-readiness", label: "Project Readiness" },
    { id: "proposal-followups", label: "Proposal Follow-Ups" },
    { id: "quick-time-log", label: "Quick Time Log" },
  ],
  admin: [
    { id: "billing-pulse", label: "Billing Pulse" },
    { id: "proposals-pipeline", label: "Proposals Pipeline" },
    { id: "proposal-conversion-rates", label: "Proposals & Billing" },
    { id: "revenue-trend", label: "Revenue Trend" },
    { id: "billing-pipeline", label: "Upcoming Billing Pipeline" },
    { id: "kpis", label: "KPIs" },
    { id: "team-utilization", label: "Team Utilization & Projects by PM" },
    { id: "stale-projects-by-pm", label: "Stale Projects by PM" },
    { id: "proposal-followups", label: "Proposal Follow-Ups" },
    { id: "expense-approvals", label: "Expense Approvals" },
    { id: "team-overview", label: "Team Overview" },
  ],
  accounting: [
    { id: "kpis", label: "KPIs" },
    { id: "pending-billing", label: "Pending Billing Requests" },
    { id: "overdue-invoices", label: "Overdue Invoices" },
    { id: "promises", label: "Payment Promises" },
    { id: "billing-summary", label: "Billing Summary" },
  ],
  manager: [
    { id: "kpis", label: "KPIs" },
    { id: "team-utilization", label: "Team Utilization" },
    { id: "projects-by-pm", label: "Projects by PM" },
    { id: "billing-goal-tracker", label: "Billing Goal Tracker" },
    { id: "proposal-followups", label: "Proposal Follow-Ups" },
    { id: "team-overview", label: "Team Overview" },
    { id: "my-action-items", label: "My Action Items (personal)" },
    { id: "my-projects", label: "My Projects (personal)" },
    { id: "quick-time-log", label: "Quick Time Log (personal)" },
  ],
};

function getDefaultVisibility(role: string): Record<string, boolean> {
  const widgets = ROLE_WIDGETS[role] || [];
  return Object.fromEntries(widgets.map((w) => [w.id, true]));
}

function getDefaultOrder(role: string): string[] {
  return (ROLE_WIDGETS[role] || []).map((w) => w.id);
}

export function useDashboardLayout(role: string) {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getDefaultVisibility(role));
  const [order, setOrderState] = useState<string[]>(() => getDefaultOrder(role));
  const [loaded, setLoaded] = useState(false);

  // Load saved layout from profile preferences
  useEffect(() => {
    if (!profile?.id) return;
    const loadPrefs = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", profile.id)
        .single();

      const prefs = (data?.notification_preferences as any) || {};
      const savedLayout = prefs?.dashboard_layout?.[role];
      const savedOrder = prefs?.dashboard_order?.[role];

      if (savedLayout && typeof savedLayout === "object") {
        setVisibility({ ...getDefaultVisibility(role), ...savedLayout });
      } else {
        setVisibility(getDefaultVisibility(role));
      }

      const defaultOrder = getDefaultOrder(role);
      if (Array.isArray(savedOrder)) {
        // Merge: keep saved order, append any new widgets at the end
        const merged = [
          ...savedOrder.filter((id) => defaultOrder.includes(id)),
          ...defaultOrder.filter((id) => !savedOrder.includes(id)),
        ];
        setOrderState(merged);
      } else {
        setOrderState(defaultOrder);
      }
      setLoaded(true);
    };
    loadPrefs();
  }, [profile?.id, role]);

  const savePrefs = useCallback(
    async (next: { visibility?: Record<string, boolean>; order?: string[] }) => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", profile.id)
        .single();
      const prefs = (data?.notification_preferences as any) || {};
      const updated = { ...prefs };
      if (next.visibility) {
        updated.dashboard_layout = {
          ...(prefs.dashboard_layout || {}),
          [role]: next.visibility,
        };
      }
      if (next.order) {
        updated.dashboard_order = {
          ...(prefs.dashboard_order || {}),
          [role]: next.order,
        };
      }
      await supabase
        .from("profiles")
        .update({ notification_preferences: updated } as any)
        .eq("id", profile.id);
    },
    [profile?.id, role]
  );

  const toggleWidget = useCallback(
    async (widgetId: string) => {
      const newVis = { ...visibility, [widgetId]: !visibility[widgetId] };
      setVisibility(newVis);
      await savePrefs({ visibility: newVis });
    },
    [visibility, savePrefs]
  );

  const setOrder = useCallback(
    async (newOrder: string[]) => {
      setOrderState(newOrder);
      await savePrefs({ order: newOrder });
    },
    [savePrefs]
  );

  const resetLayout = useCallback(async () => {
    const defaultVis = getDefaultVisibility(role);
    const defaultOrd = getDefaultOrder(role);
    setVisibility(defaultVis);
    setOrderState(defaultOrd);
    await savePrefs({ visibility: defaultVis, order: defaultOrd });
  }, [role, savePrefs]);

  const isVisible = useCallback(
    (widgetId: string) => visibility[widgetId] !== false,
    [visibility]
  );

  return {
    visibility,
    order,
    toggleWidget,
    setOrder,
    resetLayout,
    isVisible,
    loaded,
    widgets: ROLE_WIDGETS[role] || [],
  };
}
