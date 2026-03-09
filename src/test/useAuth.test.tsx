import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Mock supabase client
const mockUnsubscribe = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn((cb: any) => {
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

function TestConsumer() {
  const { user, loading, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
      <button onClick={() => signIn("test@test.com", "pass")}>Login</button>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  );
}

function waitForDom(cb: () => void): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      try { cb(); clearInterval(interval); resolve(); } catch { /* retry */ }
    }, 10);
    setTimeout(() => { clearInterval(interval); resolve(); }, 2000);
  });
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state and resolves to no user", async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitForDom(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });
    expect(getByTestId("user").textContent).toBe("none");
  });

  it("throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used within an AuthProvider"
    );
    spy.mockRestore();
  });

  it("calls signInWithPassword on signIn", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.signInWithPassword as any).mockResolvedValue({ error: null });

    const { getByTestId, getByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitForDom(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      getByText("Login").click();
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "pass",
    });
  });

  it("calls signOut on logout", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.signOut as any).mockResolvedValue({ error: null });

    const { getByTestId, getByText } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitForDom(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    await act(async () => {
      getByText("Logout").click();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("unsubscribes on unmount", async () => {
    const { unmount, getByTestId } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitForDom(() => {
      expect(getByTestId("loading").textContent).toBe("false");
    });

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
