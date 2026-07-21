// Shared helpers for MCP tools. Runs inside the generated Supabase edge function.
// Uses ONLY the publishable anon key + the caller's bearer token so RLS applies.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Hard caps enforced across every list/search tool. No unbounded pagination.
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)
  .describe(`Max rows to return. Default ${DEFAULT_LIMIT}, hard cap ${MAX_LIMIT}.`);

/** Build a Supabase client scoped to the calling user. RLS runs as that user. */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  // `process.env` is provided by the Deno edge-function runtime that bundles
  // this module. Declared as `any` so the frontend TS config doesn't need
  // @types/node — this file only ever runs server-side.
  const env = (globalThis as any).process?.env ?? {};
  const url = env.SUPABASE_URL as string;
  const anon = (env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY) as string;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Wrap a tool handler with auth + audit logging. Every call — success or
 * failure — writes a row to public.mcp_audit_log via the user-scoped client.
 * Tokens are NEVER logged.
 */
export function withAudit<TInput extends Record<string, unknown>, TOutput>(
  toolName: string,
  fn: (input: TInput, ctx: ToolContext, sb: SupabaseClient) => Promise<TOutput>,
) {
  return async (input: TInput, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const started = Date.now();
    let status: "ok" | "empty" | "error" = "ok";
    let errorMessage: string | null = null;
    try {
      const result = await fn(input, ctx, sb);
      // Detect empty-result convention: handlers may attach { _empty: true }
      if ((result as any)?._empty) status = "empty";
      return result as any;
    } catch (err) {
      status = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${errorMessage}` }],
        isError: true,
      };
    } finally {
      // Fire-and-forget audit write. Failure to log MUST NOT break the tool
      // response, but we swallow errors quietly (never surface DB errors to the
      // AI client).
      try {
        // Resolve caller's company_id from their profile so admins can filter.
        const { data: profile } = await sb
          .from("profiles")
          .select("company_id")
          .eq("id", ctx.getUserId())
          .maybeSingle();
        await sb.from("mcp_audit_log").insert({
          user_id: ctx.getUserId(),
          company_id: profile?.company_id ?? null,
          tool_name: toolName,
          parameters: sanitizeParams(input),
          result_status: status,
          error_message: errorMessage,
          oauth_client_id: ctx.getClientId?.() ?? null,
        });
      } catch {
        // ignore
      }
      // eslint-disable-next-line no-console
      console.log(`[mcp:${toolName}] ${status} ${Date.now() - started}ms`);
    }
  };
}

/** Strip anything that looks like a secret before persisting to the audit log. */
function sanitizeParams(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (/token|secret|password|apikey|bearer/i.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function ok(text: string, structured?: unknown) {
  const content: any[] = [{ type: "text", text }];
  const res: any = { content };
  if (structured !== undefined) res.structuredContent = structured;
  return res;
}

export function empty(text = "No matching rows visible to you.") {
  return { ...ok(text, { rows: [] }), _empty: true };
}
