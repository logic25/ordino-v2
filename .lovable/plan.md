

# Beacon Data Proxy: Column Aliases, Auto-Schema Hints, Better Errors

## Problem
When Beacon's AI guesses wrong column names (e.g. `tax_id` instead of `ein`), `query_ordino` returns a cryptic 500 error. The user sees "database is unavailable" — misleading and unhelpful.

## Three Changes

### 1. Column Alias Mapping in `query_ordino`
Add a static alias map that translates common synonyms to actual column names before building the query. Applied to both `select` and `filters`.

**File: `supabase/functions/beacon-data-proxy/index.ts`**

Add after the `BLOCKED_PATTERNS` constant (~line 361):

```typescript
const COLUMN_ALIASES: Record<string, Record<string, string>> = {
  companies: { tax_id: "ein", company_name: "name", tax_number: "ein" },
  invoices: { total_amount: "total_due", paid_amount: "payment_amount", amount_paid: "payment_amount" },
  services: { service_name: "name", fee: "fixed_price", price: "fixed_price" },
  projects: { pm: "assigned_pm_id", project_manager: "assigned_pm_id" },
  profiles: { goal: "monthly_goal", billing_goal: "monthly_goal", email: "email" },
};

function resolveAlias(table: string, column: string): string {
  return COLUMN_ALIASES[table]?.[column] || column;
}
```

In `queryOrdino`, apply `resolveAlias` to:
- Each filter's `column` field
- The `order.column` field
- Column names within `select` (split by comma, resolve each, rejoin)

### 2. Auto-Schema Hint on Query Errors
When `query_ordino` gets an error from Supabase, automatically call `describeTable` and return the schema alongside the error so Beacon can self-correct on retry.

In `queryOrdino`, change the error handler (~line 414-416):

```typescript
if (error) {
  // Auto-fetch schema hint for the table
  let schemaHint = null;
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (dbUrl) {
      const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
      const sql = postgres(dbUrl, { max: 1 });
      const rows = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} ORDER BY ordinal_position`;
      schemaHint = rows.map((r: any) => ({ name: r.column_name, type: r.data_type }));
      await sql.end();
    }
  } catch { /* ignore */ }

  return new Response(JSON.stringify({
    data: null,
    error: error.message,
    schema_hint: schemaHint,
    suggestion: schemaHint ? `Available columns: ${schemaHint.map((c:any) => c.name).join(", ")}` : null,
  }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

Status changes from 500 to 422 (Unprocessable Entity) to distinguish from actual server failures.

### 3. Improve Beacon Error Messages in Frontend
In `src/hooks/useAskOrdino.ts`, replace the generic catch-all error with a more specific message.

In the `catch` block (~line 93-100), parse the error to show what actually went wrong instead of "Sorry, I had trouble processing that":

```typescript
catch (err: any) {
  let content = "Something went wrong. Please try again in a moment.";
  const msg = err?.message || "";
  if (msg.includes("503") || msg.includes("unavailable")) {
    content = "The backend is temporarily unavailable. Try again in a minute.";
  } else if (msg.includes("429") || msg.includes("rate")) {
    content = "Too many requests — please wait a moment.";
  } else if (msg.includes("column") || msg.includes("does not exist")) {
    content = "I tried to look that up but used the wrong field name. Let me try again differently.";
  }
  setMessages((prev) => [...prev, { role: "assistant", content }]);
}
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/beacon-data-proxy/index.ts` | Add `COLUMN_ALIASES` map + `resolveAlias()`, apply in `queryOrdino`; return schema hint on errors with 422 status |
| `src/hooks/useAskOrdino.ts` | Replace generic error message with specific error categories |

