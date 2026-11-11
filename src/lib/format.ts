const KIGALI_OFFSET = "+02:00";

export function formatCurrency(
  minorUnits: number,
  currency = "RWF",
  options: { compact?: boolean } = {},
) {
  const amount = minorUnits / 100;
  const formatter = new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: options.compact ? 1 : 0,
    notation: options.compact ? "compact" : "standard",
  });
  return formatter.format(amount);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-RW").format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kigali",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kigali",
  }).format(date);
}

export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(date);
}

export function formatTimeRange(open: string, close: string) {
  return `${open} – ${close}`;
}

/** Start of the current day in Kigali local time, as a UTC instant. */
export function startOfBusinessDay(now = new Date()) {
  const iso = now.toISOString();
  const day = iso.slice(0, 10);
  return new Date(`${day}T00:00:00${KIGALI_OFFSET}`);
}

export function daysAgo(days: number, now = new Date()) {
  const start = startOfBusinessDay(now);
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

export { KIGALI_OFFSET };

/** Today's business date (Africa/Kigali) as YYYY-MM-DD. */
export function todayKigali(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "18:30" → 1110 minutes since midnight. */
export function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function timeFromMinutes(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(value: string, minutes: number) {
  return timeFromMinutes(minutesFromTime(value) + minutes);
}

export function formatDateLabel(value: string) {
  // Reservation dates are stored as plain YYYY-MM-DD business dates.
  const date = new Date(`${value}T12:00:00+02:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Kigali",
  }).format(date);
}
