
# Comprehensive Telemetry Layer + AI Roadmap Intake Button

## Overview

The app has 12 distinct modules, each with multiple user flows. The telemetry design below covers every meaningful action across all of them — not just invoices. The AI Roadmap Intake is a single button inside the Product Roadmap tab that opens a modal with two modes: analyze behavior or stress-test a typed idea.

---

## Part 1 — Database Schema (2 new tables)

### `telemetry_events`
```
id, company_id, user_id, session_id, page, action,
metadata jsonb  -- { role, entity_id, entity_type, step, error_code }
created_at
```

RLS: authenticated users can INSERT their own rows (user_id = auth.uid()). Only admins can SELECT.

### `ai_roadmap_suggestions`
```
id, company_id, title, description, category, priority,
evidence text, duplicate_warning text, challenges text[],
status (pending_review | approved | dismissed),
source (telemetry | manual_idea), raw_idea text,
created_at, reviewed_at, reviewed_by
```

RLS: admins only for all operations.

---

## Part 2 — Complete Telemetry Event Catalog

Every event is `page__action` format. Metadata captures extra context without extra columns.

### INVOICES (Billing page) — highest value, most thorough
| Event | Trigger point | Why it matters |
|---|---|---|
| `invoices__create_started` | Create Invoice dialog opens | |
| `invoices__create_completed` | Invoice saved (draft or ready) | Drop-off between these = friction |
| `invoices__create_abandoned` | Dialog closed with no save | |
| `invoices__send_started` | Send Invoice modal opens | |
| `invoices__send_completed` | Invoice successfully sent | Core revenue action |
| `invoices__send_failed` | Send fails (no email, gmail error) | Technical blocker |
| `invoices__retainer_applied` | Retainer toggle switched on | Feature adoption signal |
| `invoices__payment_plan_started` | PaymentPlanDialog opens | |
| `invoices__payment_plan_completed` | Plan saved | |
| `invoices__payment_plan_abandoned` | Dialog closed at step 1 or 2 | Multi-step drop-off |
| `invoices__ach_authorization_reached` | User reaches ACH step in plan | Step penetration |
| `invoices__claimflow_started` | ClaimFlowDialog opens | Escalation signal |
| `invoices__claimflow_submitted` | Referral submitted | |
| `invoices__collection_message_generated` | AI message requested | AI adoption |
| `invoices__collection_message_sent` | Message sent from collections view | |
| `invoices__payment_promise_logged` | Promise created | |
| `invoices__ai_priority_mode_toggled` | AI view switched on/off | Feature adoption |
| `invoices__send_to_billing_opened` | SendToBillingDialog opened | |
| `invoices__pdf_previewed` | PDF preview opened | |
| `invoices__qbo_widget_viewed` | QBO widget visible on page | Integration adoption |
| `invoices__filter_tab_changed` | Tab changed (sent/overdue/paid etc.) | Navigation pattern |
| `invoices__collections_tab_viewed` | Collections sub-view opened | Feature discovery |
| `invoices__retainers_tab_viewed` | Retainers sub-view opened | |
| `invoices__analytics_tab_viewed` | Analytics sub-view opened | |

### PROPOSALS
| Event | Trigger point |
|---|---|
| `proposals__create_started` | ProposalDialog opens (new) |
| `proposals__create_completed` | Proposal saved |
| `proposals__create_abandoned` | Dialog closed without save |
| `proposals__send_started` | SendProposalDialog opens |
| `proposals__send_completed` | Proposal marked sent |
| `proposals__send_abandoned` | Dialog closed without send |
| `proposals__internal_sign_started` | SignatureDialog opens |
| `proposals__internal_sign_completed` | Signature saved |
| `proposals__client_approved` | ProposalApprovalDialog — approved |
| `proposals__preview_opened` | ProposalPreviewModal opens |
| `proposals__lead_capture_started` | LeadCaptureDialog opens |
| `proposals__lead_capture_completed` | Lead saved |
| `proposals__followup_logged` | Manual follow-up logged |
| `proposals__followup_snoozed` | Snooze used |
| `proposals__followup_dismissed` | Follow-up dismissed |

