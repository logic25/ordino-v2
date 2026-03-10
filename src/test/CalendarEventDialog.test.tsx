import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { CalendarEventDialog } from "@/components/calendar/CalendarEventDialog";

// ── Mock hooks ──────────────────────────────────────────
const mockCreateMutateAsync = vi.fn().mockResolvedValue({});
const mockUpdateMutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/useCalendarEvents", () => ({
  useCreateCalendarEvent: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateCalendarEvent: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({ data: [] }),
}));

vi.mock("@/hooks/useProfiles", () => ({
  useAssignableProfiles: () => ({
    data: [
      { id: "p1", first_name: "Alice", last_name: "Smith" },
      { id: "p2", first_name: "Bob", last_name: "Jones" },
      { id: "p3", first_name: "Carol", last_name: "Lee" },
    ],
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

describe("CalendarEventDialog - Team Members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Team Members field", () => {
    render(
      createElement(
        wrapper,
        null,
        createElement(CalendarEventDialog, {
          open: true,
          onOpenChange: vi.fn(),
        })
      )
    );
    expect(screen.getByText("Team Members")).toBeInTheDocument();
    expect(screen.getByText("Add team members...")).toBeInTheDocument();
  });

  it("opens popover and shows team member checkboxes", async () => {
    render(
      createElement(
        wrapper,
        null,
        createElement(CalendarEventDialog, {
          open: true,
          onOpenChange: vi.fn(),
        })
      )
    );

    // Click the team members button to open popover
    fireEvent.click(screen.getByText("Add team members..."));

    // Should show team members
    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("Carol Lee")).toBeInTheDocument();
  });

  it("loads attendees from existing event metadata", () => {
    const existingEvent = {
      id: "evt-1",
      company_id: "c1",
      user_id: "u1",
      google_event_id: null,
      google_calendar_id: null,
      title: "Team Standup",
      description: null,
      location: null,
      start_time: "2026-03-10T09:00:00",
      end_time: "2026-03-10T10:00:00",
      all_day: false,
      event_type: "meeting",
      project_id: null,
      property_id: null,
      client_id: null,
      application_id: null,
      source_email_id: null,
      reminder_minutes: null,
      status: "confirmed",
      sync_status: "local",
      metadata: { attendee_ids: ["p1", "p2"] },
      created_at: "2026-03-10T00:00:00",
      updated_at: "2026-03-10T00:00:00",
    };

    render(
      createElement(
        wrapper,
        null,
        createElement(CalendarEventDialog, {
          open: true,
          onOpenChange: vi.fn(),
          event: existingEvent,
        })
      )
    );

    // Should show selected attendees as badges
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("passes attendee_ids when creating event", async () => {
    const onOpenChange = vi.fn();
    render(
      createElement(
        wrapper,
        null,
        createElement(CalendarEventDialog, {
          open: true,
          onOpenChange,
        })
      )
    );

    // Fill title
    fireEvent.change(screen.getByPlaceholderText("DOB Inspection, Client Meeting..."), {
      target: { value: "Test Event" },
    });

    // Click Create
    fireEvent.click(screen.getByText("Create"));

    // Verify mutateAsync was called with attendee_ids (empty array since none selected)
    expect(mockCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Event",
        attendee_ids: [],
      })
    );
  });
});
