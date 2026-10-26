/**
 * Last good response per API path, kept in memory for the session. Screens render it instantly on return
 * (stale-while-revalidate) instead of flashing a spinner. Cleared on sign-out so one person's data is
 * never shown to the next person on a shared phone. Dependency-free so the auth store can import it.
 */
export const apiCache = new Map<string, { data: unknown; at: number }>();
export const clearApiCache = () => apiCache.clear();
