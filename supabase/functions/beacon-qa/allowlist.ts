// Column-level allowlist for Beacon Q&A. Adding columns later is a code change + review.
// Hard-block list is enforced even if a future developer adds something to the allowlist.

export const COLUMN_ALLOWLIST: Record<string, string[]> = {
  projects: [
    "id", "project_number", "name", "status", "phase", "address_id", "client_id",
    "assigned_pm_id", "assigned_senior_pm_id", "waiting_on", "waiting_since",
    "waiting_note", "expected_construction_start", "estimated_construction_completion",
    "ready_to_file_at", "last_activity_at", "created_at", "updated_at", "property_id",
  ],
  properties: [
    "id", "address", "borough", "block", "lot", "bin", "zip",
  ],
  clients: [
    "id", "name", "client_type", "is_sia", "is_rfp_partner", "created_at",
  ],
  client_contacts: [
    "id", "client_id", "name", "role", "email", "phone", "is_primary",
  ],
  change_orders: [
    "id", "project_id", "co_number", "title", "description", "amount", "status",
    "sent_at", "signed_at", "client_signed_at", "internal_signed_at", "created_at",
  ],
  services: [
    "id", "project_id", "name", "status", "total_amount", "billed_amount",
    "billed_at", "estimated_filing_date", "job_number", "filed_date", "created_at",
  ],
  project_checklist_items: [
    "id", "project_id", "label", "category", "from_whom", "status",
    "requested_date", "completed_date", "sort_order",
  ],
  pis_tracking: [
    "id", "project_id", "field_label", "first_requested_at",
    "reminder_count", "fulfilled_at",
  ],
  invoices: [
    "id", "project_id", "invoice_number", "status", "total_amount",
    "amount_paid", "balance_due", "due_date", "issued_at", "paid_at",
  ],
  project_notes: [
    "id", "project_id", "body", "source", "created_at", "user_id",
  ],
  // emails are always queried via search_emails helper, joined through email_project_tags
  emails: [
    "id", "subject", "from_name", "from_email", "to_emails", "date",
    "snippet", "body_text",
  ],
  email_project_tags: [
    "email_id", "project_id", "category", "tagged_at",
  ],
  rfi_requests: [
    "id", "project_id", "subject", "status", "sent_at", "responded_at",
    "stakeholder_name",
  ],
  universal_documents: [
    "id", "project_id", "name", "folder", "file_type", "created_at", "uploaded_by",
  ],
  project_timeline_events: [
    "id", "project_id", "event_type", "description", "occurred_at",
  ],
  project_action_items: [
    "id", "project_id", "title", "status", "assigned_to", "due_date", "completed_at",
  ],
  activities: [
    "id", "project_id", "type", "description", "created_at", "user_id",
  ],
  profiles: [
    "id", "user_id", "first_name", "last_name", "display_name", "role", "email",
  ],
};

// Hard-block: refused even if a future developer adds them to the allowlist.
// Defense in depth.
export const HARD_BLOCK_TABLES = new Set<string>([
  "ai_budget_settings", "ai_feedback", "ai_usage_logs",
  "gmail_connections", "qbo_connections",
  "notifications", "companies", "user_roles", "custom_roles", "role_permissions",
  "filing_audit_log", "pending_invites", "telemetry_events",
  "beacon_api_usage", "beacon_corrections", "beacon_feedback",
  "beacon_interactions", "beacon_research_feedback", "beacon_suggestions",
  "beacon_tool_log",
]);

// Tables without a direct project_id column that the proxy joins through projects.
// (currently emails — handled by search_emails)
export const TABLES_WITHOUT_PROJECT_ID = new Set<string>(["emails", "clients", "client_contacts", "properties", "profiles"]);

export function assertTableAllowed(table: string): void {
  if (HARD_BLOCK_TABLES.has(table)) {
    throw new Error(`blocked_table:${table}`);
  }
  if (!(table in COLUMN_ALLOWLIST)) {
    throw new Error(`table_not_in_allowlist:${table}`);
  }
}

export function filterColumns(table: string, requested?: string[]): string[] {
  const allowed = COLUMN_ALLOWLIST[table];
  if (!requested || requested.length === 0) return allowed;
  return requested.filter((c) => allowed.includes(c));
}
