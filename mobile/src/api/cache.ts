/**
 * Last good response per API path, kept in memory for this visit only. Screens render it instantly on
 * return (then refresh from the server) instead of flashing a spinner. Nothing is saved on the phone: the
 * server is the one database. Cleared on sign-out so one person's data is never shown to the next person.
 */
type Entry = { data: unknown; at: number };

export const apiCache = new Map<string, Entry>();
export const clearApiCache = () => apiCache.clear();
