"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { advanceFulfillmentAction } from "./actions";
import type { KitchenOrder } from "@/services/kitchen";
import { formatCurrency } from "@/lib/format";
import { ticketTiming } from "@/lib/kitchen-time";
import { stationLabel } from "@/lib/kitchen-stations";

const COLUMNS = [
  { status: "queued", title: "Queued", hint: "Paid, waiting to start" },
  { status: "preparing", title: "Preparing", hint: "On the line" },
  { status: "ready", title: "Ready", hint: "Waiting to be served" },
] as const;

const CHANNEL_LABELS: Record<string, string> = {
  dine_in: "Dine in",
  takeaway: "Takeaway",
  bar: "Bar",
  room_service: "Room service",
};

function tone(
  context: AudioContext,
  frequency: number,
  at: number,
  duration: number,
  volume: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

/** Short confirmation so staff know the alarm is armed. */
function playConfirmChime(context: AudioContext) {
  const start = context.currentTime;
  tone(context, 740, start, 0.14, 0.12);
  tone(context, 988, start + 0.16, 0.16, 0.12);
}

/** Two rising pairs — unmistakable across a busy pass, still under a second. */
function playLateAlarm(context: AudioContext) {
  const start = context.currentTime;
  [0, 0.24, 0.48, 0.72].forEach((offset, index) => {
    tone(context, index % 2 === 0 ? 880 : 660, start + offset, 0.18, 0.24);
  });
}

function OrderCard({
  order,
  currency,
  canManage,
  now,
  showStation,
  returnTo,
  station,
}: {
  order: KitchenOrder;
  currency: string;
  canManage: boolean;
  now: number;
  showStation: boolean;
  returnTo: string;
  station?: string;
}) {
  const timing = ticketTiming(order.paidAt, order.targetPrepMinutes, now);
  const late = timing?.isLate ?? false;
  const waitMinutes = order.paidAt
    ? Math.max(0, Math.round((now - new Date(order.paidAt).getTime()) / 60000))
    : 0;
  const badgeTone = late
    ? "border-danger bg-danger text-white animate-pulse motion-reduce:animate-none"
    : timing && timing.minutesLeft <= 5
      ? "border-ember/40 bg-ember-soft text-ember-strong"
      : "border-line bg-sand text-muted";
  const timingLabel = timing
    ? late
      ? timing.minutesLate > 0
        ? `${timing.minutesLate} min late`
        : "Due now"
      : `${timing.minutesLeft} min left`
    : "No payment time";
  const next =
    order.stationStatus === "queued"
      ? { status: "preparing", label: "Start preparing" }
      : order.stationStatus === "preparing"
        ? { status: "ready", label: "Mark ready" }
        : { status: "served", label: "Mark served" };

  return (
    <article
      className={`rounded-xl border bg-white p-3.5 shadow-card ${
        late ? "border-danger/60 ring-2 ring-danger/15" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[17px] leading-tight text-ink">
            {order.orderNumber.split("-").slice(-1)[0]}
            <span className="ml-1.5 align-middle text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-muted">
              {order.branchCode}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {CHANNEL_LABELS[order.channel] ?? order.channel}
            {order.tableLabel ? ` · Table ${order.tableLabel}` : ""}
            {order.guestCount ? ` · ${order.guestCount} guests` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${badgeTone}`}
          title={`Target ${order.targetPrepMinutes} min · paid ${waitMinutes} min ago`}
        >
          {timingLabel}
        </span>
      </div>

      {order.customerName ? (
        <p className="mt-1.5 truncate text-[12px] font-medium text-ink/80">
          {order.customerName}
        </p>
      ) : null}

      <ul className="mt-2 space-y-1 border-t border-line/70 pt-2">
        {order.items.length === 0 ? (
          <li className="text-[11.5px] text-muted">No item lines captured.</li>
        ) : (
          order.items.map((item) => (
            <li
              key={`${item.name}-${item.notes ?? ""}`}
              className="flex items-start justify-between gap-2 text-[12.5px] text-ink"
            >
              <span className="min-w-0">
                <span className="font-semibold tabular-nums text-ember-strong">
                  {item.quantity}×
                </span>{" "}
                {item.name}
                {showStation && stationLabel(item.station) ? (
                  <span className="ml-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {stationLabel(item.station)}
                  </span>
                ) : null}
                {item.notes ? (
                  <span className="block text-[11px] italic text-muted">
                    {item.notes}
                  </span>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>

      {order.notes ? (
        <p className="mt-2 rounded-md bg-sand/60 px-2 py-1.5 text-[11.5px] leading-relaxed text-ink/75">
          <span className="font-semibold">Note: </span>
          {order.notes}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <span className="text-[11px] text-muted tabular-nums">
          {formatCurrency(order.total, currency)} ·{" "}
          {order.createdByName ?? "front desk"}
        </span>
        {canManage ? (
          <form action={advanceFulfillmentAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="status" value={next.status} />
            <input type="hidden" name="station" value={station ?? ""} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <SubmitButton
              size="sm"
              variant={next.status === "served" ? "secondary" : "ember"}
              pendingLabel="…"
              className="h-8 text-[11.5px]"
            >
              {next.label}
            </SubmitButton>
          </form>
        ) : (
          <Link
            href={`/orders/${order.id}`}
            className="text-[11.5px] font-semibold text-ember-strong hover:underline"
          >
            View order
          </Link>
        )}
      </div>
    </article>
  );
}

export function KitchenBoard({
  orders,
  currency,
  canManage,
  branchFilter,
  station,
}: {
  orders: KitchenOrder[];
  currency: string;
  canManage: boolean;
  branchFilter?: string;
  station?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(true);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);

  const scheduleRefresh = useCallback(() => {
    // Coalesce a burst of tickets (a round of drinks, or several moves at
    // once) into one server render.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 120);
  }, [router]);

  // Server-sent events (`/api/kitchen/stream`) keep the board live.
  // Tickets, moves and serves arrive as `kitchen` events and trigger
  // `scheduleRefresh` → `router.refresh()` → data re-fetch.
  // The local `now` clock is set on mount; it is intentionally not
  // re-pollled every 10s. Alarm timing uses this initial timestamp;
  // a refresh via SSE will update it.",

  const enableAlarm = useCallback(async () => {
    if (soundOn) {
      setSoundOn(false);
      return;
    }
    try {
      const AudioCtor =
        window.AudioContext ??
        (
          window as unknown as {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioCtor) return;
      const context = audioRef.current ?? new AudioCtor();
      audioRef.current = context;
      await context.resume();
      setSoundOn(true);
      playConfirmChime(context);
    } catch {
      setSoundOn(false);
    }
  }, [soundOn]);

  // Fire once per ticket as it crosses its prep target. Tickets already late
  // when the screen opens are marked as seen, so a page load never blasts the
  // room — the banner still shows them.
  useEffect(() => {
    const currentLate = new Set(
      orders
        .filter(
          (order) =>
            ticketTiming(order.paidAt, order.targetPrepMinutes, now)?.isLate,
        )
        .map((order) => order.id),
    );

    for (const id of [...alertedRef.current]) {
      if (!currentLate.has(id)) alertedRef.current.delete(id);
    }

    if (!seededRef.current) {
      for (const id of currentLate) alertedRef.current.add(id);
      seededRef.current = true;
      return;
    }

    const fresh = [...currentLate].filter(
      (id) => !alertedRef.current.has(id),
    );
    if (fresh.length === 0) return;
    fresh.forEach((id) => alertedRef.current.add(id));

    const context = audioRef.current;
    if (soundOn && context) {
      void context
        .resume()
        .then(() => playLateAlarm(context))
        .catch(() => undefined);
    }
  }, [orders, now, soundOn]);

  useEffect(() => {
    if (!live) {
      setConnection("connecting");
      return;
    }

    const streamParams = new URLSearchParams();
    if (branchFilter) streamParams.set("branch", branchFilter);
    if (station) streamParams.set("station", station);
    const url = `/api/kitchen/stream${
      streamParams.toString() ? `?${streamParams}` : ""
    }`;
    const source = new EventSource(url);

    // The stream opens with a `ready` event; any ticket change arrives as
    // `kitchen`. The browser reconnects by itself if the connection drops.
    source.addEventListener("ready", () => {
      setConnection("live");
      setLastRefresh(new Date());
      // Also covers a reconnect: anything missed while the stream was down is
      // picked up immediately instead of waiting for the next ticket.
      scheduleRefresh();
    });
    source.addEventListener("kitchen", scheduleRefresh);
    source.onopen = () => setConnection("live");
    source.onerror = () => setConnection("reconnecting");

    return () => {
      source.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [branchFilter, station, live, scheduleRefresh]);

  useEffect(() => {
    if (!live) return;
    const onVisible = () => {
      // A sleeping screen can miss events; catch up when it wakes.
      if (!document.hidden) scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [live, scheduleRefresh]);

  const lateTickets = orders.filter(
    (order) => ticketTiming(order.paidAt, order.targetPrepMinutes, now)?.isLate,
  );
  const oldestLateMinutes = lateTickets.reduce((oldest, order) => {
    const timing = ticketTiming(order.paidAt, order.targetPrepMinutes, now);
    return Math.max(oldest, timing?.minutesLate ?? 0);
  }, 0);

  const routeParams = new URLSearchParams();
  if (branchFilter) routeParams.set("branch", branchFilter);
  if (station) routeParams.set("station", station);
  const returnTo = `/kitchen${
    routeParams.toString() ? `?${routeParams}` : ""
  }`;

  const statusLabel = !live
    ? "Updates paused"
    : connection === "live"
      ? "Live"
      : connection === "reconnecting"
        ? "Reconnecting…"
        : "Connecting…";
  const statusHint = !live
    ? "Resume to receive new tickets"
    : connection === "live"
      ? `push updates${
          lastRefresh
            ? ` · last ${lastRefresh.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""
        }`
      : "keeping the board open";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span
            className={`h-2 w-2 rounded-full ${
              live && connection === "live"
                ? "animate-pulse bg-success"
                : live
                  ? "animate-pulse bg-ember"
                  : "bg-muted"
            }`}
          />
          <span>
            {statusLabel} · {statusHint}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void enableAlarm();
            }}
            aria-pressed={soundOn}
            title={
              soundOn
                ? "Alarm armed — a chime plays when a ticket passes its prep time. Click to mute."
                : "Play a chime when a paid ticket passes its prep time."
            }
            className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold ${
              soundOn
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-line bg-white text-ink/70 hover:border-charcoal/25"
            }`}
          >
            {soundOn ? "Alarm on" : "Enable alarm"}
          </button>
          <button
            type="button"
            onClick={() => setLive((value) => !value)}
            className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink/70 hover:border-charcoal/25"
          >
            {live ? "Pause updates" : "Resume updates"}
          </button>
          <Link
            href={returnTo}
            className="rounded-lg bg-charcoal px-2.5 py-1 text-[11.5px] font-semibold text-cream hover:bg-ink"
          >
            Refresh now
          </Link>
        </div>
      </div>

      {lateTickets.length > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3"
        >
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white animate-pulse motion-reduce:animate-none"
          >
            !
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-danger">
              {lateTickets.length} ticket{lateTickets.length === 1 ? "" : "s"} past
              prep time
            </p>
            <p className="text-[11.5px] leading-relaxed text-danger/80">
              {oldestLateMinutes > 0
                ? `Oldest is ${oldestLateMinutes} min over its target. `
                : ""}
              Clear the pass or mark the order served.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnOrders = orders
            .filter((order) => order.stationStatus === column.status)
            // Late tickets jump the queue inside their column.
            .sort((a, b) => {
              const aLate = ticketTiming(
                a.paidAt,
                a.targetPrepMinutes,
                now,
              )?.isLate
                ? 1
                : 0;
              const bLate = ticketTiming(
                b.paidAt,
                b.targetPrepMinutes,
                now,
              )?.isLate
                ? 1
                : 0;
              return (
                bLate - aLate ||
                new Date(a.paidAt ?? 0).getTime() -
                  new Date(b.paidAt ?? 0).getTime()
              );
            });
          return (
            <section key={column.status} className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-[15px] leading-tight text-ink">{column.title}</h2>
                  <p className="text-[11px] text-muted">{column.hint}</p>
                </div>
                <Badge tone={column.status === "ready" ? "success" : "neutral"}>
                  {columnOrders.length}
                </Badge>
              </div>
              <div className="space-y-2.5">
                {columnOrders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-muted">
                    Nothing here.
                  </p>
                ) : (
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      currency={currency}
                      canManage={canManage}
                      now={now}
                      showStation={!station}
                      returnTo={returnTo}
                      station={station}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
