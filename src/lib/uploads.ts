import path from "node:path";
import { getWorkerEnv } from "@/db/client";

const MENU_UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "menu");
const R2_PREFIX = "menu-images";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

interface StoredObject {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}

interface FilesBucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: unknown): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

function filesBucket(): FilesBucket | null {
  const env = getWorkerEnv();
  return (env?.FILES as FilesBucket | undefined) ?? null;
}

async function nodeUploads() {
  return import("node:fs/promises");
}

/**
 * Stores an uploaded dish photograph. On Cloudflare Workers the bytes live in
 * the R2 FILES bucket; locally they are written inside data/ so they travel
 * with the database backup. Returns the public route the UI should render.
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

  const filename = `${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const bucket = filesBucket();
  if (bucket) {
    await bucket.put(`${R2_PREFIX}/${filename}`, bytes, {
      httpMetadata: { contentType: file.type },
    });
    return { ok: true, path: `/api/menu-images/${filename}` };
  }

  const { mkdir, writeFile } = await nodeUploads();
  await mkdir(MENU_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(MENU_UPLOAD_DIR, filename), bytes);

  return { ok: true, path: `/api/menu-images/${filename}` };
}

/** Removes a previously stored image, ignoring files that are already gone. */
export async function removeMenuImage(publicPath: string | null | undefined) {
  if (!publicPath || !publicPath.startsWith("/api/menu-images/")) return;
  const filename = path.basename(publicPath);

  const bucket = filesBucket();
  if (bucket) {
    try {
      await bucket.delete(`${R2_PREFIX}/${filename}`);
    } catch {
      // The file may already have been replaced or removed.
    }
    return;
  }

  try {
    const { unlink } = await nodeUploads();
    await unlink(path.join(MENU_UPLOAD_DIR, filename));
  } catch {
    // The file may already have been replaced or removed.
  }
}

/** Reads a stored dish photograph for the public image route. */
export async function readMenuImage(
  filename: string,
): Promise<{ bytes: ArrayBuffer | Uint8Array; contentType: string } | null> {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = ALLOWED_TYPES[
    Object.keys(ALLOWED_TYPES).find((type) => ALLOWED_TYPES[type] === extension) ?? ""
  ];
  if (!contentType) return null;

  const bucket = filesBucket();
  if (bucket) {
    const object = await bucket.get(`${R2_PREFIX}/${filename}`);
    if (!object) return null;
    return {
      bytes: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType ?? contentType,
    };
  }

  try {
    const { readFile } = await nodeUploads();
    const bytes = await readFile(path.join(MENU_UPLOAD_DIR, path.basename(filename)));
    return { bytes: new Uint8Array(bytes), contentType };
  } catch {
    return null;
  }
}

export { MENU_UPLOAD_DIR };
