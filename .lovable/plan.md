Goal: Harden the `query_ordino` branch of `supabase/functions/beacon-data-proxy/index.ts` so it can no longer query arbitrary tables, while leaving every other action unchanged.

---

## 1 — Audit of current `query_ordino` (already read)

The `queryOrdino` function currently accepts any `table` param except names matching a small `BLOCKED_TABLES` / `BLOCKED_PATTERNS` denylist. It does not enforce a positive allowlist, so it can read any public table (including tables with sensitive operational data that are not in the denylist). It caps via a `safeLimit` capped at 200.

---

## 2 — Changes (query_ordino only)

### 2.1 Hard allowlist

Introduce a `const ALLOWED_TABLES = new Set(["projects", "properties", "proposals", "invoices", "services", "clients", "client_contacts", "project_action_items", "project_checklist_items", "rfi_requests", "signal_violations", "signal_applications", "profiles", "company_reviews"]);`.

Before the existing blocked-table check, add an early gate:

```ts
if (!ALLOWED_TABLES.has(table)) {
  return fail("table_not_allowed", 403);
}
```

The existing `BLOCKED_TABLES` / `BLOCKED_PATTERNS` checks remain after this as defense-in-depth.

### 2.2 Result-set cap

`safeLimit` is already `Math.min(Math.max(Number(limit) || 50, 1), 200)`. No change needed — the cap is already 200.

### 2.3 Planned follow-up comment

Add a one-line comment inside `queryOrdino` (or directly above it) exactly matching this wording:

```ts
// TODO: company_id scoping + JWT verification — planned follow-up tied to Beacon /api/chat merge
```

---

## 3 — What stays untouched

- `list_schema` and `describe_table` — no changes.
- `query_projects`, `query_project_detail`, `query_property_violations`, `query_pm_workload`, `check_filing_readiness`, `query_proposals`, `query_invoices`, `query_bug_patterns`, `create_bug_from_conversation`, `vendor_lookup` — no changes.
- The auth model (`x-beacon-key` shared secret + service-role key) — no changes.
- No JWT requirement is added.

---

## 4 — Rollout

1. Edit `supabase/functions/beacon-data-proxy/index.ts`.
2. Add `ALLOWED_TABLES` set and the early rejection check inside `queryOrdino`.
3. Add the TODO comment.
4. Verify no other function bodies are modified.
5. Deploy edge function.
6. Report the diff and confirm other actions are untouched.