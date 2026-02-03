export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_date: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          application_id: string | null
          attachments: Json | null
          billable: boolean | null
          company_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          service_id: string | null
          started_at: string | null
          updated_at: string | null
          user_id: string | null
          voice_note_url: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          application_id?: string | null
          attachments?: Json | null
          billable?: boolean | null
          company_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          service_id?: string | null
          started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_note_url?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          application_id?: string | null
          attachments?: Json | null
          billable?: boolean | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          service_id?: string | null
          started_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "dob_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_id: string
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      dob_applications: {
        Row: {
          application_type: string | null
          approved_date: string | null
          assigned_pm_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          estimated_value: number | null
          examiner_name: string | null
          filed_date: string | null
          id: string
          job_number: string | null
          metadata: Json | null
          notes: string | null
          permit_issued_date: string | null
          property_id: string
          status: Database["public"]["Enums"]["application_status"] | null
          updated_at: string | null
        }
        Insert: {
          application_type?: string | null
          approved_date?: string | null
          assigned_pm_id?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          estimated_value?: number | null
          examiner_name?: string | null
          filed_date?: string | null
          id?: string
          job_number?: string | null
          metadata?: Json | null
          notes?: string | null
          permit_issued_date?: string | null
          property_id: string
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
        }
        Update: {
          application_type?: string | null
          approved_date?: string | null
          assigned_pm_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          estimated_value?: number | null
          examiner_name?: string | null
          filed_date?: string | null
          id?: string
          job_number?: string | null
          metadata?: Json | null
          notes?: string | null
          permit_issued_date?: string | null
          property_id?: string
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dob_applications_assigned_pm_id_fkey"
            columns: ["assigned_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dob_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dob_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string | null
          display_name: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          phone: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          bin: string | null
          block: string | null
          borough: string | null
          company_id: string
          created_at: string | null
          id: string
          lot: string | null
          metadata: Json | null
          notes: string | null
          owner_contact: string | null
          owner_name: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address: string
          bin?: string | null
          block?: string | null
          borough?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          lot?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_contact?: string | null
          owner_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          bin?: string | null
          block?: string | null
          borough?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          lot?: string | null
          metadata?: Json | null
          notes?: string | null
          owner_contact?: string | null
          owner_name?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string | null
          description: string | null
          discount_amount: number | null
          discount_percent: number | null
          estimated_hours: number | null
          id: string
          metadata: Json | null
          name: string
          proposal_id: string
          quantity: number | null
          sort_order: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          name: string
          proposal_id: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_hours?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          proposal_id?: string
          quantity?: number | null
          sort_order?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_milestones: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          percentage: number | null
          proposal_id: string
          sort_order: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          percentage?: number | null
          proposal_id: string
          sort_order?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          percentage?: number | null
          proposal_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_milestones_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          assigned_pm_id: string | null
          client_email: string | null
          client_id: string | null
          client_ip_address: string | null
          client_name: string | null
          client_signature_data: string | null
          client_signed_at: string | null
          company_id: string
          converted_application_id: string | null
          converted_at: string | null
          created_at: string | null
          deposit_percentage: number | null
          deposit_required: number | null
          id: string
          internal_signature_data: string | null
          internal_signed_at: string | null
          internal_signed_by: string | null
          metadata: Json | null
          notes: string | null
          payment_terms: string | null
          property_id: string
          proposal_number: string | null
          scope_of_work: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          title: string
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          assigned_pm_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_ip_address?: string | null
          client_name?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          company_id: string
          converted_application_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          deposit_percentage?: number | null
          deposit_required?: number | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_terms?: string | null
          property_id: string
          proposal_number?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          assigned_pm_id?: string | null
          client_email?: string | null
          client_id?: string | null
          client_ip_address?: string | null
          client_name?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          company_id?: string
          converted_application_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          deposit_percentage?: number | null
          deposit_required?: number | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          metadata?: Json | null
          notes?: string | null
          payment_terms?: string | null
          property_id?: string
          proposal_number?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_assigned_pm_id_fkey"
            columns: ["assigned_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_converted_application_id_fkey"
            columns: ["converted_application_id"]
            isOneToOne: false
            referencedRelation: "dob_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_internal_signed_by_fkey"
            columns: ["internal_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          actual_hours: number | null
          application_id: string
          billing_milestones: Json | null
          billing_type: string | null
          company_id: string
          completed_date: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          fixed_price: number | null
          hourly_rate: number | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          qb_invoice_id: string | null
          status: Database["public"]["Enums"]["service_status"] | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          application_id: string
          billing_milestones?: Json | null
          billing_type?: string | null
          company_id: string
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hourly_rate?: number | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          qb_invoice_id?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          application_id?: string
          billing_milestones?: Json | null
          billing_type?: string | null
          company_id?: string
          completed_date?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          fixed_price?: number | null
          hourly_rate?: number | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          qb_invoice_id?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "dob_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_company: {
        Args: {
          company_name: string
          company_slug: string
          first_name: string
          last_name: string
        }
        Returns: string
      }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
          target_company_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_admin: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "time_log"
        | "note"
        | "call"
        | "email"
        | "meeting"
        | "site_visit"
        | "document"
      application_status:
        | "draft"
        | "filed"
        | "under_review"
        | "objection"
        | "approved"
        | "permit_issued"
        | "inspection"
        | "complete"
        | "closed"
      proposal_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed_internal"
        | "signed_client"
        | "accepted"
        | "rejected"
        | "expired"
      service_status:
        | "not_started"
        | "in_progress"
        | "complete"
        | "billed"
        | "paid"
      user_role: "admin" | "manager" | "pm" | "accounting"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "time_log",
        "note",
        "call",
        "email",
        "meeting",
        "site_visit",
        "document",
      ],
      application_status: [
        "draft",
        "filed",
        "under_review",
        "objection",
        "approved",
        "permit_issued",
        "inspection",
        "complete",
        "closed",
      ],
      proposal_status: [
        "draft",
        "sent",
        "viewed",
        "signed_internal",
        "signed_client",
        "accepted",
        "rejected",
        "expired",
      ],
      service_status: [
        "not_started",
        "in_progress",
        "complete",
        "billed",
        "paid",
      ],
      user_role: ["admin", "manager", "pm", "accounting"],
    },
  },
} as const
