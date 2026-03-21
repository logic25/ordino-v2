import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TotalsSection } from "@/components/invoices/invoice-detail/TotalsSection";

const makeInvoice = (overrides = {}) => ({
  id: "inv-1",
  invoice_number: "INV-001",
  status: "draft" as const,
  subtotal: 1000,
  total_due: 900,
  retainer_applied: 100,
  ...overrides,
} as any);

describe("TotalsSection", () => {
  it("renders subtotal and total due", () => {
    render(<TotalsSection invoice={makeInvoice()} />);
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Total Due")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("$900.00")).toBeInTheDocument();
  });

  it("shows deposit applied when retainer > 0", () => {
    render(<TotalsSection invoice={makeInvoice({ retainer_applied: 200 })} />);
    expect(screen.getByText("Deposit Applied")).toBeInTheDocument();
    expect(screen.getByText("-$200.00")).toBeInTheDocument();
  });

  it("hides deposit line when retainer is 0", () => {
    render(<TotalsSection invoice={makeInvoice({ retainer_applied: 0 })} />);
    expect(screen.queryByText("Deposit Applied")).not.toBeInTheDocument();
  });
});
