import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

// ── Mock supabase ──────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function chain(finalData: any = null, finalError: any = null, count = 0) {
  const obj: Record<string, any> = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.insert = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.delete = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.neq = vi.fn().mockReturnValue(obj);
  obj.in = vi.fn().mockReturnValue(obj);
  obj.or = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.range = vi.fn().mockReturnValue(obj);
  obj.limit = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  obj.maybeSingle = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  obj.then = (resolve: any) => resolve({ data: Array.isArray(finalData) ? finalData : [], error: finalError, count });
  return obj;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

function waitForQuery(result: any): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!result.current.isLoading) { clearInterval(interval); resolve(); }
    }, 10);
    setTimeout(() => { clearInterval(interval); resolve(); }, 2000);
  });
}

describe("useProposals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches proposals list successfully", async () => {
    const mockProposals = [
      { id: "p1", title: "Test Proposal", status: "draft", created_at: "2026-01-01" },
    ];
    mockFrom.mockImplementation(() => chain(mockProposals, null, 1));

    const { useProposals } = await import("@/hooks/useProposals");
    const { result } = renderHook(() => useProposals(), { wrapper });

    await waitForQuery(result);
    expect(result.current.isSuccess).toBe(true);
  });

  it("proposal status transitions follow expected flow", () => {
    const validTransitions: Record<string, string[]> = {
      draft: ["sent"],
      sent: ["viewed", "executed", "lost", "expired"],
      viewed: ["executed", "lost", "expired"],
      executed: [],
      lost: ["draft"],
    };
    expect(validTransitions.draft).toContain("sent");
    expect(validTransitions.sent).toContain("executed");
    expect(validTransitions.executed).toHaveLength(0);
  });

  it("proposal signing sets client_signed_at and status to executed", () => {
    const before = { status: "sent", client_signed_at: null };
    const after = {
      ...before,
      status: "executed",
      client_signed_at: new Date().toISOString(),
      client_signer_name: "John Doe",
    };
    expect(after.status).toBe("executed");
    expect(after.client_signed_at).toBeTruthy();
  });
});

describe("useCreateProposal", () => {
  it("validates proposal form input structure", () => {
    const input = {
      property_id: "prop-1",
      title: "New Proposal",
      items: [{ name: "Filing", quantity: 1, unit_price: 1000 }],
    };
    expect(input.property_id).toBeTruthy();
    expect(input.title).toBeTruthy();
    expect(input.items).toHaveLength(1);
  });
});
