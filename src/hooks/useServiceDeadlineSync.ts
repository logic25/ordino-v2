import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * When a service due_date is set/changed, sync a "deadline" calendar event.
 * - Creates event if none exists for that service
 * - Updates event if due_date changed
 * - Deletes event if due_date cleared
 */
export function useUpdateServiceWithDeadline() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      serviceId,
      projectId,
      updates,
    }: {
      serviceId: string;
      projectId: string;
      updates: Record<string, any>;
    }) => {
      if (!profile?.company_id || !profile?.id) throw new Error("No profile");

      // 1. Update the service
      const { error: svcErr } = await supabase
        .from("services")
        .update(updates)
        .eq("id", serviceId);
      if (svcErr) throw svcErr;

      // 2. Sync calendar event for due_date
      if ("due_date" in updates) {
        await syncDeadlineEvent({
          serviceId,
          projectId,
          dueDate: updates.due_date || null,
          serviceName: updates.name,
          companyId: profile.company_id,
          userId: profile.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

async function syncDeadlineEvent({
  serviceId,
  projectId,
  dueDate,
  serviceName,
  companyId,
  userId,
}: {
  serviceId: string;
  projectId: string;
  dueDate: string | null;
  serviceName?: string;
  companyId: string;
  userId: string;
}) {
  // Find existing deadline event for this service
  const { data: existing } = await supabase
    .from("calendar_events")
    .select("id")
    .eq("event_type", "deadline")
    .contains("metadata", { service_id: serviceId } as any)
    .limit(1);

  const existingEvent = existing?.[0];

  if (!dueDate) {
    // Due date cleared — delete event
    if (existingEvent) {
      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", event_id: existingEvent.id },
      }).catch(() => {});
      await supabase.from("calendar_events").delete().eq("id", existingEvent.id);
    }
    return;
  }

  // Build start/end times (9:00 AM - 9:30 AM on due date)
  const startTime = `${dueDate}T09:00:00`;
  const endTime = `${dueDate}T09:30:00`;

  // Resolve service name if not provided
  let title = serviceName;
  if (!title) {
    const { data: svc } = await supabase
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .single();
    title = svc?.name || "Service";
  }

  const eventTitle = `${title} — Due`;

  if (existingEvent) {
    // Update existing event
    try {
      await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "update",
          event_id: existingEvent.id,
          title: eventTitle,
          start_time: startTime,
          end_time: endTime,
        },
      });
    } catch {
      // Fallback: update locally
      await supabase
        .from("calendar_events")
        .update({ title: eventTitle, start_time: startTime, end_time: endTime, updated_at: new Date().toISOString() })
        .eq("id", existingEvent.id);
    }
  } else {
    // Create new event via google-calendar-sync (handles both local + Google)
    try {
      await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "create",
          title: eventTitle,
          start_time: startTime,
          end_time: endTime,
          event_type: "deadline",
          project_id: projectId,
          metadata: { service_id: serviceId },
        },
      });
    } catch {
      // Fallback: create locally only
      await supabase.from("calendar_events").insert({
        company_id: companyId,
        user_id: userId,
        title: eventTitle,
        start_time: startTime,
        end_time: endTime,
        event_type: "deadline",
        project_id: projectId,
        metadata: { service_id: serviceId },
        status: "confirmed",
        sync_status: "local_only",
      });
    }
  }
}