### PROJECTS
| Event | Trigger point |
|---|---|
| `projects__create_started` | ProjectDialog opens (new) |
| `projects__create_completed` | Project saved |
| `projects__detail_viewed` | ProjectDetail page loaded |
| `projects__tab_changed` | Tab switched (services/contacts/docs etc.), metadata: { tab } |
| `projects__service_expanded` | Service row expanded |
| `projects__service_status_changed` | Status dropdown changed |
| `projects__co_create_started` | ChangeOrderDialog opens |
| `projects__co_create_completed` | CO saved |
| `projects__co_sign_started` | COSignatureDialog opens |
| `projects__co_detail_opened` | ChangeOrderDetailSheet opens |
| `projects__checklist_item_added` | Checklist item created |
| `projects__checklist_item_completed` | Checkbox ticked |
| `projects__checklist_followup_approved` | AI draft approved |
| `projects__checklist_followup_dismissed` | AI draft dismissed |
| `projects__pis_form_opened` | EditPISDialog opens (PIS/RFI form) |
| `projects__pis_form_submitted` | PIS submitted |
| `projects__dob_prep_sheet_opened` | DobNowFilingPrepSheet opens |
| `projects__litigation_export_started` | LitigationExportDialog opens |
| `projects__document_uploaded` | Doc uploaded in project |
| `projects__esign_dialog_opened` | ESignInstructionDialog opens |

### PROPERTIES
| Event | Trigger point |
|---|---|
| `properties__create_started` | PropertyDialog opens |
| `properties__create_completed` | Property saved |
| `properties__detail_viewed` | PropertyDetail page loaded |
| `properties__signal_enroll_started` | SignalEnrollDialog opens |
| `properties__signal_enrolled` | Signal enrollment saved |
| `properties__violation_viewed` | Violations tab expanded |
| `properties__application_linked` | Application linked to property |

### EMAILS
| Event | Trigger point |
|---|---|
| `emails__compose_started` | ComposeEmailDialog opens |
| `emails__compose_sent` | Email sent |
| `emails__compose_abandoned` | Dialog closed without send |
| `emails__draft_saved` | Draft saved |
| `emails__email_opened` | Email detail sheet opened |
| `emails__reminder_set` | ReminderButton used |
| `emails__snoozed` | SnoozeMenu used |
| `emails__tagged` | Tag applied in EmailTagDialog |
| `emails__schedule_send_used` | ScheduleSendDropdown used |
| `emails__gmail_connect_clicked` | GmailConnectButton clicked |
| `emails__gmail_sync_triggered` | Manual sync triggered |
| `emails__search_used` | Gmail search query submitted |
| `emails__filter_tab_changed` | Tab changed (inbox/sent/snoozed etc.) |
| `emails__attachment_previewed` | AttachmentPreviewModal opens |
| `emails__keyboard_shortcut_used` | Shortcut triggered, metadata: { key } |

### TIME TRACKING
| Event | Trigger point |
|---|---|
| `time__log_started` | TimeEntryDialog opens |
| `time__log_completed` | Entry saved |
| `time__timer_started` | ActiveTimerBar — start clicked |
| `time__timer_stopped` | ClockOutModal opens |
| `time__clock_out_completed` | ClockOut saved |
| `time__timesheet_week_navigated` | Week arrows clicked |
| `time__attendance_tab_viewed` | Attendance tab opened |

### RFPs
| Event | Trigger point |
|---|---|
| `rfps__create_started` | New RFP dialog opens |
| `rfps__create_completed` | RFP saved |
| `rfps__upload_pdf_started` | AI extract triggered (file selected) |
| `rfps__upload_pdf_completed` | AI extraction returned data |
| `rfps__builder_started` | RfpBuilderDialog opens |
| `rfps__builder_step_advanced` | Next step clicked, metadata: { from_step, to_step } |
| `rfps__builder_cover_letter_generated` | AI cover letter generated |
| `rfps__builder_preview_opened` | Preview modal opened |
| `rfps__builder_submitted` | RFP submitted/sent |
| `rfps__builder_abandoned` | Dialog closed before submit |
| `rfps__partner_email_sent` | Partner outreach sent |
| `rfps__discovery_viewed` | RfpDiscovery page visited |
| `rfps__monitoring_settings_opened` | MonitoringSettingsDialog opens |
| `rfps__kanban_vs_table_toggled` | View mode switched |

### CLIENTS / COMPANIES
| Event | Trigger point |
|---|---|
| `clients__create_started` | ClientDialog opens |
| `clients__create_completed` | Client saved |
| `clients__detail_opened` | ClientDetailSheet opens |
| `clients__contact_added` | AddContactDialog submitted |
| `clients__contact_edited` | EditContactDialog submitted |
| `clients__review_added` | ReviewsSection — review saved |
| `clients__proposals_modal_opened` | ClientProposalsModal opens |

