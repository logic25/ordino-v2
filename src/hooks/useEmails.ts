import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Email {
  id: string;
  company_id: string;
  user_id: string;
  gmail_message_id: string;
  thread_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  date: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  has_attachments: boolean;
  labels: string[] | null;
  is_read: boolean;
  synced_at: string;
  created_at: string;
}

export interface EmailWithTags extends Email {
  email_project_tags?: {
    id: string;
    project_id: string;
    category: string;
    notes: string | null;
    tagged_at: string;
    projects?: { id: string; name: string | null; project_number: string | null } | null;
  }[];
  email_attachments?: {
    id: string;
    filename: string;
    mime_type: string | null;
    size_bytes: number | null;
    gmail_attachment_id: string | null;
    saved_to_project: boolean;
  }[];
}

export interface EmailFilters {
  search?: string;
  untaggedOnly?: boolean;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useEmails(filters: EmailFilters = {}) {
  return useQuery({
    queryKey: ["emails", filters],
    queryFn: async () => {
      let query = supabase
        .from("emails")
        .select(`
          *,
          email_project_tags (
            id, project_id, category, notes, tagged_at,
            projects (id, name, project_number)
          ),
          email_attachments (
            id, filename, mime_type, size_bytes, gmail_attachment_id, saved_to_project
          )
        `)
        .order("date", { ascending: false })
        .limit(500);

      if (filters.search) {
        query = query.or(
          `subject.ilike.%${filters.search}%,snippet.ilike.%${filters.search}%,from_name.ilike.%${filters.search}%,from_email.ilike.%${filters.search}%`
        );
      }

      if (filters.dateFrom) {
        query = query.gte("date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("date", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data as unknown as EmailWithTags[];

      if (filters.untaggedOnly) {
        results = results.filter(
          (e) => !e.email_project_tags || e.email_project_tags.length === 0
        );
      }

      if (filters.projectId) {
        results = results.filter(
          (e) =>
            e.email_project_tags &&
            e.email_project_tags.some((t) => t.project_id === filters.projectId)
        );
      }

      return results;
    },
  });
}

export function useEmailDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["emails", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("emails")
        .select(`
          *,
          email_project_tags (
            id, project_id, category, notes, tagged_at,
            projects (id, name, project_number)
          ),
          email_attachments (
            id, filename, mime_type, size_bytes, gmail_attachment_id, saved_to_project
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as EmailWithTags;
    },
    enabled: !!id,
  });
}

export function useThreadEmails(threadId: string | null | undefined) {
  return useQuery({
    queryKey: ["thread-emails", threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const { data, error } = await supabase
        .from("emails")
        .select(`
          *,
          email_project_tags (
            id, project_id, category, notes, tagged_at,
            projects (id, name, project_number)
          ),
          email_attachments (
            id, filename, mime_type, size_bytes, gmail_attachment_id, saved_to_project
          )
        `)
        .eq("thread_id", threadId)
        .order("date", { ascending: true });

      if (error) throw error;
      return data as unknown as EmailWithTags[];
    },
    enabled: !!threadId,
  });
}

export function useTagEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      emailId,
      projectId,
      category = "other",
      notes = "",
    }: {
      emailId: string;
      projectId: string;
      category?: string;
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, company_id")
        .single();

      if (!profile) throw new Error("No profile found");

      const { data, error } = await supabase
        .from("email_project_tags")
        .insert({
          email_id: emailId,
          project_id: projectId,
          company_id: profile.company_id,
          tagged_by_id: profile.id,
          category,
          notes: notes || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["project-emails"] });
    },
  });
}

export function useUntagEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("email_project_tags")
        .delete()
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["project-emails"] });
    },
  });
}

export function useProjectEmails(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project-emails", projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("email_project_tags")
        .select(`
          id, category, notes, tagged_at,
          emails (
            id, gmail_message_id, thread_id, subject, from_email, from_name,
            date, snippet, has_attachments, is_read,
            email_attachments (id, filename, mime_type, size_bytes)
          )
        `)
        .eq("project_id", projectId)
        .order("tagged_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!projectId,
  });
}
