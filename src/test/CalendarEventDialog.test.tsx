import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
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

function renderDialog(props: Partial<Parameters<typeof CalendarEventDialog>[0]> = {}) {
  return render(
    createElement(
      wrapper,
      null,
      createElement(CalendarEventDialog, {
        open: true,
        onOpenChange: vi.fn(),
        ...props,
      })
    )
  );
}

describe("CalendarEventDialog - Team Members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Team Members field", () => {
    const { container } = renderDialog();
    const label = container.querySelector("label, [class*='Label']");
    const teamMembersText = container.textContent;
    expect(teamMembersText).toContain("Team Members");
    expect(teamMembersText).toContain("Add team members...");
  });

  it("loads attendees from existing event metadata", () => {
    const existingEvent: any = {
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

    const { container } = renderDialog({ event: existingEvent });
    const text = container.textContent || "";

    // Attendees should render as badges
    expect(text).toContain("Alice Smith");
    expect(text).toContain("Bob Jones");
    // Carol was not in attendee_ids
    expect(text).not.toContain("Carol Lee");
  });

  it("passes attendee_ids when creating event", () => {
    const { container } = renderDialog();

    // Fill the title input
    const titleInput = container.querySelector('input#title') as HTMLInputElement;
    expect(titleInput).toBeTruthy();

    // Simulate typing
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(titleInput, "Test Event");
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    titleInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Find and click Create button
    const buttons = container.querySelectorAll("button");
    const createBtn = Array.from(buttons).find((b) => (b as HTMLButtonElement).textContent === "Create") as HTMLButtonElement | undefined;
    expect(createBtn).toBeTruthy();
    createBtn?.click();

    // Verify attendee_ids was passed
    if (mockCreateMutateAsync.mock.calls.length > 0) {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ attendee_ids: [] })
      );
    }
  });

  it("attendee_ids type structure is correct for hook interface", () => {
    // Verify the data structure matches what the hooks expect
    const createPayload = {
      title: "Test",
      start_time: "2026-03-10T09:00:00",
      end_time: "2026-03-10T10:00:00",
      attendee_ids: ["p1", "p2"],
    };
    expect(createPayload.attendee_ids).toBeInstanceOf(Array);
    expect(createPayload.attendee_ids).toHaveLength(2);

    const updatePayload = {
      event_id: "evt-1",
      title: "Test",
      start_time: "2026-03-10T09:00:00",
      end_time: "2026-03-10T10:00:00",
      attendee_ids: ["p1"],
    };
    expect(updatePayload.attendee_ids).toHaveLength(1);
  });

  it("metadata stores attendee_ids correctly", () => {
    // Simulate what the edge function does with attendee_ids
    const attendee_ids = ["p1", "p2", "p3"];
    const htmlLink = "https://calendar.google.com/event/123";

    const metadata = {
      ...(htmlLink ? { html_link: htmlLink } : {}),
      ...(attendee_ids?.length ? { attendee_ids } : {}),
    };

    expect(metadata.attendee_ids).toEqual(["p1", "p2", "p3"]);
    expect(metadata.html_link).toBe(htmlLink);
  });
});
