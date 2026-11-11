import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BOOTSTRAP_STATEMENTS } from "@/db/bootstrap.generated";

export const dynamic = "force-dynamic";

interface D1Like {
  prepare(sql: string): unknown;
  batch(statements: unknown[]): Promise<unknown>;
  first?<T = unknown>(sql: string): Promise<T | null>;
}

/**
 * Creates and seeds the D1 database the first time it is called.
 *
 * It is intentionally idempotent: once the application tables exist this route
 * does nothing, so it is safe to call after every deployment.
 */
export async function GET() {
  try {
    const { env } = getCloudflareContext({ async: false });
    const database = (env as Record<string, unknown> | undefined)?.DB as D1Like | undefined;

    if (!database) {
      return Response.json(
        { ok: false, error: "No D1 binding named DB is attached to this environment." },
        { status: 400 },
      );
    }

    // Every statement is idempotent, so this route can be called after each
    // deployment. It skips the work once real seed data is present.
    const existing = await database
      .prepare("select count(*) as count from users")
      .first?.<{ count: number }>();

    if (Number(existing?.count ?? 0) > 0) {
      return Response.json({ ok: true, seeded: false });
    }

    for (let index = 0; index < BOOTSTRAP_STATEMENTS.length; index += 40) {
      const chunk = BOOTSTRAP_STATEMENTS.slice(index, index + 40);
      await database.batch(chunk.map((sql) => database.prepare(sql)));
    }

    return Response.json({ ok: true, seeded: true, statements: BOOTSTRAP_STATEMENTS.length });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
