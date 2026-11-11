import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MENU_UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "menu");

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * Stores an uploaded dish photograph on disk (inside data/, so it travels with
 * the database backup) and returns the public route the UI should render.
 */
export async function saveMenuImage(file: File | null): Promise<UploadResult | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Images must be smaller than 3 MB." };
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { ok: false, error: "Upload a JPG, PNG or WebP image." };
  }

  await mkdir(MENU_UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(MENU_UPLOAD_DIR, filename), bytes);

  return { ok: true, path: `/api/menu-images/${filename}` };
}

/** Removes a previously stored image, ignoring files that are already gone. */
export async function removeMenuImage(publicPath: string | null | undefined) {
  if (!publicPath || !publicPath.startsWith("/api/menu-images/")) return;
  const filename = path.basename(publicPath);
  try {
    await unlink(path.join(MENU_UPLOAD_DIR, filename));
  } catch {
    // The file may already have been replaced or removed.
  }
}

export { MENU_UPLOAD_DIR };
