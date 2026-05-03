/** Formats an ISO start/end pair for staff or customer readouts (local timezone). */
export function formatScheduleWindowDisplay(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  const sameDay =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (sameDay) {
    return `${a.toLocaleString(undefined, opts)} – ${b.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  return `${a.toLocaleString(undefined, opts)} – ${b.toLocaleString(undefined, opts)}`;
}
