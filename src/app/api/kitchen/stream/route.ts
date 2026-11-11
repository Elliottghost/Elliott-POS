import { branchScope, hasPermission } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { subscribeToKitchen } from "@/lib/realtime/kitchen-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

/**
 * Server-sent events feed for the kitchen display.
 *
 * Cookies travel with the EventSource request, so the session is resolved the
 * same way as any page. A branch user is pinned to their own house; a super
 * administrator may follow one branch or the whole group. EventSource
 * reconnects on its own using the `retry` hint sent below.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  if (!hasPermission(user, "kitchen.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const scope = branchScope(user);
  const requested = new URL(request.url).searchParams.get("branch");
  const branchId =
    scope === null ? requested : (scope[0] ?? "__unassigned__");

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const stop = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // The client went away first; nothing left to close.
        }
      };

      // Ask the browser to retry quickly, then confirm the subscription so the
      // screen can show "Live" instead of guessing from network silence.
      write("retry: 4000\n\n");
      write(
        `event: ready\ndata: ${JSON.stringify({ branchId, at: new Date().toISOString() })}\n\n`,
      );

      unsubscribe = subscribeToKitchen(branchId, (event) => {
        write(`event: kitchen\ndata: ${JSON.stringify(event)}\n\n`);
      });
      heartbeat = setInterval(() => write(": keep-alive\n\n"), HEARTBEAT_MS);

      request.signal.addEventListener("abort", stop, { once: true });
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Defensive: some reverse proxies buffer SSE unless told not to.
      "X-Accel-Buffering": "no",
    },
  });
}
