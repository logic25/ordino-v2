
Goal: fix the remaining CitiSignal preflight failure by making the edge function return the exact CORS response your browser expects, then redeploy and verify it.

What I found
- The current `citisignal-sync` code does handle `OPTIONS`, but not in the exact shape you requested.
- Right now it returns:
  - no explicit `status: 200`
  - no `Access-Control-Allow-Methods`
  - a longer `Access-Control-Allow-Headers` list than the exact 4-header list you specified
- That mismatch is enough to cause preflight failures in stricter browser cases.
- `supabase/config.toml` already includes `[functions.citisignal-sync] verify_jwt = false`, so the issue is not JWT config.
- There are no recent runtime logs for `citisignal-sync`, which is consistent with preflight failing before the browser can complete the real POST flow.

Implementation plan
1. Update the edge function CORS block
- In `supabase/functions/citisignal-sync/index.ts`, replace the current preflight handling with the exact response:
```ts
if (req.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
```
- Also define the shared CORS headers to match this exact set, so every success/error response uses the same contract.

2. Keep all normal responses CORS-safe
- Ensure every `401`, `400`, `502`, `500`, and success response includes:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
- Keep `Content-Type: application/json` on JSON responses.

3. Force redeploy only this function
- Redeploy `citisignal-sync` so the hosted version cannot remain stale.
- This is important because the repo code and the deployed version may currently be out of sync.

4. Verify preflight explicitly
- Test the deployed function with an `OPTIONS` request and confirm:
  - status is exactly `200`
  - response body is empty/null
  - headers match exactly:
    - `Access-Control-Allow-Origin: *`
    - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
    - `Access-Control-Allow-Methods: POST, OPTIONS`

5. Verify the real browser flow
- Re-test the property page refresh flow for the current property.
- Confirm the browser no longer shows “Failed to fetch” for `citisignal-sync`.
- Confirm the POST reaches the function and then either:
  - succeeds with CitiSignal data, or
  - cleanly falls back to Socrata if CitiSignal itself returns an upstream error.

Technical details
- File to update: `supabase/functions/citisignal-sync/index.ts`
- No database changes are needed for this bug.
- `supabase/config.toml` likely does not need further changes.
- The likely root cause is not “missing OPTIONS logic” but “preflight response shape does not exactly match the browser’s requested contract.”

Expected result
- The browser preflight succeeds.
- `citisignal-sync` becomes reachable from the app.
- Property refresh can use CitiSignal first, then fallback normally if the upstream API fails.
