import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface EmployeeReview {
  id: string;
  company_id: string;
  employee_id: string;
  reviewer_id: string;
  review_period: string;
  overall_rating: number | null;
  previous_rating: number | null;
  category_ratings: Record<string, number> | null;
  comments: string | null;
  raise_pct: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useEmployeeReviews(employeeId: string) {
  return useQuery({
    queryKey: ["employee-reviews", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_reviews")
        .select("*, reviewer:profiles!employee_reviews_reviewer_id_fkey(first_name, last_name, display_name)")
        .eq("employee_id", employeeId)
        .order("review_period", { ascending: false });
      if (error) throw error;
      return (data || []) as (EmployeeReview & { reviewer: { first_name: string | null; last_name: string | null; display_name: string | null } })[];
    },
  });
}

export function useCreateEmployeeReview() {
  const qc = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async (review: {
      employee_id: string;
      review_period: string;
      overall_rating: number;
      previous_rating?: number | null;
      category_ratings?: Record<string, number>;
      comments?: string;
      raise_pct?: number | null;
    }) => {
      // Get current profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", session!.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("employee_reviews").insert({
        company_id: profile.company_id!,
        reviewer_id: profile.id,
        employee_id: review.employee_id,
        review_period: review.review_period,
        overall_rating: review.overall_rating,
        previous_rating: review.previous_rating ?? null,
        category_ratings: review.category_ratings ?? {},
        comments: review.comments ?? null,
        raise_pct: review.raise_pct ?? null,
      } as any);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["employee-reviews", variables.employee_id] });
    },
  });
}

export function useUpdateEmployeeReview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId, raise_pct }: { id: string; employeeId: string; raise_pct: number | null }) => {
      const { error } = await supabase
        .from("employee_reviews")
        .update({ raise_pct } as any)
        .eq("id", id);
      if (error) throw error;
      return employeeId;
    },
    onSuccess: (employeeId) => {
      qc.invalidateQueries({ queryKey: ["employee-reviews", employeeId] });
    },
  });
}
