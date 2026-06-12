import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type WidgetWidth = "full" | "half";

export interface WidgetDef {
  id: string;
  label: string;
  /** widgets that should always be full width (tables, multi-panel) */
  lockedFull?: boolean;
}

// Widget definitions per role.
// `lockedFull` is reserved for widgets whose internal layout assumes a full row
// (e.g. KPI strips with their own 4-col grid). Everything else is resizable.
export const ROLE_WIDGETS: Record<string, WidgetDef[]> = {
  pm: [
    { id: "my-projects", label: "My Projects" },
    { id: "project-readiness", label: "Project Readiness" },
    { id: "proposal-followups", label: "Proposal Follow-Ups" },
    { id: "quick-time-log", label: "Quick Time Log" },
    { id: "my-action-items", label: "My Action Items" },
    { id: "billing-pulse", label: "My Billing Pulse" },
  ],
  admin: [
    { id: "kpis", label: "KPIs", lockedFull: true },
    { id: "billing-pulse", label: "Billing Pulse" },
    { id: "sales-health", label: "Sales Health" },
    { id: "stale-projects-total", label: "Stale Projects" },
    { id: "billing-pipeline", label: "Upcoming Billing Pipeline" },
    { id: "open-services", label: "Total Open Services" },
    { id: "proposal-conversion-rates", label: "Proposal Conversion" },
    { id: "revenue-trend", label: "Revenue Trend" },
    { id: "team-utilization", label: "Team Utilization & Projects by PM" },
    { id: "proposal-followups", label: "Proposal Follow-Ups" },
    { id: "expense-approvals", label: "Expense Approvals" },
    { id: "team-overview", label: "Team Overview" },
    { id: "event-prep-tasks", label: "Event Prep Tasks" },
  ],
  accounting: [
    { id: "kpis", label: "KPIs", lockedFull: true },
    { id: "billing-pulse-self", label: "My Billing Pulse" },
    { id: "billing-pulse-company", label: "Company Billing Pulse" },
    { id: "followups-by-type", label: "Follow-ups by Type" },
    { id: "aging-summary", label: "Aging Summary" },
    { id: "pending-billing", label: "PM Billing Submissions" },
  ],
  manager: [
    { id: "kpis", label: "KPIs", lockedFull: true },
    { id: "team-utilization", label: "Team Utilization" },
    { id: "projects-by-pm", label: "Projects by PM" },
    { id: "billing-goal-tracker", label: "Billing Pulse" },
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

function getDefaultWidths(role: string): Record<string, WidgetWidth> {
  const widgets = ROLE_WIDGETS[role] || [];
  return Object.fromEntries(widgets.map((w) => [w.id, "full" as WidgetWidth]));
}

export function useDashboardLayout(role: string) {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getDefaultVisibility(role));
  const [order, setOrderState] = useState<string[]>(() => getDefaultOrder(role));
  const [widths, setWidthsState] = useState<Record<string, WidgetWidth>>(() => getDefaultWidths(role));
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
      const savedWidths = prefs?.dashboard_widths?.[role];

      if (savedLayout && typeof savedLayout === "object") {
        setVisibility({ ...getDefaultVisibility(role), ...savedLayout });
      } else {
        setVisibility(getDefaultVisibility(role));
      }

      const defaultOrder = getDefaultOrder(role);
      if (Array.isArray(savedOrder)) {
        const merged = [
          ...savedOrder.filter((id) => defaultOrder.includes(id)),
          ...defaultOrder.filter((id) => !savedOrder.includes(id)),
        ];
        setOrderState(merged);
      } else {
        setOrderState(defaultOrder);
      }

      if (savedWidths && typeof savedWidths === "object") {
        setWidthsState({ ...getDefaultWidths(role), ...savedWidths });
      } else {
        setWidthsState(getDefaultWidths(role));
      }

      setLoaded(true);
    };
    loadPrefs();
  }, [profile?.id, role]);

  const savePrefs = useCallback(
    async (next: { visibility?: Record<string, boolean>; order?: string[]; widths?: Record<string, WidgetWidth> }) => {
      if (!profile?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", profile.id)
        .single();
      const prefs = (data?.notification_preferences as any) || {};
      const updated = { ...prefs };
      if (next.visibility) {
        updated.dashboard_layout = { ...(prefs.dashboard_layout || {}), [role]: next.visibility };
      }
      if (next.order) {
        updated.dashboard_order = { ...(prefs.dashboard_order || {}), [role]: next.order };
      }
      if (next.widths) {
        updated.dashboard_widths = { ...(prefs.dashboard_widths || {}), [role]: next.widths };
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

  const setWidth = useCallback(
    async (widgetId: string, width: WidgetWidth) => {
      const newWidths = { ...widths, [widgetId]: width };
      setWidthsState(newWidths);
      await savePrefs({ widths: newWidths });
    },
    [widths, savePrefs]
  );

  const resetLayout = useCallback(async () => {
    const defaultVis = getDefaultVisibility(role);
    const defaultOrd = getDefaultOrder(role);
    const defaultW = getDefaultWidths(role);
    setVisibility(defaultVis);
    setOrderState(defaultOrd);
    setWidthsState(defaultW);
    await savePrefs({ visibility: defaultVis, order: defaultOrd, widths: defaultW });
  }, [role, savePrefs]);

  const isVisible = useCallback(
    (widgetId: string) => visibility[widgetId] !== false,
    [visibility]
  );

  const widgetsList = ROLE_WIDGETS[role] || [];
  const widthOf = useCallback(
    (widgetId: string): WidgetWidth => {
      const def = widgetsList.find((w) => w.id === widgetId);
      if (def?.lockedFull) return "full";
      return widths[widgetId] ?? "full";
    },
    [widths, widgetsList]
  );

  return {
    visibility,
    order,
    widths,
    widthOf,
    toggleWidget,
    setOrder,
    setWidth,
    resetLayout,
    isVisible,
    loaded,
    widgets: widgetsList,
  };
}
