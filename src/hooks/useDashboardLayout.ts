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
    { id: "kpis", label: "KPIs" },
    { id: "revenue-trend", label: "Revenue Trend" },
    { id: "yoy-proposals-followups", label: "YoY / Proposals / Follow-Ups" },
    { id: "billing-goal-tracker", label: "Billing Goal Tracker" },
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
  ],
};

// Default: all widgets visible
function getDefaultVisibility(role: string): Record<string, boolean> {
  const widgets = ROLE_WIDGETS[role] || [];
  return Object.fromEntries(widgets.map((w) => [w.id, true]));
}

export function useDashboardLayout(role: string) {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getDefaultVisibility(role));
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

      if (savedLayout && typeof savedLayout === "object") {
        // Merge with defaults so new widgets show up
        setVisibility({ ...getDefaultVisibility(role), ...savedLayout });
      } else {
        setVisibility(getDefaultVisibility(role));
      }
      setLoaded(true);
    };
    loadPrefs();
  }, [profile?.id, role]);

  const toggleWidget = useCallback(
    async (widgetId: string) => {
      const newVis = { ...visibility, [widgetId]: !visibility[widgetId] };
      setVisibility(newVis);

      if (!profile?.id) return;

      // Save to profile
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", profile.id)
        .single();

      const prefs = (data?.notification_preferences as any) || {};
      const updatedPrefs = {
        ...prefs,
        dashboard_layout: {
          ...(prefs.dashboard_layout || {}),
          [role]: newVis,
        },
      };

      await supabase
        .from("profiles")
        .update({ notification_preferences: updatedPrefs } as any)
        .eq("id", profile.id);
    },
    [visibility, profile?.id, role]
  );

  const isVisible = useCallback(
    (widgetId: string) => visibility[widgetId] !== false,
    [visibility]
  );

  return { visibility, toggleWidget, isVisible, loaded, widgets: ROLE_WIDGETS[role] || [] };
}
