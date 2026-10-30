/** The API returns UTC timestamps without a zone suffix (SQLite); treat those as UTC, not local time. */
export function parseTs(ts: string): Date {
  return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts) ? ts : `${ts}Z`);
}
export const clock = (ts: string): string => parseTs(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const dateTime = (ts: string): string => parseTs(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
export function timeAgo(ts: string): string {
  const s = Math.max(0, Math.round((Date.now() - parseTs(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
