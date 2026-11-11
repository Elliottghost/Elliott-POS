/**
 * In-process kitchen event bus.
 *
 * The platform runs one Node process per venue (SQLite, single node), so a
 * module-level subscriber set is enough to fan a ticket change out to every
 * open kitchen screen in the same process. Subscribers are keyed by branch:
 * `null` means the whole group (super administrators), a branch id means that
 * house only.
 *
 * The set lives on `globalThis` so Next.js dev-server hot reloads do not leak
 * or duplicate listeners.
 */

export type KitchenEventType = "order.paid" | "order.fulfillment";

export interface KitchenEvent {
  type: KitchenEventType;
  branchId: string;
  orderId: string;
  orderNumber: string;
  fulfillmentStatus: string;
  /** Section that changed, or null when the whole ticket moved. */
  station?: string | null;
  at: string;
}

export interface KitchenSubscriber {
  branchId: string | null;
  send: (event: KitchenEvent) => void;
}

const globalForKitchen = globalThis as unknown as {
  __vistaKitchenSubscribers?: Set<KitchenSubscriber>;
};

const subscribers =
  globalForKitchen.__vistaKitchenSubscribers ??
  (globalForKitchen.__vistaKitchenSubscribers = new Set<KitchenSubscriber>());

export function subscribeToKitchen(
  branchId: string | null,
  send: (event: KitchenEvent) => void,
): () => void {
  const subscriber: KitchenSubscriber = { branchId, send };
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

/**
 * Fan out one event. A branch subscriber only hears its own branch; a group
 * subscriber hears every branch. A broken stream is dropped rather than
 * allowed to break the write that triggered it.
 */
export function publishKitchenEvent(event: KitchenEvent): void {
  for (const subscriber of [...subscribers]) {
    if (subscriber.branchId !== null && subscriber.branchId !== event.branchId) {
      continue;
    }
    try {
      subscriber.send(event);
    } catch {
      subscribers.delete(subscriber);
    }
  }
}

export function kitchenSubscriberCount(): number {
  return subscribers.size;
}

/** Test helper: detach every stream so suites do not leak into each other. */
export function resetKitchenSubscribers(): void {
  subscribers.clear();
}
