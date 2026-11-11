import { listBranches } from "@/services/branches";
import { listMenuCategories, listMenuItems } from "@/services/menu";
import { getSettingsMap } from "@/services/settings";

export const dynamic = "force-dynamic";

/** Read-only catalogue used by the public website's client components. */
export async function GET() {
  try {
    const [branches, categories, items, settings] = await Promise.all([
      listBranches(null, { includeInactive: false }),
      listMenuCategories({ includeInactive: false }),
      listMenuItems({ includeInactive: false }),
      getSettingsMap(),
    ]);

    return Response.json(
      { branches, categories, items, settings },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load catalogue" },
      { status: 500 },
    );
  }
}
