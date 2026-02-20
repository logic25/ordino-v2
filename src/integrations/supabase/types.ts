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
      ach_authorizations: {
        Row: {
          account_number_last4: string | null
          account_type: string
          authorization_text: string
          bank_name: string | null
          client_id: string | null
          client_name: string
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          ip_address: string | null
          payment_method: string
          payment_plan_id: string
          routing_number_last4: string | null
          signature_data: string
          signed_at: string
          status: string
          updated_at: string
        }
        Insert: {
          account_number_last4?: string | null
          account_type?: string
          authorization_text: string
          bank_name?: string | null
          client_id?: string | null
          client_name: string
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          ip_address?: string | null
          payment_method?: string
          payment_plan_id: string
          routing_number_last4?: string | null
          signature_data: string
          signed_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_number_last4?: string | null
          account_type?: string
          authorization_text?: string
          bank_name?: string | null
          client_id?: string | null
          client_name?: string
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          ip_address?: string | null
          payment_method?: string
          payment_plan_id?: string
          routing_number_last4?: string | null
          signature_data?: string
          signed_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ach_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ach_authorizations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ach_authorizations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_roadmap_suggestions: {
        Row: {
          category: string | null
          challenges: string[] | null
          company_id: string | null
          created_at: string | null
          description: string | null
          duplicate_warning: string | null
          evidence: string | null
          id: string
          priority: string | null
          raw_idea: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string | null
          title: string
        }
        Insert: {
          category?: string | null
          challenges?: string[] | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_warning?: string | null
          evidence?: string | null
          id?: string
          priority?: string | null
          raw_idea?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string | null
          title: string
        }
        Update: {
          category?: string | null
          challenges?: string[] | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_warning?: string | null
          evidence?: string | null
          id?: string
          priority?: string | null
          raw_idea?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_roadmap_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          company_id: string | null
          completion_tokens: number | null
          created_at: string
          estimated_cost_usd: number | null
          feature: string
          id: string
          metadata: Json | null
          model: string
          prompt_tokens: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          feature: string
          id?: string
          metadata?: Json | null
          model?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          feature?: string
          id?: string
          metadata?: Json | null
          model?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          auto_closed: boolean
          clock_in: string
          clock_in_location: string | null
          clock_out: string | null
          company_id: string
          created_at: string
          id: string
          ip_address: string | null
          log_date: string
          notes: string | null
          total_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_closed?: boolean
          clock_in?: string
          clock_in_location?: string | null
          clock_out?: string | null
          company_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          log_date?: string
          notes?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_closed?: boolean
          clock_in?: string
          clock_in_location?: string | null
          clock_out?: string | null
          company_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          log_date?: string
          notes?: string | null
          total_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action_taken: string
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          company_id: string
          created_at: string
          escalated_to: string | null
          generated_message: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          result: string
          rule_id: string
          sent_at: string | null
        }
        Insert: {
          action_taken: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          escalated_to?: string | null
          generated_message?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          result?: string
          rule_id: string
          sent_at?: string | null
        }
        Update: {
          action_taken?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          escalated_to?: string | null
          generated_message?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          result?: string
          rule_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          conditions: Json
          cooldown_hours: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_enabled: boolean
          max_executions: number | null
          name: string
          priority: number
          rule_type: string
          trigger_type: string
          trigger_value: number
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          company_id: string
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          max_executions?: number | null
          name: string
          priority?: number
          rule_type?: string
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          conditions?: Json
          cooldown_hours?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          max_executions?: number | null
          name?: string
          priority?: number
          rule_type?: string
          trigger_type?: string
          trigger_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_requests: {
        Row: {
          billed_to_contact_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string | null
          project_id: string | null
          services: Json
          status: string
          total_amount: number
        }
        Insert: {
          billed_to_contact_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          services?: Json
          status?: string
          total_amount?: number
        }
        Update: {
          billed_to_contact_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          services?: Json
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_requests_billed_to_contact_id_fkey"
            columns: ["billed_to_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_rule_documents: {
        Row: {
          billing_rule_id: string
          company_id: string
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          notes: string | null
          revised_at: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          billing_rule_id: string
          company_id: string
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          revised_at?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          billing_rule_id?: string
          company_id?: string
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          revised_at?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_rule_documents_billing_rule_id_fkey"
            columns: ["billing_rule_id"]
            isOneToOne: false
            referencedRelation: "client_billing_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rule_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_rule_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          application_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          description: string | null
          end_time: string
          event_type: string | null
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          location: string | null
          metadata: Json | null
          project_id: string | null
          property_id: string | null
          recurrence_rule: string | null
          reminder_minutes: number[] | null
          reminder_sent_at: string | null
          source_email_id: string | null
          start_time: string
          status: string | null
          sync_status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          application_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          location?: string | null
          metadata?: Json | null
          project_id?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[] | null
          reminder_sent_at?: string | null
          source_email_id?: string | null
          start_time: string
          status?: string | null
          sync_status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          application_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string | null
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          location?: string | null
          metadata?: Json | null
          project_id?: string | null
          property_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[] | null
          reminder_sent_at?: string | null
          source_email_id?: string | null
          start_time?: string
          status?: string | null
          sync_status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "dob_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_forecasts: {
        Row: {
          company_id: string
          created_at: string
          expected_collections: number
          factors: Json | null
          forecast_date: string
          high_confidence: number
          id: string
          low_confidence: number
          medium_confidence: number
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_collections?: number
          factors?: Json | null
          forecast_date: string
          high_confidence?: number
          id?: string
          low_confidence?: number
          medium_confidence?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_collections?: number
          factors?: Json | null
          forecast_date?: string
          high_confidence?: number
          id?: string
          low_confidence?: number
          medium_confidence?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_forecasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          amount: number
          approved_at: string | null
          client_signature_data: string | null
          client_signed_at: string | null
          client_signer_name: string | null
          co_number: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          internal_signature_data: string | null
          internal_signed_at: string | null
          internal_signed_by: string | null
          linked_service_names: string[] | null
          notes: string | null
          project_id: string
          reason: string | null
          requested_by: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["co_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          client_signer_name?: string | null
          co_number?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          linked_service_names?: string[] | null
          notes?: string | null
          project_id: string
          reason?: string | null
          requested_by?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["co_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          client_signer_name?: string | null
          co_number?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          linked_service_names?: string[] | null
          notes?: string | null
          project_id?: string
          reason?: string | null
          requested_by?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["co_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_internal_signed_by_fkey"
            columns: ["internal_signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_followup_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          draft_body: string
          id: string
          items_snapshot: Json | null
          project_id: string
          prompt_system: string | null
          prompt_user: string | null
          status: string
          trigger_threshold_days: number | null
          triggered_by: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          draft_body: string
          id?: string
          items_snapshot?: Json | null
          project_id: string
          prompt_system?: string | null
          prompt_user?: string | null
          status?: string
          trigger_threshold_days?: number | null
          triggered_by?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          draft_body?: string
          id?: string
          items_snapshot?: Json | null
          project_id?: string
          prompt_system?: string | null
          prompt_user?: string | null
          status?: string
          trigger_threshold_days?: number | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_followup_drafts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_followup_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_followup_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      claimflow_referrals: {
        Row: {
          case_notes: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          package_generated_at: string | null
          package_storage_path: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_notes?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          package_generated_at?: string | null
          package_storage_path?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_notes?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          package_generated_at?: string | null
          package_storage_path?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claimflow_referrals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claimflow_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claimflow_referrals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claimflow_referrals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      client_billing_rules: {
        Row: {
          cc_markup: number | null
          client_id: string
          company_id: string
          created_at: string
          id: string
          portal_url: string | null
          property_id: string | null
          require_pay_app: boolean | null
          require_waiver: boolean | null
          special_instructions: string | null
          special_portal_required: boolean | null
          updated_at: string
          vendor_id: string | null
          wire_fee: number | null
        }
        Insert: {
          cc_markup?: number | null
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          portal_url?: string | null
          property_id?: string | null
          require_pay_app?: boolean | null
          require_waiver?: boolean | null
          special_instructions?: string | null
          special_portal_required?: boolean | null
          updated_at?: string
          vendor_id?: string | null
          wire_fee?: number | null
        }
        Update: {
          cc_markup?: number | null
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          portal_url?: string | null
          property_id?: string | null
          require_pay_app?: boolean | null
          require_waiver?: boolean | null
          special_instructions?: string | null
          special_portal_required?: boolean | null
          updated_at?: string
          vendor_id?: string | null
          wire_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_billing_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_billing_rules_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          address_1: string | null
          address_2: string | null
          city: string | null
          client_id: string
          company_id: string
          company_name: string | null
          created_at: string | null
          email: string | null
          fax: string | null
          first_name: string | null
          id: string
          is_primary: boolean
          last_name: string | null
          lead_owner_id: string | null
          linkedin_url: string | null
          mobile: string | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number | null
          state: string | null
          title: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          client_id: string
          company_id: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          lead_owner_id?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          city?: string | null
          client_id?: string
          company_id?: string
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          fax?: string | null
          first_name?: string | null
          id?: string
          is_primary?: boolean
          last_name?: string | null
          lead_owner_id?: string | null
          linkedin_url?: string | null
          mobile?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_lead_owner_id_fkey"
            columns: ["lead_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_analytics: {
        Row: {
          avg_days_to_payment: number | null
          best_contact_time: string | null
          client_id: string
          company_id: string
          id: string
          last_12mo_invoices: number | null
          last_12mo_late: number | null
          last_12mo_paid_on_time: number | null
          last_payment_date: string | null
          longest_days_late: number | null
          payment_reliability_score: number | null
          preferred_contact_method: string | null
          responds_to_reminders: boolean | null
          total_lifetime_value: number | null
          updated_at: string
        }
        Insert: {
          avg_days_to_payment?: number | null
          best_contact_time?: string | null
          client_id: string
          company_id: string
          id?: string
          last_12mo_invoices?: number | null
          last_12mo_late?: number | null
          last_12mo_paid_on_time?: number | null
          last_payment_date?: string | null
          longest_days_late?: number | null
          payment_reliability_score?: number | null
          preferred_contact_method?: string | null
          responds_to_reminders?: boolean | null
          total_lifetime_value?: number | null
          updated_at?: string
        }
        Update: {
          avg_days_to_payment?: number | null
          best_contact_time?: string | null
          client_id?: string
          company_id?: string
          id?: string
          last_12mo_invoices?: number | null
          last_12mo_late?: number | null
          last_12mo_paid_on_time?: number | null
          last_payment_date?: string | null
          longest_days_late?: number | null
          payment_reliability_score?: number | null
          preferred_contact_method?: string | null
          responds_to_reminders?: boolean | null
          total_lifetime_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_payment_analytics_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_payment_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_retainers: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          notes: string | null
          original_amount: number
          qbo_credit_memo_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          notes?: string | null
          original_amount?: number
          qbo_credit_memo_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          notes?: string | null
          original_amount?: number
          qbo_credit_memo_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_retainers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_retainers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_retainers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          client_type: string | null
          company_id: string
          created_at: string | null
          dob_tracking: string | null
          dob_tracking_expiration: string | null
          email: string | null
          fax: string | null
          hic_license: string | null
          ibm_number: string | null
          ibm_number_expiration: string | null
          id: string
          is_rfp_partner: boolean
          is_sia: boolean
          lead_owner_id: string | null
          metadata: Json | null
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_type?: string | null
          company_id: string
          created_at?: string | null
          dob_tracking?: string | null
          dob_tracking_expiration?: string | null
          email?: string | null
          fax?: string | null
          hic_license?: string | null
          ibm_number?: string | null
          ibm_number_expiration?: string | null
          id?: string
          is_rfp_partner?: boolean
          is_sia?: boolean
          lead_owner_id?: string | null
          metadata?: Json | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_type?: string | null
          company_id?: string
          created_at?: string | null
          dob_tracking?: string | null
          dob_tracking_expiration?: string | null
          email?: string | null
          fax?: string | null
          hic_license?: string | null
          ibm_number?: string | null
          ibm_number_expiration?: string | null
          id?: string
          is_rfp_partner?: boolean
          is_sia?: boolean
          lead_owner_id?: string | null
          metadata?: Json | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
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
          {
            foreignKeyName: "clients_lead_owner_id_fkey"
            columns: ["lead_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_tasks: {
        Row: {
          ai_recommended_action: string | null
          ai_suggested_message: string | null
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          invoice_id: string
          priority: number
          status: string
          task_type: string
        }
        Insert: {
          ai_recommended_action?: string | null
          ai_suggested_message?: string | null
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_id: string
          priority: number
          status?: string
          task_type: string
        }
        Update: {
          ai_recommended_action?: string | null
          ai_suggested_message?: string | null
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          invoice_id?: string
          priority?: number
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          created_at: string | null
          ein: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string | null
          theme: Json | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          ein?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          theme?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          ein?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          theme?: Json | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_reviews: {
        Row: {
          category_ratings: Json | null
          client_id: string
          comment: string | null
          company_id: string
          contact_id: string | null
          created_at: string | null
          id: string
          project_id: string | null
          rating: number
          reviewer_id: string
          updated_at: string | null
        }
        Insert: {
          category_ratings?: Json | null
          client_id: string
          comment?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          rating: number
          reviewer_id: string
          updated_at?: string | null
        }
        Update: {
          category_ratings?: Json | null
          client_id?: string
          comment?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          rating?: number
          reviewer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_rfps: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          discovered_at: string
          due_date: string | null
          estimated_value: number | null
          id: string
          issuing_agency: string | null
          notes: string | null
          original_url: string | null
          pdf_url: string | null
          recommended_company_ids: string[] | null
          relevance_reason: string | null
          relevance_score: number | null
          rfp_id: string | null
          rfp_number: string | null
          service_tags: string[] | null
          source_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          discovered_at?: string
          due_date?: string | null
          estimated_value?: number | null
          id?: string
          issuing_agency?: string | null
          notes?: string | null
          original_url?: string | null
          pdf_url?: string | null
          recommended_company_ids?: string[] | null
          relevance_reason?: string | null
          relevance_score?: number | null
          rfp_id?: string | null
          rfp_number?: string | null
          service_tags?: string[] | null
          source_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          discovered_at?: string
          due_date?: string | null
          estimated_value?: number | null
          id?: string
          issuing_agency?: string | null
          notes?: string | null
          original_url?: string | null
          pdf_url?: string | null
          recommended_company_ids?: string[] | null
          relevance_reason?: string | null
          relevance_score?: number | null
          rfp_id?: string | null
          rfp_number?: string | null
          service_tags?: string[] | null
          source_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_rfps_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_rfps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_rfps_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_rfps_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "rfp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          attachments: Json | null
          company_id: string
          created_at: string
          dispute_id: string
          id: string
          message: string
          sender_name: string | null
          sender_type: string
        }
        Insert: {
          attachments?: Json | null
          company_id: string
          created_at?: string
          dispute_id: string
          id?: string
          message: string
          sender_name?: string | null
          sender_type: string
        }
        Update: {
          attachments?: Json | null
          company_id?: string
          created_at?: string
          dispute_id?: string
          id?: string
          message?: string
          sender_name?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "invoice_disputes"
            referencedColumns: ["id"]
          },
        ]
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
          notable: boolean | null
          notes: string | null
          permit_issued_date: string | null
          project_id: string | null
          property_id: string
          reference_contact_email: string | null
          reference_contact_name: string | null
          reference_contact_phone: string | null
          reference_contact_title: string | null
          reference_last_verified: string | null
          reference_notes: string | null
          rfp_tags: string[] | null
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
          notable?: boolean | null
          notes?: string | null
          permit_issued_date?: string | null
          project_id?: string | null
          property_id: string
          reference_contact_email?: string | null
          reference_contact_name?: string | null
          reference_contact_phone?: string | null
          reference_contact_title?: string | null
          reference_last_verified?: string | null
          reference_notes?: string | null
          rfp_tags?: string[] | null
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
          notable?: boolean | null
          notes?: string | null
          permit_issued_date?: string | null
          project_id?: string | null
          property_id?: string
          reference_contact_email?: string | null
          reference_contact_name?: string | null
          reference_contact_phone?: string | null
          reference_contact_title?: string | null
          reference_last_verified?: string | null
          reference_notes?: string | null
          rfp_tags?: string[] | null
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
            foreignKeyName: "dob_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      email_attachments: {
        Row: {
          company_id: string
          created_at: string
          email_id: string
          filename: string
          gmail_attachment_id: string | null
          id: string
          mime_type: string | null
          saved_to_project: boolean
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email_id: string
          filename: string
          gmail_attachment_id?: string | null
          id?: string
          mime_type?: string | null
          saved_to_project?: boolean
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email_id?: string
          filename?: string
          gmail_attachment_id?: string | null
          id?: string
          mime_type?: string | null
          saved_to_project?: boolean
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          bcc_recipients: string[] | null
          body_html: string | null
          cc_recipients: string[] | null
          company_id: string
          created_at: string
          draft_type: string
          forward_from_email_id: string | null
          id: string
          reply_to_email_id: string | null
          subject: string | null
          to_recipients: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bcc_recipients?: string[] | null
          body_html?: string | null
          cc_recipients?: string[] | null
          company_id: string
          created_at?: string
          draft_type?: string
          forward_from_email_id?: string | null
          id?: string
          reply_to_email_id?: string | null
          subject?: string | null
          to_recipients?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bcc_recipients?: string[] | null
          body_html?: string | null
          cc_recipients?: string[] | null
          company_id?: string
          created_at?: string
          draft_type?: string
          forward_from_email_id?: string | null
          id?: string
          reply_to_email_id?: string | null
          subject?: string | null
          to_recipients?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_forward_from_email_id_fkey"
            columns: ["forward_from_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_reply_to_email_id_fkey"
            columns: ["reply_to_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notes: {
        Row: {
          company_id: string
          created_at: string
          email_id: string
          id: string
          note_text: string
          user_id: string
          user_name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email_id: string
          id?: string
          note_text: string
          user_id: string
          user_name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email_id?: string
          id?: string
          note_text?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notes_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_project_tags: {
        Row: {
          category: string
          company_id: string
          email_id: string
          id: string
          notes: string | null
          project_id: string
          tagged_at: string
          tagged_by_id: string
        }
        Insert: {
          category?: string
          company_id: string
          email_id: string
          id?: string
          notes?: string | null
          project_id: string
          tagged_at?: string
          tagged_by_id: string
        }
        Update: {
          category?: string
          company_id?: string
          email_id?: string
          id?: string
          notes?: string | null
          project_id?: string
          tagged_at?: string
          tagged_by_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_project_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_project_tags_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_project_tags_tagged_by_id_fkey"
            columns: ["tagged_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reminders: {
        Row: {
          cancelled_at: string | null
          company_id: string
          condition: string
          created_at: string
          email_id: string
          id: string
          remind_at: string
          reminded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          condition?: string
          created_at?: string
          email_id: string
          id?: string
          remind_at: string
          reminded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          condition?: string
          created_at?: string
          email_id?: string
          id?: string
          remind_at?: string
          reminded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_reminders_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          archived_at: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          body_html: string | null
          body_text: string | null
          company_id: string
          created_at: string
          date: string | null
          from_email: string | null
          from_name: string | null
          gmail_message_id: string
          has_attachments: boolean
          id: string
          is_read: boolean
          labels: Json | null
          replied_at: string | null
          snippet: string | null
          snoozed_until: string | null
          subject: string | null
          synced_at: string
          tags: string[] | null
          thread_id: string | null
          to_emails: Json | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          company_id: string
          created_at?: string
          date?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_message_id: string
          has_attachments?: boolean
          id?: string
          is_read?: boolean
          labels?: Json | null
          replied_at?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          subject?: string | null
          synced_at?: string
          tags?: string[] | null
          thread_id?: string | null
          to_emails?: Json | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          body_html?: string | null
          body_text?: string | null
          company_id?: string
          created_at?: string
          date?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string
          has_attachments?: boolean
          id?: string
          is_read?: boolean
          labels?: Json | null
          replied_at?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          subject?: string | null
          synced_at?: string
          tags?: string[] | null
          thread_id?: string | null
          to_emails?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_reviews: {
        Row: {
          category_ratings: Json | null
          comments: string | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          overall_rating: number | null
          previous_rating: number | null
          raise_pct: number | null
          review_period: string
          reviewer_id: string
          updated_at: string | null
        }
        Insert: {
          category_ratings?: Json | null
          comments?: string | null
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          overall_rating?: number | null
          previous_rating?: number | null
          raise_pct?: number | null
          review_period: string
          reviewer_id: string
          updated_at?: string | null
        }
        Update: {
          category_ratings?: Json | null
          comments?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          overall_rating?: number | null
          previous_rating?: number | null
          raise_pct?: number | null
          review_period?: string
          reviewer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_requests: {
        Row: {
          category: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          upvotes: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          upvotes?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          upvotes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_connections: {
        Row: {
          access_token: string | null
          company_id: string
          created_at: string
          email_address: string
          history_id: string | null
          id: string
          last_sync_at: string | null
          refresh_token: string | null
          sync_enabled: boolean
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          company_id: string
          created_at?: string
          email_address: string
          history_id?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          company_id?: string
          created_at?: string
          email_address?: string
          history_id?: string | null
          id?: string
          last_sync_at?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_activity_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: string | null
          id: string
          invoice_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: string | null
          id?: string
          invoice_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: string | null
          id?: string
          invoice_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_activity_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_disputes: {
        Row: {
          amount_disputed: number | null
          assigned_to: string | null
          client_evidence: Json | null
          client_id: string | null
          company_id: string
          created_at: string
          description: string
          dispute_type: string
          id: string
          internal_notes: string | null
          invoice_id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          amount_disputed?: number | null
          assigned_to?: string | null
          client_evidence?: Json | null
          client_id?: string | null
          company_id: string
          created_at?: string
          description: string
          dispute_type: string
          id?: string
          internal_notes?: string | null
          invoice_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          amount_disputed?: number | null
          assigned_to?: string | null
          client_evidence?: Json | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          description?: string
          dispute_type?: string
          id?: string
          internal_notes?: string | null
          invoice_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_disputes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_disputes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_disputes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_follow_ups: {
        Row: {
          company_id: string
          contact_method: string | null
          contacted_by: string | null
          created_at: string
          follow_up_date: string
          id: string
          invoice_id: string
          notes: string | null
        }
        Insert: {
          company_id: string
          contact_method?: string | null
          contacted_by?: string | null
          created_at?: string
          follow_up_date: string
          id?: string
          invoice_id: string
          notes?: string | null
        }
        Update: {
          company_id?: string
          contact_method?: string | null
          contacted_by?: string | null
          created_at?: string
          follow_up_date?: string
          id?: string
          invoice_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_follow_ups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_follow_ups_contacted_by_fkey"
            columns: ["contacted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_follow_ups_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billed_to_contact_id: string | null
          billing_request_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          fees: Json | null
          gmail_message_id: string | null
          id: string
          invoice_number: string
          line_items: Json
          paid_at: string | null
          parent_invoice_id: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_terms: string | null
          project_id: string | null
          qbo_invoice_id: string | null
          qbo_payment_status: string | null
          qbo_synced_at: string | null
          retainer_applied: number | null
          retainer_id: string | null
          review_reason: string | null
          sent_at: string | null
          special_instructions: string | null
          status: string
          subtotal: number
          total_due: number
          updated_at: string
          write_off_amount: number | null
        }
        Insert: {
          billed_to_contact_id?: string | null
          billing_request_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          fees?: Json | null
          gmail_message_id?: string | null
          id?: string
          invoice_number: string
          line_items?: Json
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          project_id?: string | null
          qbo_invoice_id?: string | null
          qbo_payment_status?: string | null
          qbo_synced_at?: string | null
          retainer_applied?: number | null
          retainer_id?: string | null
          review_reason?: string | null
          sent_at?: string | null
          special_instructions?: string | null
          status?: string
          subtotal?: number
          total_due?: number
          updated_at?: string
          write_off_amount?: number | null
        }
        Update: {
          billed_to_contact_id?: string | null
          billing_request_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          fees?: Json | null
          gmail_message_id?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json
          paid_at?: string | null
          parent_invoice_id?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_terms?: string | null
          project_id?: string | null
          qbo_invoice_id?: string | null
          qbo_payment_status?: string | null
          qbo_synced_at?: string | null
          retainer_applied?: number | null
          retainer_id?: string | null
          review_reason?: string | null
          sent_at?: string | null
          special_instructions?: string | null
          status?: string
          subtotal?: number
          total_due?: number
          updated_at?: string
          write_off_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_billed_to_contact_id_fkey"
            columns: ["billed_to_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_billing_request_id_fkey"
            columns: ["billing_request_id"]
            isOneToOne: false
            referencedRelation: "billing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_retainer_id_fkey"
            columns: ["retainer_id"]
            isOneToOne: false
            referencedRelation: "client_retainers"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          parent_note_id: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          parent_note_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          parent_note_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_parent_note_id_fkey"
            columns: ["parent_note_id"]
            isOneToOne: false
            referencedRelation: "lead_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_system: boolean
          label: string
          sort_order: number
          value: string
          variant: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          label: string
          sort_order?: number
          value: string
          variant?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          label?: string
          sort_order?: number
          value?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          architect_company: string | null
          architect_email: string | null
          architect_license_number: string | null
          architect_license_type: string | null
          architect_name: string | null
          architect_phone: string | null
          assigned_to: string | null
          client_type: string | null
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          drawings_uploaded: boolean | null
          full_name: string
          gc_company: string | null
          gc_email: string | null
          gc_name: string | null
          gc_phone: string | null
          id: string
          notes: string | null
          property_address: string | null
          proposal_id: string | null
          referred_by: string | null
          sia_company: string | null
          sia_email: string | null
          sia_name: string | null
          sia_phone: string | null
          source: string
          status: string
          subject: string | null
          tpp_email: string | null
          tpp_name: string | null
          updated_at: string
        }
        Insert: {
          architect_company?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          assigned_to?: string | null
          client_type?: string | null
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          drawings_uploaded?: boolean | null
          full_name: string
          gc_company?: string | null
          gc_email?: string | null
          gc_name?: string | null
          gc_phone?: string | null
          id?: string
          notes?: string | null
          property_address?: string | null
          proposal_id?: string | null
          referred_by?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_phone?: string | null
          source?: string
          status?: string
          subject?: string | null
          tpp_email?: string | null
          tpp_name?: string | null
          updated_at?: string
        }
        Update: {
          architect_company?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          assigned_to?: string | null
          client_type?: string | null
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          drawings_uploaded?: boolean | null
          full_name?: string
          gc_company?: string | null
          gc_email?: string | null
          gc_name?: string | null
          gc_phone?: string | null
          id?: string
          notes?: string | null
          property_address?: string | null
          proposal_id?: string | null
          referred_by?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_phone?: string | null
          source?: string
          status?: string
          subject?: string | null
          tpp_email?: string | null
          tpp_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          company_id: string
          created_at: string
          dismissed_at: string | null
          id: string
          link: string | null
          project_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          company_id: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          company_id?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          link?: string | null
          project_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_email_templates: {
        Row: {
          body_template: string
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          subject_template: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          subject_template?: string
          template_key?: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          subject_template?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plan_installments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          plan_id: string
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          plan_id: string
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plan_installments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plan_installments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          down_payment: number | null
          id: string
          interest_rate: number | null
          invoice_id: string
          notes: string | null
          num_installments: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          down_payment?: number | null
          id?: string
          interest_rate?: number | null
          invoice_id: string
          notes?: string | null
          num_installments?: number
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          down_payment?: number | null
          id?: string
          interest_rate?: number | null
          invoice_id?: string
          notes?: string | null
          num_installments?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_predictions: {
        Row: {
          client_id: string | null
          company_id: string
          confidence_level: string | null
          created_at: string
          factors: Json | null
          id: string
          invoice_id: string
          model_version: string | null
          predicted_days_late: number | null
          predicted_payment_date: string | null
          risk_score: number
        }
        Insert: {
          client_id?: string | null
          company_id: string
          confidence_level?: string | null
          created_at?: string
          factors?: Json | null
          id?: string
          invoice_id: string
          model_version?: string | null
          predicted_days_late?: number | null
          predicted_payment_date?: string | null
          risk_score: number
        }
        Update: {
          client_id?: string | null
          company_id?: string
          confidence_level?: string | null
          created_at?: string
          factors?: Json | null
          id?: string
          invoice_id?: string
          model_version?: string | null
          predicted_days_late?: number | null
          predicted_payment_date?: string | null
          risk_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_predictions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_predictions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_predictions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_promises: {
        Row: {
          actual_amount: number | null
          actual_payment_date: string | null
          captured_by: string | null
          client_id: string | null
          company_id: string
          created_at: string
          follow_up_id: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_method: string | null
          promised_amount: number
          promised_date: string
          reminder_sent_at: string | null
          source: string
          status: string
        }
        Insert: {
          actual_amount?: number | null
          actual_payment_date?: string | null
          captured_by?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          follow_up_id?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_method?: string | null
          promised_amount: number
          promised_date: string
          reminder_sent_at?: string | null
          source: string
          status?: string
        }
        Update: {
          actual_amount?: number | null
          actual_payment_date?: string | null
          captured_by?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          follow_up_id?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_method?: string | null
          promised_amount?: number
          promised_date?: string
          reminder_sent_at?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_promises_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_follow_up_id_fkey"
            columns: ["follow_up_id"]
            isOneToOne: false
            referencedRelation: "invoice_follow_ups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_promises_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      pis_tracking: {
        Row: {
          company_id: string
          created_at: string
          field_id: string
          field_label: string
          first_requested_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          id: string
          last_reminded_at: string | null
          project_id: string
          reminder_count: number
          rfi_request_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          field_id: string
          field_label: string
          first_requested_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          last_reminded_at?: string | null
          project_id: string
          reminder_count?: number
          rfi_request_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          field_id?: string
          field_label?: string
          first_requested_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          id?: string
          last_reminded_at?: string | null
          project_id?: string
          reminder_count?: number
          rfi_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pis_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pis_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pis_tracking_rfi_request_id_fkey"
            columns: ["rfi_request_id"]
            isOneToOne: false
            referencedRelation: "rfi_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          carrier: string | null
          company_id: string
          created_at: string | null
          display_name: string | null
          first_name: string | null
          hourly_rate: number | null
          id: string
          is_active: boolean | null
          job_title: string | null
          last_name: string | null
          monthly_goal: number | null
          notification_preferences: Json | null
          onboarding_completed: boolean
          phone: string | null
          phone_extension: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          signature_data: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          carrier?: string | null
          company_id: string
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string | null
          monthly_goal?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean
          phone?: string | null
          phone_extension?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          signature_data?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          carrier?: string | null
          company_id?: string
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          last_name?: string | null
          monthly_goal?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean
          phone?: string | null
          phone_extension?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          signature_data?: string | null
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
      project_checklist_items: {
        Row: {
          category: string
          company_id: string
          completed_at: string | null
          created_at: string
          from_whom: string | null
          id: string
          label: string
          project_id: string
          requested_date: string | null
          sort_order: number
          source_catalog_name: string | null
          source_service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          from_whom?: string | null
          id?: string
          label: string
          project_id: string
          requested_date?: string | null
          sort_order?: number
          source_catalog_name?: string | null
          source_service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          from_whom?: string | null
          id?: string
          label?: string
          project_id?: string
          requested_date?: string | null
          sort_order?: number
          source_catalog_name?: string | null
          source_service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_checklist_items_source_service_id_fkey"
            columns: ["source_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_construction_completion: string | null
          actual_construction_start: string | null
          architect_company_name: string | null
          architect_contact_name: string | null
          architect_email: string | null
          architect_license_number: string | null
          architect_license_type: string | null
          architect_phone: string | null
          assigned_pm_id: string | null
          building_owner_id: string | null
          building_owner_name: string | null
          client_id: string | null
          client_reference_number: string | null
          company_id: string
          completion_date: string | null
          created_at: string | null
          created_by: string | null
          estimated_construction_completion: string | null
          expected_construction_start: string | null
          filing_type: string | null
          floor_number: string | null
          gc_company_name: string | null
          gc_contact_name: string | null
          gc_email: string | null
          gc_phone: string | null
          id: string
          is_external: boolean
          last_editor_id: string | null
          metadata: Json | null
          name: string | null
          notable: boolean
          notes: string | null
          phase: string
          project_complexity_tier: string | null
          project_number: string | null
          project_type: string | null
          property_id: string
          proposal_id: string | null
          qbo_customer_id: string | null
          retainer_amount: number | null
          retainer_balance: number | null
          retainer_received_date: string | null
          senior_pm_id: string | null
          sia_company: string | null
          sia_email: string | null
          sia_name: string | null
          sia_number: string | null
          sia_nys_lic: string | null
          sia_phone: string | null
          status: Database["public"]["Enums"]["project_status"]
          tenant_name: string | null
          tpp_email: string | null
          tpp_name: string | null
          unit_number: string | null
          updated_at: string | null
        }
        Insert: {
          actual_construction_completion?: string | null
          actual_construction_start?: string | null
          architect_company_name?: string | null
          architect_contact_name?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_phone?: string | null
          assigned_pm_id?: string | null
          building_owner_id?: string | null
          building_owner_name?: string | null
          client_id?: string | null
          client_reference_number?: string | null
          company_id: string
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_construction_completion?: string | null
          expected_construction_start?: string | null
          filing_type?: string | null
          floor_number?: string | null
          gc_company_name?: string | null
          gc_contact_name?: string | null
          gc_email?: string | null
          gc_phone?: string | null
          id?: string
          is_external?: boolean
          last_editor_id?: string | null
          metadata?: Json | null
          name?: string | null
          notable?: boolean
          notes?: string | null
          phase?: string
          project_complexity_tier?: string | null
          project_number?: string | null
          project_type?: string | null
          property_id: string
          proposal_id?: string | null
          qbo_customer_id?: string | null
          retainer_amount?: number | null
          retainer_balance?: number | null
          retainer_received_date?: string | null
          senior_pm_id?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_number?: string | null
          sia_nys_lic?: string | null
          sia_phone?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tenant_name?: string | null
          tpp_email?: string | null
          tpp_name?: string | null
          unit_number?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_construction_completion?: string | null
          actual_construction_start?: string | null
          architect_company_name?: string | null
          architect_contact_name?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_phone?: string | null
          assigned_pm_id?: string | null
          building_owner_id?: string | null
          building_owner_name?: string | null
          client_id?: string | null
          client_reference_number?: string | null
          company_id?: string
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          estimated_construction_completion?: string | null
          expected_construction_start?: string | null
          filing_type?: string | null
          floor_number?: string | null
          gc_company_name?: string | null
          gc_contact_name?: string | null
          gc_email?: string | null
          gc_phone?: string | null
          id?: string
          is_external?: boolean
          last_editor_id?: string | null
          metadata?: Json | null
          name?: string | null
          notable?: boolean
          notes?: string | null
          phase?: string
          project_complexity_tier?: string | null
          project_number?: string | null
          project_type?: string | null
          property_id?: string
          proposal_id?: string | null
          qbo_customer_id?: string | null
          retainer_amount?: number | null
          retainer_balance?: number | null
          retainer_received_date?: string | null
          senior_pm_id?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_number?: string | null
          sia_nys_lic?: string | null
          sia_phone?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          tenant_name?: string | null
          tpp_email?: string | null
          tpp_name?: string | null
          unit_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_pm_id_fkey"
            columns: ["assigned_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_building_owner_id_fkey"
            columns: ["building_owner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_last_editor_id_fkey"
            columns: ["last_editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_senior_pm_id_fkey"
            columns: ["senior_pm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      proposal_contacts: {
        Row: {
          client_id: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          proposal_id: string
          role: string
          sort_order: number | null
        }
        Insert: {
          client_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          proposal_id: string
          role?: string
          sort_order?: number | null
        }
        Update: {
          client_id?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          proposal_id?: string
          role?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_contacts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_follow_ups: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string | null
          proposal_id: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          proposal_id: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_follow_ups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_follow_ups_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_follow_ups_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string | null
          description: string | null
          discipline_fee: number | null
          disciplines: string[] | null
          discount_amount: number | null
          discount_percent: number | null
          estimated_hours: number | null
          fee_type: string
          id: string
          is_optional: boolean | null
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
          discipline_fee?: number | null
          disciplines?: string[] | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_hours?: number | null
          fee_type?: string
          id?: string
          is_optional?: boolean | null
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
          discipline_fee?: number | null
          disciplines?: string[] | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_hours?: number | null
          fee_type?: string
          id?: string
          is_optional?: boolean | null
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
          approval_method: string | null
          architect_company: string | null
          architect_email: string | null
          architect_license_number: string | null
          architect_license_type: string | null
          architect_name: string | null
          architect_phone: string | null
          assigned_pm_id: string | null
          billed_to_email: string | null
          billed_to_name: string | null
          client_email: string | null
          client_id: string | null
          client_ip_address: string | null
          client_name: string | null
          client_signature_data: string | null
          client_signed_at: string | null
          client_signed_name: string | null
          client_signed_title: string | null
          company_id: string
          converted_application_id: string | null
          converted_at: string | null
          converted_project_id: string | null
          created_at: string | null
          created_by: string | null
          deposit_percentage: number | null
          deposit_required: number | null
          drawings_storage_paths: string[] | null
          follow_up_count: number | null
          follow_up_dismissed_at: string | null
          follow_up_dismissed_by: string | null
          follow_up_interval_days: number | null
          gc_company: string | null
          gc_email: string | null
          gc_name: string | null
          gc_phone: string | null
          id: string
          internal_signature_data: string | null
          internal_signed_at: string | null
          internal_signed_by: string | null
          job_description: string | null
          last_follow_up_at: string | null
          lead_source: string | null
          metadata: Json | null
          next_follow_up_date: string | null
          notes: string | null
          payment_terms: string | null
          project_type: string | null
          property_id: string | null
          proposal_number: string | null
          public_token: string | null
          referred_by: string | null
          reminder_date: string | null
          retainer_amount: number | null
          sales_person_id: string | null
          scope_of_work: string | null
          sent_at: string | null
          sia_company: string | null
          sia_email: string | null
          sia_name: string | null
          sia_phone: string | null
          signed_document_url: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms_conditions: string | null
          title: string
          total_amount: number | null
          tpp_email: string | null
          tpp_name: string | null
          unit_number: string | null
          updated_at: string | null
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          approval_method?: string | null
          architect_company?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          assigned_pm_id?: string | null
          billed_to_email?: string | null
          billed_to_name?: string | null
          client_email?: string | null
          client_id?: string | null
          client_ip_address?: string | null
          client_name?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          client_signed_name?: string | null
          client_signed_title?: string | null
          company_id: string
          converted_application_id?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deposit_percentage?: number | null
          deposit_required?: number | null
          drawings_storage_paths?: string[] | null
          follow_up_count?: number | null
          follow_up_dismissed_at?: string | null
          follow_up_dismissed_by?: string | null
          follow_up_interval_days?: number | null
          gc_company?: string | null
          gc_email?: string | null
          gc_name?: string | null
          gc_phone?: string | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          job_description?: string | null
          last_follow_up_at?: string | null
          lead_source?: string | null
          metadata?: Json | null
          next_follow_up_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          project_type?: string | null
          property_id?: string | null
          proposal_number?: string | null
          public_token?: string | null
          referred_by?: string | null
          reminder_date?: string | null
          retainer_amount?: number | null
          sales_person_id?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_phone?: string | null
          signed_document_url?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title: string
          total_amount?: number | null
          tpp_email?: string | null
          tpp_name?: string | null
          unit_number?: string | null
          updated_at?: string | null
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          approval_method?: string | null
          architect_company?: string | null
          architect_email?: string | null
          architect_license_number?: string | null
          architect_license_type?: string | null
          architect_name?: string | null
          architect_phone?: string | null
          assigned_pm_id?: string | null
          billed_to_email?: string | null
          billed_to_name?: string | null
          client_email?: string | null
          client_id?: string | null
          client_ip_address?: string | null
          client_name?: string | null
          client_signature_data?: string | null
          client_signed_at?: string | null
          client_signed_name?: string | null
          client_signed_title?: string | null
          company_id?: string
          converted_application_id?: string | null
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deposit_percentage?: number | null
          deposit_required?: number | null
          drawings_storage_paths?: string[] | null
          follow_up_count?: number | null
          follow_up_dismissed_at?: string | null
          follow_up_dismissed_by?: string | null
          follow_up_interval_days?: number | null
          gc_company?: string | null
          gc_email?: string | null
          gc_name?: string | null
          gc_phone?: string | null
          id?: string
          internal_signature_data?: string | null
          internal_signed_at?: string | null
          internal_signed_by?: string | null
          job_description?: string | null
          last_follow_up_at?: string | null
          lead_source?: string | null
          metadata?: Json | null
          next_follow_up_date?: string | null
          notes?: string | null
          payment_terms?: string | null
          project_type?: string | null
          property_id?: string | null
          proposal_number?: string | null
          public_token?: string | null
          referred_by?: string | null
          reminder_date?: string | null
          retainer_amount?: number | null
          sales_person_id?: string | null
          scope_of_work?: string | null
          sent_at?: string | null
          sia_company?: string | null
          sia_email?: string | null
          sia_name?: string | null
          sia_phone?: string | null
          signed_document_url?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms_conditions?: string | null
          title?: string
          total_amount?: number | null
          tpp_email?: string | null
          tpp_name?: string | null
          unit_number?: string | null
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
            foreignKeyName: "proposals_converted_project_id_fkey"
            columns: ["converted_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_follow_up_dismissed_by_fkey"
            columns: ["follow_up_dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "proposals_sales_person_id_fkey"
            columns: ["sales_person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_connections: {
        Row: {
          access_token: string | null
          company_id: string
          company_name: string | null
          connected_at: string | null
          expires_at: string | null
          id: string
          last_sync_at: string | null
          realm_id: string | null
          refresh_token: string | null
        }
        Insert: {
          access_token?: string | null
          company_id: string
          company_name?: string | null
          connected_at?: string | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          realm_id?: string | null
          refresh_token?: string | null
        }
        Update: {
          access_token?: string | null
          company_id?: string
          company_name?: string | null
          connected_at?: string | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          realm_id?: string | null
          refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qbo_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      retainer_transactions: {
        Row: {
          amount: number
          balance_after: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          invoice_id: string | null
          performed_by: string | null
          retainer_id: string
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          performed_by?: string | null
          retainer_id: string
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          performed_by?: string | null
          retainer_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "retainer_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainer_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainer_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retainer_transactions_retainer_id_fkey"
            columns: ["retainer_id"]
            isOneToOne: false
            referencedRelation: "client_retainers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfi_requests: {
        Row: {
          access_token: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          project_id: string | null
          property_id: string | null
          proposal_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          responses: Json | null
          sections: Json
          sent_at: string | null
          status: string
          submitted_at: string | null
          template_id: string | null
          title: string
          updated_at: string | null
          viewed_at: string | null
        }
        Insert: {
          access_token?: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id?: string | null
          property_id?: string | null
          proposal_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          responses?: Json | null
          sections?: Json
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id?: string | null
          property_id?: string | null
          proposal_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          responses?: Json | null
          sections?: Json
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfi_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_requests_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfi_requests_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "rfi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rfi_templates: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          sections: Json
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sections?: Json
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sections?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfi_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_content: {
        Row: {
          company_id: string
          content: Json
          content_type: string
          created_at: string
          file_url: string | null
          id: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: Json
          content_type: string
          created_at?: string
          file_url?: string | null
          id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: Json
          content_type?: string
          created_at?: string
          file_url?: string | null
          id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_content_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_monitoring_rules: {
        Row: {
          active: boolean
          agencies_include: string[] | null
          company_id: string
          created_at: string
          email_recipients: string[] | null
          id: string
          keyword_exclude: string[] | null
          keyword_include: string[] | null
          min_relevance_score: number
          notify_email: boolean
        }
        Insert: {
          active?: boolean
          agencies_include?: string[] | null
          company_id: string
          created_at?: string
          email_recipients?: string[] | null
          id?: string
          keyword_exclude?: string[] | null
          keyword_include?: string[] | null
          min_relevance_score?: number
          notify_email?: boolean
        }
        Update: {
          active?: boolean
          agencies_include?: string[] | null
          company_id?: string
          created_at?: string
          email_recipients?: string[] | null
          id?: string
          keyword_exclude?: string[] | null
          keyword_include?: string[] | null
          min_relevance_score?: number
          notify_email?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rfp_monitoring_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_partner_outreach: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          discovered_rfp_id: string
          id: string
          notes: string | null
          notified_at: string
          partner_client_id: string
          responded_at: string | null
          response_status: string
          response_token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          discovered_rfp_id: string
          id?: string
          notes?: string | null
          notified_at?: string
          partner_client_id: string
          responded_at?: string | null
          response_status?: string
          response_token?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          discovered_rfp_id?: string
          id?: string
          notes?: string | null
          notified_at?: string
          partner_client_id?: string
          responded_at?: string | null
          response_status?: string
          response_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_partner_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_partner_outreach_discovered_rfp_id_fkey"
            columns: ["discovered_rfp_id"]
            isOneToOne: false
            referencedRelation: "discovered_rfps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_partner_outreach_partner_client_id_fkey"
            columns: ["partner_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_response_drafts: {
        Row: {
          company_id: string
          cover_letter: string | null
          created_at: string
          created_by: string | null
          id: string
          rfp_id: string
          section_order: string[]
          selected_sections: string[]
          submit_email: string | null
          updated_at: string
          wizard_step: number
        }
        Insert: {
          company_id: string
          cover_letter?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          rfp_id: string
          section_order?: string[]
          selected_sections?: string[]
          submit_email?: string | null
          updated_at?: string
          wizard_step?: number
        }
        Update: {
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          rfp_id?: string
          section_order?: string[]
          selected_sections?: string[]
          submit_email?: string | null
          updated_at?: string
          wizard_step?: number
        }
        Relationships: [
          {
            foreignKeyName: "rfp_response_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_response_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfp_response_drafts_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_sections: {
        Row: {
          ai_generated: boolean | null
          content: Json
          created_at: string
          display_order: number
          id: string
          reviewed: boolean | null
          rfp_id: string
          section_type: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          content?: Json
          created_at?: string
          display_order?: number
          id?: string
          reviewed?: boolean | null
          rfp_id: string
          section_type: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          content?: Json
          created_at?: string
          display_order?: number
          id?: string
          reviewed?: boolean | null
          rfp_id?: string
          section_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_sections_rfp_id_fkey"
            columns: ["rfp_id"]
            isOneToOne: false
            referencedRelation: "rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      rfp_sources: {
        Row: {
          active: boolean
          check_frequency: string
          company_id: string
          created_at: string
          id: string
          last_checked_at: string | null
          source_name: string
          source_type: string
          source_url: string
        }
        Insert: {
          active?: boolean
          check_frequency?: string
          company_id: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          source_name: string
          source_type?: string
          source_url: string
        }
        Update: {
          active?: boolean
          check_frequency?: string
          company_id?: string
          created_at?: string
          id?: string
          last_checked_at?: string | null
          source_name?: string
          source_type?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfp_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      rfps: {
        Row: {
          agency: string | null
          company_id: string
          contract_value: number | null
          created_at: string
          created_by: string | null
          debrief_notes: string | null
          discovered_from_id: string | null
          due_date: string | null
          id: string
          insurance_requirements: Json | null
          lessons_learned: Json | null
          mwbe_goal_max: number | null
          mwbe_goal_min: number | null
          notes: string | null
          outcome: string | null
          requirements: Json | null
          response_draft_url: string | null
          rfp_number: string | null
          status: string
          submission_method: string | null
          submitted_at: string | null
          title: string
          updated_at: string
          uploaded_pdf_url: string | null
        }
        Insert: {
          agency?: string | null
          company_id: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          debrief_notes?: string | null
          discovered_from_id?: string | null
          due_date?: string | null
          id?: string
          insurance_requirements?: Json | null
          lessons_learned?: Json | null
          mwbe_goal_max?: number | null
          mwbe_goal_min?: number | null
          notes?: string | null
          outcome?: string | null
          requirements?: Json | null
          response_draft_url?: string | null
          rfp_number?: string | null
          status?: string
          submission_method?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
          uploaded_pdf_url?: string | null
        }
        Update: {
          agency?: string | null
          company_id?: string
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          debrief_notes?: string | null
          discovered_from_id?: string | null
          due_date?: string | null
          id?: string
          insurance_requirements?: Json | null
          lessons_learned?: Json | null
          mwbe_goal_max?: number | null
          mwbe_goal_min?: number | null
          notes?: string | null
          outcome?: string | null
          requirements?: Json | null
          response_draft_url?: string | null
          rfp_number?: string | null
          status?: string
          submission_method?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
          uploaded_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfps_discovered_from_id_fkey"
            columns: ["discovered_from_id"]
            isOneToOne: false
            referencedRelation: "discovered_rfps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_items: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          feature_request_id: string | null
          id: string
          priority: string
          sort_order: number
          status: string
          stress_test_result: Json | null
          stress_tested_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          feature_request_id?: string | null
          id?: string
          priority?: string
          sort_order?: number
          status?: string
          stress_test_result?: Json | null
          stress_tested_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          feature_request_id?: string | null
          id?: string
          priority?: string
          sort_order?: number
          status?: string
          stress_test_result?: Json | null
          stress_tested_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmap_items_feature_request_id_fkey"
            columns: ["feature_request_id"]
            isOneToOne: false
            referencedRelation: "feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_list: boolean | null
          can_show: boolean | null
          can_update: boolean | null
          company_id: string
          enabled: boolean | null
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_list?: boolean | null
          can_show?: boolean | null
          can_update?: boolean | null
          company_id: string
          enabled?: boolean | null
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_list?: boolean | null
          can_show?: boolean | null
          can_update?: boolean | null
          company_id?: string
          enabled?: boolean | null
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          company_id: string
          created_at: string
          email_draft: Json
          error_message: string | null
          gmail_message_id: string | null
          id: string
          project_id: string | null
          scheduled_send_time: string
          sent_at: string | null
          status: string
          timezone: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email_draft?: Json
          error_message?: string | null
          gmail_message_id?: string | null
          id?: string
          project_id?: string | null
          scheduled_send_time: string
          sent_at?: string | null
          status?: string
          timezone?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email_draft?: Json
          error_message?: string | null
          gmail_message_id?: string | null
          id?: string
          project_id?: string | null
          scheduled_send_time?: string
          sent_at?: string | null
          status?: string
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          needs_dob_filing: boolean
          notes: string | null
          project_id: string | null
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
          needs_dob_filing?: boolean
          notes?: string | null
          project_id?: string | null
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
          needs_dob_filing?: boolean
          notes?: string | null
          project_id?: string | null
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
          {
            foreignKeyName: "services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_applications: {
        Row: {
          applicant_name: string | null
          application_type: string
          company_id: string
          created_at: string
          description: string | null
          filed_date: string | null
          filing_status: string | null
          id: string
          job_number: string
          property_id: string
          raw_data: Json | null
        }
        Insert: {
          applicant_name?: string | null
          application_type: string
          company_id: string
          created_at?: string
          description?: string | null
          filed_date?: string | null
          filing_status?: string | null
          id?: string
          job_number: string
          property_id: string
          raw_data?: Json | null
        }
        Update: {
          applicant_name?: string | null
          application_type?: string
          company_id?: string
          created_at?: string
          description?: string | null
          filed_date?: string | null
          filing_status?: string | null
          id?: string
          job_number?: string
          property_id?: string
          raw_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_subscriptions: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          notes: string | null
          owner_email: string | null
          owner_phone: string | null
          property_id: string
          status: string
          subscribed_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_email?: string | null
          owner_phone?: string | null
          property_id: string
          status?: string
          subscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          notes?: string | null
          owner_email?: string | null
          owner_phone?: string | null
          property_id?: string
          status?: string
          subscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signal_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_subscriptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_violations: {
        Row: {
          agency: string
          company_id: string
          created_at: string
          description: string
          id: string
          issued_date: string
          penalty_amount: number | null
          property_id: string
          raw_data: Json | null
          status: string
          violation_number: string
          violation_type: string | null
        }
        Insert: {
          agency: string
          company_id: string
          created_at?: string
          description: string
          id?: string
          issued_date: string
          penalty_amount?: number | null
          property_id: string
          raw_data?: Json | null
          status?: string
          violation_number: string
          violation_type?: string | null
        }
        Update: {
          agency?: string
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          issued_date?: string
          penalty_amount?: number | null
          property_id?: string
          raw_data?: Json | null
          status?: string
          violation_number?: string
          violation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_violations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signal_violations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          page: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      universal_documents: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          filename: string
          id: string
          mime_type: string | null
          project_id: string | null
          property_id: string | null
          proposal_id: string | null
          size_bytes: number | null
          storage_path: string
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          project_id?: string | null
          property_id?: string | null
          proposal_id?: string | null
          size_bytes?: number | null
          storage_path: string
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          project_id?: string | null
          property_id?: string | null
          proposal_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universal_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universal_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universal_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universal_documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "universal_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
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
      get_user_app_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_company_id: { Args: never; Returns: string }
      has_app_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      seed_role_permissions: {
        Args: { target_company_id: string }
        Returns: undefined
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
      app_role: "admin" | "production" | "accounting"
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
      co_status:
        | "draft"
        | "pending_internal"
        | "pending_client"
        | "approved"
        | "rejected"
        | "voided"
      project_status: "open" | "on_hold" | "closed" | "paid"
      proposal_status:
        | "draft"
        | "sent"
        | "viewed"
        | "signed_internal"
        | "signed_client"
        | "accepted"
        | "rejected"
        | "expired"
        | "lost"
        | "executed"
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
      app_role: ["admin", "production", "accounting"],
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
      co_status: [
        "draft",
        "pending_internal",
        "pending_client",
        "approved",
        "rejected",
        "voided",
      ],
      project_status: ["open", "on_hold", "closed", "paid"],
      proposal_status: [
        "draft",
        "sent",
        "viewed",
        "signed_internal",
        "signed_client",
        "accepted",
        "rejected",
        "expired",
        "lost",
        "executed",
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
