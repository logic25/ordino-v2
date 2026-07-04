# Security migration checklist

Apply this to every RLS / policy migration. No exceptions.

## Why this exists

`DROP POLICY IF EXISTS "guessed name"` fails **silently** when the name is wrong. Permissive policies OR together at runtime, so a stale self-write policy can survive a "fix" migration and leave the hole open. The `employee_compensation` hardening nearly shipped a no-op fix twice for exactly this reason.

## Before writing the migration

Look up the actual policy names — do not guess from labels in prior migrations:

```sql
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>'
ORDER BY cmd, policyname;
```

Use the exact `policyname` strings in every `DROP POLICY` statement.

## At the end of every RLS migration

Append the same `pg_policies` query as the last statement so the post-state is visible in the migration diff and in the run output.

## After the migration runs

Re-run the query and confirm:
- Policy **count** matches intent (no extra permissive policy left behind).
- `qual` and `with_check` bodies match intent (no self-ownership branch where you only wanted admin writes).
- For tables you just locked down, smoke-test a non-privileged `.update()` / `.insert()` and verify it gets an RLS denial — not success.

## Common traps

- Label-style names in old migrations (`"Users can update own compensation or admins can update all"`) often never existed in the DB; the real `policyname` is something short like `employee_compensation_update`.
- `CREATE POLICY ... IF NOT EXISTS` does not exist in Postgres — either drop first or use `CREATE OR REPLACE` patterns via `DO` blocks.
- Removing a `SECURITY DEFINER` RPC does **not** close a policy hole. The RLS policy must also be tightened.
