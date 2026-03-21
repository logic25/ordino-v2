import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectStatusBadge } from "@/components/ui/ProjectStatusBadge";

describe("ProjectStatusBadge", () => {
  it("renders null for null status", () => {
    const { container } = render(<ProjectStatusBadge status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders known status with correct label", () => {
    render(<ProjectStatusBadge status="open" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders on_hold status", () => {
    render(<ProjectStatusBadge status="on_hold" />);
    expect(screen.getByText("On Hold")).toBeInTheDocument();
  });

  it("renders unknown status with formatted label", () => {
    render(<ProjectStatusBadge status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<ProjectStatusBadge status="open" className="extra-class" />);
    const badge = screen.getByText("Open");
    expect(badge.className).toContain("extra-class");
  });
});
