// Realtime broadcasts on the `emails` table were disabled for security
// (cross-tenant leak risk). This hook is intentionally a no-op; email lists
// refresh on navigation, manual refresh, and after sync operations.
export function useNewEmailNotifications() {
  // no-op
}