### CALENDAR
| Event | Trigger point |
|---|---|
| `calendar__event_create_started` | CalendarEventDialog opens (new) |
| `calendar__event_create_completed` | Event saved |
| `calendar__view_changed` | Day vs week view switched |
| `calendar__google_sync_triggered` | Google Calendar sync triggered |

### REPORTS
| Event | Trigger point |
|---|---|
| `reports__tab_viewed` | Tab changed, metadata: { tab } |
| `reports__export_triggered` | Export button clicked, metadata: { report_type } |

### DASHBOARD
| Event | Trigger point |
|---|---|
| `dashboard__widget_reordered` | DashboardLayoutConfig drag complete |
| `dashboard__quick_time_log_used` | QuickTimeLog submitted |
| `dashboard__role_preview_switched` | RolePreviewSelector changed |
| `dashboard__billing_goal_viewed` | BillingGoalTracker visible |

### SETTINGS
| Event | Trigger point |
|---|---|
| `settings__tab_viewed` | Tab changed, metadata: { tab } |
| `settings__automation_rule_created` | New rule saved |
| `settings__service_catalog_edited` | Service saved |
| `settings__team_member_invited` | Invite sent |
| `settings__notification_preference_changed` | Preference toggled |

---

## Part 3 — `useTelemetry` Hook

A single lightweight hook:

```typescript
// src/hooks/useTelemetry.ts
export function useTelemetry() {
  const { session } = useAuth();
  const sessionId = useSessionId(); // from sessionStorage

  const track = useCallback((page: string, action: string, metadata?: Record<string, any>) => {
    if (!session?.user?.id) return;
    // Fire and forget — no await, never blocks UI
    supabase.from("telemetry_events").insert({
      user_id: session.user.id,
      company_id: profile?.company_id,
      session_id: sessionId,
      page,
      action,
      metadata: metadata ?? {},
    }).then(() => {}); // silently ignore errors
  }, [session?.user?.id]);

  return { track };
}
```

Session ID is a UUID stored in `sessionStorage` — regenerated on every browser tab/session, enabling drop-off detection within a session.

---

## Part 4 — AI Edge Function: `analyze-telemetry`

### Inputs sent to Gemini:
1. Last 30 days of telemetry events aggregated by `(page, action, session_id)` — NOT raw rows, pre-aggregated counts
2. Current roadmap item titles (for duplicate detection)
3. Current ai_roadmap_suggestions titles (to avoid re-suggesting)

### System prompt (the full intelligence layer):

```
You are a senior product analyst for Ordino — a construction permit 
expediting CRM used daily by project managers, accountants, and admins 
in NYC. The app has these modules: Invoices, Proposals, Projects, 
Properties, Emails, Time, RFPs, Clients, Calendar, Reports, Dashboard, Settings.

You will receive telemetry data showing what users actually do and where 
they stop. Analyze patterns and surface ONLY concrete, evidence-backed gaps.

SIGNAL TYPES TO DETECT:
1. DROP-OFF: A "_started" event exists with no matching "_completed" event 
   in the same session → user abandoned the flow. 
   Formula: (started_count - completed_count) / started_count > 0.3 = significant
   
2. REPETITION LOOPS: Same action >3x in one session → user confused or retrying 
   something that isn't working as expected
   
3. DEAD ZONES: Page visited but no sub-actions logged in 60%+ of sessions 
   → users land here but find no value or no clear next step
   
4. FEATURE BLINDNESS: Core features (e.g., retainer_applied, ai_priority_mode) 
   with very low adoption relative to parent page views → discoverability issue
   
5. ERROR CLUSTERS: _failed events appearing consistently → broken experience

6. ROLE MISMATCH: action logged by user with unexpected role (e.g., accounting 
   user repeatedly trying a production-only action) → permissions confusion

PRIORITY SCORING RULES (be strict — do not inflate):
- high: affects >3 distinct users OR involves invoices/billing/send flows
- medium: affects 2–3 users OR involves core workflow (proposals, projects, time)
- low: single user, non-revenue-impacting

DUPLICATE DETECTION: Compare title and description against provided 
existing_roadmap_items and existing_suggestions. If overlap >70%, 
set duplicate_warning to the matching item title. Do not create the item.

OUTPUT FORMAT: JSON array. Only include items with clear evidence. 
Max 5 suggestions per analysis run to avoid noise.

Each item:
{
  "title": string,
  "description": string (1-2 sentences, problem-first),
  "category": "billing"|"projects"|"integrations"|"operations"|"general",
  "priority": "high"|"medium"|"low",
  "evidence": string (specific: "8 users opened CreateInvoice, 6 closed without saving"),
  "duplicate_warning": string | null,
  "challenges": string[] (2-4 realistic implementation challenges)
}
```

