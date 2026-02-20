
# Three-Part Plan: Change Order Workflow + New Hire Onboarding + Heatmap Tracking

---

## Part 1: Rethinking Onboarding for an Internal Tool

You are absolutely right. Since this is an internal tool for your team, onboarding needs to serve a different purpose than a public SaaS product. The company is already set up — new hires just need to learn the tool.

The refined onboarding strategy has two layers:

**Layer 1 — First Login Welcome Banner (Dashboard)**
When a new team member logs in for the first time and their profile has no `onboarding_completed` flag, they see a dismissible banner on the dashboard:

```text
Welcome to Ordino, [Name]!
[ Take the guided tour ]  [ Browse Help Desk ]  [ Dismiss ]
```

That's it. Clean, non-blocking. Clicking "guided tour" launches the existing walkthrough engine.

**Layer 2 — Add a "Change Orders" Walkthrough to Help Desk**
A new CO walkthrough is added to the interactive training system so any team member — new or experienced — can self-serve learn the CO workflow on demand.

No multi-step wizard. No company setup steps. Just smart defaults that meet new hires where they are.

**Files to modify:**
- `src/pages/Dashboard.tsx` — add first-login banner using `onboarding_completed` check
- `src/components/walkthrough/walkthroughs.ts` — add new "Change Orders" walkthrough
- `src/integrations/supabase/` — migration to add `onboarding_completed` boolean to profiles (defaults to `false`, gets set to `true` on dismiss or tour completion)

---

## Part 2: Change Order Workflow — Full Build with Dual-Signature

Yes, COs will behave exactly like proposals, including:
- Internal signature capture (canvas pad, saved signature support)
- Client signature step (sent to client, they sign)
- Same dual-signature status tracking already visible in the mock data (`internalSigned`, `clientSigned`)
- A dedicated detail sheet (slide-out panel) — same pattern as `ProposalDetailSheet`
- CO numbering: `CO#1`, `CO#2`... sequential per project (not proposal-style date prefix)

### Database Migration

New `change_orders` table:

```text
change_orders
├── id                      uuid PK
├── company_id              uuid FK → companies
├── project_id              uuid FK → projects
├── co_number               text  — "CO#1", "CO#2" (auto-generated trigger)
├── title                   text  — "PAA to address Schedule B"
├── description             text  — full scope
├── reason                  text  — why this change happened
├── amount                  numeric — positive (add-on) or negative (credit)
├── status                  enum: draft | pending_client | approved | rejected | voided
├── requested_by            text  — "Client", "Internal", "GC"
├── linked_service_names    text[]
├── internal_signed_at      timestamptz
├── internal_signed_by      uuid FK → profiles
├── internal_signature_data text
├── client_signed_at        timestamptz
├── client_signer_name      text
├── client_signature_data   text
├── sent_at                 timestamptz
├── approved_at             timestamptz
├── notes                   text
├── created_by              uuid FK → profiles
├── created_at / updated_at
```

Auto-number trigger assigns `CO#1`, `CO#2`... per `project_id` using same pattern as `generate_project_number()`.

RLS: company-isolated — users can only see/write COs for their company.

### Status Flow

```text
Draft
  → [Sign Internally]     → Pending Client
  → [Client Signs]        → Approved
  → [Manually Approve]    → Approved (no client sig needed for internal COs)
  → [Reject]              → Rejected
  → [Void]                → Voided  (auto-created negative COs land here)
```

### New Files

**`src/hooks/useChangeOrders.ts`**
- `useChangeOrders(projectId)` — live query all COs for a project
- `useCreateChangeOrder()` — insert, triggers CO number
- `useUpdateChangeOrder()` — status changes, field edits
- `useDeleteChangeOrder()` — draft-only deletion
- `useSignCOInternal(id, signatureData)` — sets `internal_signed_at`, `internal_signature_data`, status → `pending_client`
- `useMarkCOApproved(id)` — sets `approved_at`, status → `approved`
- Types: `ChangeOrder`, `ChangeOrderFormInput`

**`src/components/projects/ChangeOrderDialog.tsx`**

