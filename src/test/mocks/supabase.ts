import { vi } from "vitest";

// Chainable query builder mock
function createQueryBuilder(resolvedData: any = null, resolvedError: any = null) {
  const builder: any = {
    _data: resolvedData,
    _error: resolvedError,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: builder._data, error: builder._error })
    ),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: builder._data, error: builder._error })
    ),
    then: undefined as any, // make it thenable for await
  };
  // Allow `await supabase.from("x").select("*")` etc.
  builder.then = (resolve: any) =>
    resolve({ data: Array.isArray(builder._data) ? builder._data : builder._data ? [builder._data] : [], error: builder._error, count: 0 });

  return builder;
}

export function createMockSupabase() {
  const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {};

  const mockSupabase = {
    from: vi.fn((table: string) => {
      if (!builders[table]) {
        builders[table] = createQueryBuilder();
      }
      return builders[table];
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    _builders: builders,
    _setTableData: (table: string, data: any, error: any = null) => {
      builders[table] = createQueryBuilder(data, error);
    },
  };

  return mockSupabase;
}