### Manual Idea Mode (same function, different prompt path):
When triggered by a typed idea instead of telemetry, the function receives:
- The raw idea text
- Current roadmap items
- A different system prompt instruction: "Stress-test this idea. Challenge assumptions, surface edge cases, detect duplicates, score priority based on the domain context above."

---

## Part 5 — UI: AI Roadmap Intake Button + Modal

### Where it lives:
Inside `ProductRoadmap.tsx`, a new **"AI Intake"** button is added to the existing actions bar alongside the existing "Add Item" and "From Requests" buttons.

### The modal has two tabs:

**Tab 1 — Analyze Behavior (telemetry)**
- Subtitle: "Scans the last 30 days of user behavior to find friction patterns"
- "Run Analysis" button → calls edge function
- Loading state: "Analyzing 847 events across 12 modules..."
- Results: cards with evidence quote, priority badge, duplicate warning, challenges
- Each card: "Add to Roadmap" | "Dismiss"

**Tab 2 — Stress-Test an Idea (manual)**
- Large textarea: "Describe a product idea in plain English..."
- "Analyze Idea" button
- Loading state: spinner
- Result: single structured preview card
- Card has: refined title, category, priority, risks/challenges, duplicate warning (if any)
- Buttons: "Add to Roadmap" | "Edit & Add" | "Dismiss"

### After "Add to Roadmap":
- Creates a row in `roadmap_items` directly (with status = "gap" by default, priority from AI)
- Shows success toast
- The roadmap kanban/table refreshes

---

## Part 6 — Files to Create / Modify

### New migrations:
- `supabase/migrations/XXXXXX_telemetry_and_ai_suggestions.sql`
  - Creates `telemetry_events` with RLS
  - Creates `ai_roadmap_suggestions` with RLS

### New edge function:
- `supabase/functions/analyze-telemetry/index.ts`
  - Handles two modes: `mode: "telemetry"` and `mode: "idea"`
  - Aggregates telemetry server-side before sending to AI (never raw rows)
  - Uses `LOVABLE_API_KEY` with `google/gemini-3-flash-preview`

### New hook:
- `src/hooks/useTelemetry.ts`

### New component:
- `src/components/helpdesk/AIRoadmapIntake.tsx` — the modal with two tabs

### Modified components (adding `track()` calls — ~2-3 lines each):
- `src/components/invoices/CreateInvoiceDialog.tsx` — 3 events
- `src/components/invoices/SendInvoiceModal.tsx` — 2 events
- `src/components/invoices/PaymentPlanDialog.tsx` — 3 events
- `src/components/invoices/ClaimFlowDialog.tsx` — 2 events
- `src/components/invoices/CollectionsView.tsx` — 3 events
- `src/components/proposals/ProposalDialog.tsx` — 2 events
- `src/components/proposals/SendProposalDialog.tsx` — 2 events
- `src/components/proposals/SignatureDialog.tsx` — 1 event
- `src/components/proposals/ProposalApprovalDialog.tsx` — 1 event
- `src/components/projects/ChangeOrderDialog.tsx` — 2 events
- `src/components/projects/ProjectExpandedTabs.tsx` — 2 events (tab change, service expand)
- `src/pages/ProjectDetail.tsx` — 2 events (detail viewed, tab changed)
- `src/pages/Invoices.tsx` — 2 events (filter tab, sub-view tab)
- `src/pages/Emails.tsx` — 3 events (compose, gmail connect, filter)
- `src/pages/Rfps.tsx` — 3 events (create, upload, builder)
- `src/components/rfps/RfpBuilderDialog.tsx` — 3 events (step advance, preview, submit)
- `src/pages/Time.tsx` — 1 event (timer start)
- `src/pages/Calendar.tsx` — 1 event (event create)
- `src/components/helpdesk/ProductRoadmap.tsx` — add AI Intake button + import modal

### Total files modified: 20
### New files created: 4 (migration, edge function, hook, component)

---

## Technical Notes

- All `track()` calls are fire-and-forget with no `await` — zero performance impact
- The edge function aggregates telemetry into counts BEFORE sending to AI — not raw user data
- Session ID in `sessionStorage` means closing and reopening the tab starts a new session (correct behavior for drop-off detection)
- The `analyze-telemetry` function already has access to `LOVABLE_API_KEY` (confirmed in secrets)
- `supabase/config.toml` will need a new entry for `analyze-telemetry`
