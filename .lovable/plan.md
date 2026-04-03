

# Fix: beacon-data-proxy BOOT_ERROR — Duplicate `BLOCKED_TABLES` Declaration

## Problem
The edge function fails to start with: `Identifier 'BLOCKED_TABLES' has already been declared at line 451:7` (compiled line). The `describe_table` action added a second `const BLOCKED_TABLES` (line 554, a RegExp) when one already exists (line 357, a Set).

## Fix
Rename the RegExp on line 554 from `BLOCKED_TABLES` to `DESCRIBE_BLOCKED` (or similar), and update its reference on line 559. That's the entire fix — one rename, two lines changed.

### File: `supabase/functions/beacon-data-proxy/index.ts`

| Line | Change |
|------|--------|
| 554 | Rename `const BLOCKED_TABLES = /auth|secret|.../i` to `const DESCRIBE_BLOCKED_PATTERN = /auth|secret|.../i` |
| 559 | Change `BLOCKED_TABLES.test(table)` to `DESCRIBE_BLOCKED_PATTERN.test(table)` |

After the edit, redeploy `beacon-data-proxy` and verify it boots successfully.

