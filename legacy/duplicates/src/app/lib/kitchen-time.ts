/** Prep-time maths shared by the kitchen service, board and tests. */

/** Used when no dish on the ticket declares a preparation time. */
export const DEFAULT_PREP_MINUTES = 15;

/**
 * A ticket is done when its slowest dish is done, so the longest prep time on
 * the ticket wins. Zero and missing values are ignored.
 */
export function targetPrepMinutes(
  values: Array<number | null | undefined>,
): number {
  const longest = values.reduce<number>((max, value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return max;
    }
    return Math.max(max, Math.round(value));
  }, 0);
  return longest > 0 ? longest : DEFAULT_PREP_MINUTES;
}

export interface TicketTiming {
  dueAt: number;
  isLate: boolean;
  /** Whole minutes past the target; 0 while still on time or in the due minute. */
  minutesLate: number;
  /** Whole minutes left; 0 once the target is reached. */
  minutesLeft: number;
}

export function ticketTiming(
  paidAt: Date | string | null | undefined,
  prepMinutes: number,
  now: number = Date.now(),
): TicketTiming | null {
  if (!paidAt) return null;
  const dueAt = new Date(paidAt).getTime() + prepMinutes * 60_000;
  const delta = now - dueAt;
  return {
    dueAt,
    isLate: delta >= 0,
    minutesLate: delta > 0 ? Math.floor(delta / 60_000) : 0,
    minutesLeft: delta < 0 ? Math.ceil(-delta / 60_000) : 0,
  };
}
