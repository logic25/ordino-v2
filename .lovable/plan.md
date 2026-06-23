## What broke
The "Teach Beacon" edit to `supabase/functions/beacon-proxy/index.ts` left the new admin/manager passthrough `if (action === "get_kb_gaps" || action === "dismiss_kb_gap" || action === "update_feedback_roadmap") { ... }` block (lines 130–166) without its closing `}`. As a result, every subsequent action handler (`chat`, `ingest`, `knowledge-list`, `file-content`, `content-generate`, and the final `else`/dispatch) is syntactically nested inside that `if`. Any non-Teach action falls through to the `fetch(beaconUrl!, ...)` at line 768 with `beaconUrl` undefined and errors out, which is why the Documents → Beacon Knowledge view shows "Beacon API Unreachable" (the upstream Railway service is fine — I curl'd it and it returns 200).

Brace audit of the file: 341 open `{` vs 340 close `}` — exactly one missing.

## Fix
Add the missing `}` to close the `if (action === "get_kb_gaps" || ...)` block right after its `return new Response(...)` at line 166, before the blank lines preceding `let beaconUrl`.

Concretely, change:

```
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });


    let beaconUrl: string;
```

to:

```
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let beaconUrl: string;
```

That's the entire fix — one character. Deploy is automatic.

## Verify
1. `curl` `beacon-proxy?action=knowledge-list` with a valid session — expect 200 + folder list (not 401/500).
2. Reload `/documents` → Beacon Knowledge Base view → folders/files render instead of the unreachable error.
3. Confirm the Teach Beacon tab still works (gaps load, dismiss works) — same code path, just now properly scoped.

## Not changing
- No frontend changes.
- No other edge function or RLS changes.
- No revert of the Teach Beacon work — it stays, just correctly braced.
