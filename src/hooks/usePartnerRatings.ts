import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of client_id → average review rating
 * for companies flagged as RFP partners.
 */
export function usePartnerRatings() {
  return useQuery({
    queryKey: ["partner-ratings"],
    queryFn: async () => {
      // Get all reviews grouped by client
      const { data, error } = await supabase
        .from("company_reviews")
        .select("client_id, rating");

      if (error) throw error;

      const map: Record<string, number> = {};
      const counts: Record<string, number> = {};

      for (const row of data || []) {
        if (!map[row.client_id]) {
          map[row.client_id] = 0;
          counts[row.client_id] = 0;
        }
        map[row.client_id] += row.rating;
        counts[row.client_id]++;
      }

      // Convert sums to averages
      for (const id of Object.keys(map)) {
        map[id] = map[id] / counts[id];
      }

      return map;
    },
  });
}
