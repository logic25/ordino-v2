

## Speed Optimization: Add React Query Caching

### What we'll do
Add a global `staleTime` to the `QueryClient` so recently fetched data is served instantly from cache instead of re-fetching on every page visit. This is the remaining low-hanging fruit from your optimization list.

### Change
**`src/App.tsx`** — Update the QueryClient initialization:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes garbage collection
    },
  },
});
```

This means when you navigate away from a page and come back within 5 minutes, the data appears instantly (no spinner) while a background refresh runs if needed. This mirrors how the Laravel app felt — data was cached server-side, here it's cached client-side.

### What's already done
- Lazy loading (code-splitting into chunks) ✅
- Hover prefetching on sidebar links ✅

This is a one-line change — minimal risk, significant UX improvement.

