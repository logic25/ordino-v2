import { useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

// Session ID: regenerated per browser tab/session for drop-off detection
function getSessionId(): string {
  let sid = sessionStorage.getItem("_tel_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("_tel_sid", sid);
  }
  return sid;
}

export function useTelemetry() {
  const { session, profile } = useAuth();
  const sessionId = useRef(getSessionId()).current;

  const track = useCallback(
    (page: string, action: string, metadata?: Record<string, unknown>) => {
      if (!session?.user?.id) return;
      const companyId = (profile as any)?.company_id;
      if (!companyId) return;

      // Fire-and-forget — never blocks UI, silently ignores errors
      supabase
        .from("telemetry_events")
        .insert({
          user_id: session.user.id,
          company_id: companyId,
          session_id: sessionId,
          page,
          action,
          metadata: metadata ?? {},
        } as any)
        .then(() => {});
    },
    [session?.user?.id, (profile as any)?.company_id, sessionId]
  );

  return { track };
}
