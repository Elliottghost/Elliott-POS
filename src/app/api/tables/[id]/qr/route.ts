import { canAccessBranch, hasPermission } from "@/lib/auth/access";
import { requireUser } from "@/lib/auth/session";
import { qrCodeSvg, tableMenuUrl } from "@/lib/qr";
import { getTableById } from "@/services/tables";
import { getSetting } from "@/services/settings";

/** Downloads the table's QR code as a printable SVG. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!hasPermission(user, "tables.view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const row = await getTableById(id);
  if (!row) return new Response("Not found", { status: 404 });
  if (!canAccessBranch(user, row.table.branchId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const origin =
    (await getSetting("business.public_url", "")) ||
    process.env.APP_URL ||
    "http://localhost:3000";
  const url = tableMenuUrl(origin, row.branchSlug, row.table.qrToken);
  const svg = await qrCodeSvg(url, 512);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="vista-${row.branchCode.toLowerCase()}-${row.table.code.toLowerCase()}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
