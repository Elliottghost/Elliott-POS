import {
  KITCHEN_STATUSES,
  type KitchenStatus,
} from "@/lib/validation";

/** Preparation sections a dish can be routed to. */
export const KITCHEN_STATIONS = ["kitchen", "bar", "pastry"] as const;

export type KitchenStation = (typeof KITCHEN_STATIONS)[number];

export const STATION_LABELS: Record<KitchenStation, string> = {
  kitchen: "Food",
  bar: "Bar",
  pastry: "Dessert",
};

export const STATION_HINTS: Record<KitchenStation, string> = {
  kitchen: "Hot line and savoury dishes",
  bar: "Drinks, cocktails and coffee",
  pastry: "Desserts and fruit",
};

export function isKitchenStation(value: unknown): value is KitchenStation {
  return (
    typeof value === "string" &&
    (KITCHEN_STATIONS as readonly string[]).includes(value)
  );
}

export function stationLabel(station: string | null | undefined): string | null {
  return isKitchenStation(station) ? STATION_LABELS[station] : null;
}

/**
 * A ticket's progress for one station: it is served once every line is served,
 * ready once nothing is still being worked on, queued while nothing started,
 * and preparing in between. An order is the roll-up of all of its lines.
 */
export function rollupKitchenStatus(statuses: string[]): KitchenStatus {
  const known = statuses.filter((status): status is KitchenStatus =>
    (KITCHEN_STATUSES as readonly string[]).includes(status),
  );

  if (known.length === 0) return "served";
  if (known.every((status) => status === "served")) return "served";
  if (known.every((status) => status === "ready" || status === "served")) {
    return "ready";
  }
  if (known.every((status) => status === "queued")) return "queued";
  return "preparing";
}

/** Forward moves plus a one-step recall, shared by the service and tests. */
export const ALLOWED_TRANSITIONS: Record<string, KitchenStatus[]> = {
  queued: ["preparing"],
  preparing: ["ready", "queued"],
  ready: ["served", "preparing"],
  served: ["ready"],
};
