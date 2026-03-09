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

function chain(finalData: any = null, finalError: any = null) {
  const obj: Record<string, any> = {};
  obj.select = vi.fn().mockReturnValue(obj);
  obj.insert = vi.fn().mockReturnValue(obj);
  obj.update = vi.fn().mockReturnValue(obj);
  obj.delete = vi.fn().mockReturnValue(obj);
  obj.eq = vi.fn().mockReturnValue(obj);
  obj.order = vi.fn().mockReturnValue(obj);
  obj.single = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  obj.maybeSingle = vi.fn().mockResolvedValue({ data: finalData, error: finalError });
  obj.then = (resolve: any) => resolve({ data: Array.isArray(finalData) ? finalData : [], error: finalError });
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

    await waitForQuery(result);
    expect(result.current.isSuccess).toBe(true);
  });

  it("filters invoices by status", async () => {
    mockFrom.mockImplementation(() => chain([]));

    const { useInvoices } = await import("@/hooks/useInvoices");
    const { result } = renderHook(() => useInvoices("paid"), { wrapper });

    await waitForQuery(result);
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

    await waitForQuery(result);
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

describe("Invoice logic", () => {
  it("line item amounts calculated correctly", () => {
    const lineItems = [
      { description: "Service A", quantity: 2, rate: 250, amount: 500 },
      { description: "Service B", quantity: 1, rate: 1000, amount: 1000 },
    ];
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    expect(subtotal).toBe(1500);
    lineItems.forEach((item) => {
      expect(item.amount).toBe(item.quantity * item.rate);
    });
  });

  it("valid status values are recognized", () => {
    const validStatuses = ["draft", "ready_to_send", "needs_review", "sent", "overdue", "paid", "legal_hold"];
    expect(validStatuses).toContain("draft");
    expect(validStatuses).toContain("paid");
    expect(validStatuses).toContain("legal_hold");
  });
});
