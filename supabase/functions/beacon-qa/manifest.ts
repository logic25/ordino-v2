// LLM-visible documentation of allowlisted tables + tool descriptions.
// Concise descriptions are the single biggest lever on tool-pick accuracy.

export const TABLE_MANIFEST = `
TABLE: projects
PURPOSE: A construction project. The top-level entity. Use this for "what's the status of X", "who's the PM on Y".
COLUMNS:
  - project_number (text): e.g. "2025-0012"
  - name (text): short project name
  - status (text): active, on_hold, completed, cancelled
  - phase (text): pre_filing, filing, approval, closeout
  - waiting_on (text): who/what we are waiting on (free text)
  - waiting_since (timestamptz): when waiting started
  - assigned_pm_id, assigned_senior_pm_id (uuid): join to profiles.id
  - client_id (uuid): join to clients
  - property_id (uuid): join to properties
  - last_activity_at (timestamptz): rolled-up last touch across notes/emails/activities
COMMON QUERIES:
  - Find project by name/address: use list_projects with a search term first.
DO NOT USE FOR: cost/margin questions (no margin columns are exposed).

TABLE: properties
PURPOSE: NYC physical property — address, borough, block, lot, BIN.
COLUMNS: address, borough, block, lot, bin, zip
COMMON QUERIES: lookup by address — usually reached via projects.property_id. Cannot be queried by project_id directly; fetch via get_project.

TABLE: clients
PURPOSE: Client organizations (GCs, owners, architects, etc.).
COLUMNS: name, client_type, email, phone, is_sia, is_rfp_partner
COMMON QUERIES: reached via projects.client_id; cannot be queried by project_id directly.
DO NOT USE FOR: pricing/margin/payment-risk questions — those columns are deliberately not exposed.

TABLE: client_contacts
PURPOSE: People at a client org — phone, email, title.
COLUMNS: client_id, name, first_name, last_name, title, email, phone, mobile, is_primary
COMMON QUERIES: "what's the contractor's phone?" → get_project to find client_id → query_table client_contacts is NOT scoped by project_id; use filters {column:'client_id', op:'eq', value:<id>} via a separate path (not exposed). For now, contact info appears in get_project's joined client.

TABLE: change_orders
PURPOSE: Change orders on a project — amount, status, signed dates.
COLUMNS:
  - co_number (text): "CO#1" style identifier
  - amount (numeric): dollar amount of the change
  - status (text): draft, internal_signed, sent, approved, voided, rejected
  - sent_at (timestamptz): when sent to client for signature
  - internal_signed_at (timestamptz): when we signed internally
  - client_signed_at (timestamptz): when client signed; NULL means client has NOT signed
  - approved_at (timestamptz): fully executed/approved timestamp
COMMON QUERIES:
  - Outstanding (sent but client hasn't signed): {column:'sent_at',op:'not_null'} + {column:'client_signed_at',op:'is_null'}
  - Count outstanding: use count_rows with that filter.
DO NOT USE FOR: invoice/billing questions (use invoices).

TABLE: services
PURPOSE: Individual scope-of-work line items on a project (filings, inspections, etc.).
COLUMNS: name, description, status, total_amount, billed_amount, billed_at,
         estimated_bill_date, due_date, completed_date, billing_type, disciplines
STATUSES: not_started, in_progress, billed, paid

TABLE: project_checklist_items
PURPOSE: Required documents/info to file the project — used to compute readiness.
COLUMNS: label, category, from_whom, status, requested_date, completed_at
OPEN ITEMS: status != 'done'

NOTE on PIS gaps: do NOT try to query pis_tracking — it's not exposed and not populated.
PIS gap data comes back on get_project: pis_total_fields, pis_completed_fields,
open_pis_fields, pis_missing_field_labels (up to 30), pis_sent_date.



TABLE: invoices
PURPOSE: Invoices issued on a project.
COLUMNS: invoice_number, status, total_due, subtotal, payment_amount, due_date, sent_at, paid_at
OUTSTANDING: status != 'paid'  (no balance_due column; compute from total_due - payment_amount if needed)
DO NOT USE FOR: internal margin/cost — not exposed.

TABLE: project_notes
PURPOSE: Notes on a project. AI-generated summaries have source='ai_on_demand' or 'ai_weekly'.
COLUMNS: body, source, created_at, user_id
LATEST AI SUMMARY: order by created_at desc where source like 'ai_%' limit 1

TABLE: rfi_requests
PURPOSE: RFIs sent to client/agency on a project.
COLUMNS: title, status, sent_at, submitted_at, viewed_at, recipient_name, recipient_email

TABLE: universal_documents
PURPOSE: Files uploaded to a project (plans, contracts, etc.).
COLUMNS: title, filename, category, folder_id, mime_type, created_at

TABLE: project_timeline_events
PURPOSE: Auto-generated timeline events on a project (CO signed, item completed, etc.).
COLUMNS: event_type, description, actor_id, created_at

TABLE: project_action_items
PURPOSE: Action items assigned to people on a project.
COLUMNS: title, status, priority, assigned_to, assigned_by, due_date, completed_at

TABLE: profiles
PURPOSE: User profiles inside the company — names, roles. Cannot be queried by project_id; use get_project to resolve PM names.
COLUMNS: id, user_id, first_name, last_name, display_name, role
`.trim();