A focused dialog (not a multi-step form like ProposalDialog — COs are simpler):
- Title — e.g. "PAA to address Schedule B"
- Description (scope)
- Reason (why this CO exists)
- Amount (positive or negative — shows impact on contract total)
- Requested by (text: Client / Internal / GC / Architect)
- Linked services (multi-select from the project's existing services)
- Status defaults to `draft`
- "Save as Draft" and "Create CO" actions

**`src/components/projects/ChangeOrderDetailSheet.tsx`**

A slide-out `Sheet` panel showing a single CO in full detail:
- CO number + title header
- All fields (description, reason, amount, requested by, linked services)
- Dual-signature status tracker:
  ```text
  [ Internal Signature ]     [ Client Signature ]
  [ Sheri L. — 02/11/2026 ]  [ Pending — Send to Client ]
  ```
- "Sign Internally" button → opens the existing `SignatureDialog` (reused exactly as proposals do)
- "Send to Client" button → marks `sent_at`, changes status to `pending_client`
- "Mark Approved" button (for admin override, no client sig required)
- "Void CO" button
- Timeline of status changes
- Notes field
- Edit button (opens `ChangeOrderDialog` in edit mode for drafts only)

**Reuse of `SignatureDialog`**
The existing `SignatureDialog` in `src/components/proposals/SignatureDialog.tsx` is proposal-specific (shows proposal number, client, total, PM picker). For COs, a lighter variant is used — same canvas pad logic, same saved-signature feature — but scoped to a CO. This will be a new `COSignatureDialog` that strips out the PM assignment (already done at project creation) and shows CO number + title + amount instead.

### Wiring Into ProjectDetail / ProjectExpandedTabs

- The `ChangeOrdersTab` in `ProjectExpandedTabs.tsx` currently renders from `MockChangeOrder[]` passed as a prop
- Replace with real data from `useChangeOrders(projectId)` 
- "Create CO" button in the tab opens `ChangeOrderDialog`
- Clicking a CO row opens `ChangeOrderDetailSheet`
- The adjusted total in the cost summary bar (`contractTotal + approvedCOs`) updates live from real data
- The CO count badge on the tab updates live
- Auto-negative CO logic: when a PM drops a service in `ProjectDetail`, instead of just showing a toast, it calls `useCreateChangeOrder()` with a negative amount and `status: "voided"` (pre-approved credit)

---

## Part 3: Microsoft Clarity Heatmap Tracking

The simplest possible change — one script block added to `index.html`. No new dependencies, no database changes.

**What you get:**
- Click heatmaps per page (where on `/proposals`, `/projects`, `/invoices` are people actually clicking)
- Scroll depth maps (do users see the bottom tabs on Project Detail?)
- Session recordings (watch real sessions of how your team navigates)
- Rage click detection (automatically flags frustrating UX moments)
- "Dead click" detection (clicking things that don't respond)
- All free, all private (only you see the data in your Clarity dashboard)

**What you need to do first (5 minutes):**
1. Go to **clarity.microsoft.com**
2. Sign in with a Microsoft account
3. Click "New Project" → name it "Ordino" → set URL to your app domain
4. Copy the **Project ID** (looks like `abc123xyz`)

Once you share that ID, I add this to `index.html`:

```html
<head>
  ...existing tags...

  <!-- Microsoft Clarity -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "YOUR_CLARITY_ID");
  </script>
</head>
```

**Privacy mask for sensitive data (optional but recommended)**
After adding Clarity, sensitive fields (client names, invoice amounts, email addresses) can be hidden from recordings by adding `data-clarity-mask="true"` to those DOM elements — Clarity renders them as blurred blocks in recordings. We can add this in a follow-up pass to specific components like `InvoiceTable`, `ClientTable`, and `EmailList`.

**File to modify:** `index.html` only

---

## Implementation Sequence

**Step 1 — Database migration**
- Add `change_orders` table with all fields + enum
- Add `generate_co_number()` trigger
- Add RLS policies (company-isolated)
- Add `onboarding_completed` boolean to `profiles` (default `false`)

**Step 2 — Data hooks**
- Create `src/hooks/useChangeOrders.ts`

**Step 3 — CO UI components**
- Create `src/components/projects/ChangeOrderDialog.tsx`
- Create `src/components/projects/COSignatureDialog.tsx` (lighter SignatureDialog variant)
- Create `src/components/projects/ChangeOrderDetailSheet.tsx`

**Step 4 — Wire into ProjectExpandedTabs / ProjectDetail**
- Replace `MockChangeOrder[]` props with `useChangeOrders(projectId)` real data
- Connect "Create CO" button → `ChangeOrderDialog`
- Connect row click → `ChangeOrderDetailSheet`
- Connect service-drop action → real `useCreateChangeOrder()` negative CO insert

**Step 5 — Onboarding**
- Add first-login welcome banner to `Dashboard.tsx`
- Add "Change Orders" walkthrough to `walkthroughs.ts`

**Step 6 — Heatmap**
- Add Clarity script to `index.html` (requires your Project ID first)

All three parts can be built and approved in one go — Steps 1–5 can start immediately. Step 6 is ready to go the moment you share your Clarity Project ID.
