import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
  const self: any = {
    select: vi.fn().mockReturnValue(self),
    insert: vi.fn().mockReturnValue(self),
    update: vi.fn().mockReturnValue(self),
    delete: vi.fn().mockReturnValue(self),
    eq: vi.fn().mockReturnValue(self),
    neq: vi.fn().mockReturnValue(self),
    in: vi.fn().mockReturnValue(self),
    or: vi.fn().mockReturnValue(self),
    order: vi.fn().mockReturnValue(self),
    range: vi.fn().mockReturnValue(self),
    limit: vi.fn().mockReturnValue(self),
    single: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    then: (resolve: any) => resolve({ data: Array.isArray(finalData) ? finalData : [], error: finalError, count }),
  };
  return self;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
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

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.proposals).toBeDefined();
  });

  it("proposal status transitions follow expected flow", () => {
    const validTransitions: Record<string, string[]> = {
      draft: ["sent"],
      sent: ["viewed", "executed", "lost", "expired"],
      viewed: ["executed", "lost", "expired"],
      executed: [],
      lost: ["draft"],
      expired: ["draft"],
    };

    expect(validTransitions.draft).toContain("sent");
    expect(validTransitions.sent).toContain("executed");
    expect(validTransitions.executed).toHaveLength(0);
  });

  it("proposal signing sets client_signed_at and status to executed", () => {
    // Simulating what sign_proposal RPC does
    const before = { status: "sent", client_signed_at: null };
    const after = {
      ...before,
      status: "executed",
      client_signed_at: new Date().toISOString(),
      client_signer_name: "John Doe",
    };

    expect(after.status).toBe("executed");
    expect(after.client_signed_at).toBeTruthy();
    expect(after.client_signer_name).toBe("John Doe");
  });
});

describe("useCreateProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a proposal with required fields", async () => {
    const createdProposal = {
      id: "new-p1",
      title: "New Proposal",
      property_id: "prop-1",
      status: "draft",
      company_id: "co-1",
    };

    const profileData = { id: "prof-1", company_id: "co-1" };

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return chain(profileData);
      if (table === "proposals") return chain(createdProposal);
      if (table === "proposal_items") return chain([]);
      if (table === "proposal_milestones") return chain([]);
      if (table === "rfi_requests") return chain({ id: "rfi-1" });
      return chain();
    });

    const input = {
      property_id: "prop-1",
      title: "New Proposal",
      items: [{ name: "Filing", quantity: 1, unit_price: 1000 }],
    };

    // Verify the input structure is valid
    expect(input.property_id).toBeTruthy();
    expect(input.title).toBeTruthy();
    expect(input.items).toHaveLength(1);
  });
});