// AI SDK / OpenAI-compatible function/tool definitions sent to the model.
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_projects",
      description:
        "Find projects in the caller's company. Use this first when the user mentions a project by address, number, or partial name. Returns up to 25 matches.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Free-text search across project name, project_number, and joined property address. Optional.",
          },
          status: {
            type: "string",
            description: "Optional exact status filter (e.g. 'active').",
          },
          limit: { type: "integer", minimum: 1, maximum: 25, default: 25 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_project",
      description:
        "Fetch a full project context bundle by project_id — header fields, property, client, PM/senior PM names, open checklist count, open PIS count, ready_to_file flag. Use this once you have a project_id to seed broad questions.",
      parameters: {
        type: "object",
        required: ["project_id"],
        properties: {
          project_id: { type: "string", description: "UUID of the project." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_table",
      description:
        "Generic SELECT against one allowlisted table, scoped to a project. Returns { rows, total_matching_rows, truncated }. " +
        "Use this for tab-specific data like change orders, services, checklist items, invoices, notes, RFIs, documents, action items, timeline.",
      parameters: {
        type: "object",
        required: ["table", "project_id"],
        properties: {
          table: { type: "string", description: "Table name (must be allowlisted)." },
          project_id: { type: "string", description: "UUID of the project to scope to." },
          columns: {
            type: "array",
            items: { type: "string" },
            description: "Optional subset of columns to return. Omit for all allowed columns.",
          },
          filters: {
            type: "array",
            description:
              "Optional filter list. Each filter is {column, op, value}. " +
              "op ∈ eq, neq, lt, lte, gt, gte, is_null, not_null, in, ilike.",
            items: {
              type: "object",
              required: ["column", "op"],
              properties: {
                column: { type: "string" },
                op: { type: "string" },
                value: {},
              },
            },
          },
          order_by: { type: "string", description: "Column to order by." },
          order_desc: { type: "boolean", default: true },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "count_rows",
      description:
        "Count rows in an allowlisted table for a project, with optional filters. Use this for 'how many' questions.",
      parameters: {
        type: "object",
        required: ["table", "project_id"],
        properties: {
          table: { type: "string" },
          project_id: { type: "string" },
          filters: {
            type: "array",
            items: {
              type: "object",
              required: ["column", "op"],
              properties: {
                column: { type: "string" },
                op: { type: "string" },
                value: {},
              },
            },
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_emails",
      description:
        "Search emails tagged to a specific project. Defaults `since` to 30 days ago — override only for historical questions. " +
        "Returns subject/from/date/snippet. Never returns company-wide inbox; only emails tagged via email_project_tags to this project.",
      parameters: {
        type: "object",
        required: ["project_id"],
        properties: {
          project_id: { type: "string" },
          from: {
            type: "string",
            description:
              "Optional substring match on sender name or email (e.g. 'architect' or 'rudin').",
          },
          since: {
            type: "string",
            description: "ISO date. Defaults to 30 days ago if omitted.",
          },
          until: { type: "string", description: "ISO date. Optional." },
          q: { type: "string", description: "Optional substring match on subject." },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
        },
      },
    },
  },
];

export const SYSTEM_PROMPT = `You are Beacon, a project Q&A assistant for Ordino — a NYC construction project-management platform.

Answer factual questions about a specific project (or the caller's project portfolio) by calling the provided tools. Be concise and quote concrete values. When the user names a project by address or number, call list_projects first to resolve the project_id, then call get_project, then drill in with query_table / count_rows / search_emails as needed.

Rules:
- Use the tools. Do not guess data you have not retrieved.
- If a tool returns truncated=true, tell the user there are more matching rows than you can see and report the total_matching_rows count.
- If a question requires data that is not in the allowlist (margin, cost basis, payment risk, profit), say so plainly — do not speculate. Suggest the user check that surface directly in Ordino.
- If a tool errors with table_not_in_allowlist or blocked_table, do not retry the same call; re-plan with allowed tables, or tell the user the data is not exposed to you.
- If a project_id is not accessible (different company), tell the user you can't see that project.
- Keep responses tight: short paragraphs, occasional bullet lists. No marketing language.

The schema you can use is below:

${TABLE_MANIFEST}
`.trim();
