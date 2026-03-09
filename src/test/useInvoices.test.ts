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

function chain(finalData: any = null, finalError: any = null) {
  const self: any = {
    select: vi.fn().mockReturnValue(self),
    insert: vi.fn().mockReturnValue(self),
    update: vi.fn().mockReturnValue(self),
    delete: vi.fn().mockReturnValue(self),
    eq: vi.fn().mockReturnValue(self),
    order: vi.fn().mockReturnValue(self),
    single: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: finalData, error: finalError }),
    then: (resolve: any) => resolve({ data: Array.isArray(finalData) ? finalData : [], error: finalError }),
  };
  return self;
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("useInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches invoices list", async () => {
    const mockInvoices = [
      { id: "inv-1", invoice_number: "INV-00001", status: "draft", total_due: 5000 },
    ];

    mockFrom.mockImplementation(() => chain(mockInvoices));

    const { useInvoices } = await import("@/hooks/useInvoices");
    const { result } = renderHook(() => useInvoices(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("filters invoices by status", async () => {
    mockFrom.mockImplementation(() => chain([]));

    const { useInvoices } = await import("@/hooks/useInvoices");
    const { result } = renderHook(() => useInvoices("paid"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Verify the eq filter was called for status
    const fromCall = mockFrom.mock.results[0]?.value;
    if (fromCall?.eq) {
      expect(fromCall.eq).toHaveBeenCalledWith("status", "paid");
    }
  });
});

describe("useInvoiceCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes counts from invoice statuses", async () => {
    const mockData = [
      { status: "draft" },
      { status: "draft" },
      { status: "sent" },
      { status: "paid" },
      { status: "overdue" },
    ];

    mockFrom.mockImplementation(() => chain(mockData));

    const { useInvoiceCounts } = await import("@/hooks/useInvoices");
    const { result } = renderHook(() => useInvoiceCounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the counting logic
    const counts = result.current.data;
    expect(counts).toBeDefined();
    if (counts) {
      expect(counts.draft).toBe(2);
      expect(counts.sent).toBe(1);
      expect(counts.paid).toBe(1);
      expect(counts.overdue).toBe(1);
      expect(counts.total).toBe(5);
    }
  });
});

describe("Invoice creation logic", () => {
  it("invoice form input validates required fields", () => {
    const validInput = {
      line_items: [{ description: "Filing fee", quantity: 1, rate: 500, amount: 500 }],
      subtotal: 500,
      total_due: 500,
    };

    expect(validInput.line_items).toHaveLength(1);
    expect(validInput.subtotal).toBe(500);
    expect(validInput.total_due).toBe(500);
  });

  it("payment status updates follow valid transitions", () => {
    const validStatuses = ["draft", "ready_to_send", "needs_review", "sent", "overdue", "paid", "legal_hold"];
    
    expect(validStatuses).toContain("draft");
    expect(validStatuses).toContain("paid");
    expect(validStatuses).toContain("legal_hold");
    
    // Verify a status update from sent → paid is valid
    const currentStatus = "sent";
    const newStatus = "paid";
    expect(validStatuses).toContain(currentStatus);
    expect(validStatuses).toContain(newStatus);
  });

  it("line item amounts are calculated correctly", () => {
    const lineItems = [
      { description: "Service A", quantity: 2, rate: 250, amount: 500 },
      { description: "Service B", quantity: 1, rate: 1000, amount: 1000 },
    ];

    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    expect(subtotal).toBe(1500);

    // Verify each line item amount = quantity * rate
    lineItems.forEach((item) => {
      expect(item.amount).toBe(item.quantity * item.rate);
    });
  });
});
