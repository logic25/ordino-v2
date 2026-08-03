/**
 * Turns raw Postgres/PostgREST errors into messages a user can act on,
 * with special handling for row-level-security denials so it's obvious
 * *which* permission check blocked the write.
 */

export interface RlsContext {
  /** Table the write targeted, e.g. "universal_documents". */
  table?: string;
  /** Human description of the role check enforced by the policy. */
  roleCheck?: string;
  /** What the user was trying to do, e.g. "rename this document". */
  action?: string;
}

type MaybeError = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

const RLS_CODES = new Set(["42501", "PGRST301"]);

export function isRlsError(err: MaybeError): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    (err.code && RLS_CODES.has(err.code)) ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("permission denied")
  );
}

export function describeWriteError(err: MaybeError, ctx: RlsContext = {}): string {
  const action = ctx.action ?? "make this change";
  if (isRlsError(err)) {
    const parts = [
      `Your account isn't allowed to ${action}.`,
      ctx.roleCheck
        ? `The database blocked it via the security policy on ${ctx.table ?? "this table"} — it requires: ${ctx.roleCheck}.`
        : `The database blocked it with a row-level security policy${ctx.table ? ` on ${ctx.table}` : ""}.`,
      "Ask an admin to grant you the role, or have them make the change.",
    ];
    return parts.join(" ");
  }
  return err?.message || "Something went wrong. Please try again.";
}

/**
 * PostgREST returns success with 0 affected rows when RLS hides the row
 * from the UPDATE — surface that as a permission problem, not a silent no-op.
 */
export function noRowsUpdatedMessage(ctx: RlsContext = {}): string {
  const action = ctx.action ?? "make this change";
  return `Nothing was updated — the record is either gone or hidden from your account by the security policy on ${
    ctx.table ?? "this table"
  }${ctx.roleCheck ? ` (requires: ${ctx.roleCheck})` : ""}. You may not have permission to ${action}.`;
}
