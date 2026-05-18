import { supabase } from "@/integrations/supabase/client";

/**
 * Attempt to sync property data from CitiSignal API.
 * Returns the synced data on success, or null if unavailable (caller should fallback to Socrata).
 */
export async function syncFromCitiSignal(
  propertyId: string,
  bin: string | null | undefined,
): Promise<{ applications: any[]; violations: any[]; enrichment: any } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/citisignal-sync`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ property_id: propertyId, bin }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // If fallback flag is set, let caller know to use Socrata
      if (errorData.fallback) {
        return null;
      }
      throw new Error(errorData.error || `CitiSignal sync failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      applications: data.applications || [],
      violations: data.violations || [],
      enrichment: data.property_enrichment || {},
    };
  } catch (err) {
    console.warn("CitiSignal sync failed, will fallback to Socrata:", err);
    return null;
  }
}
