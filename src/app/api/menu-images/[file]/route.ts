import { readMenuImage } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (!/^[a-z0-9-]+\.[a-z0-9]+$/i.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  const stored = await readMenuImage(file);
  if (!stored) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(
    stored.bytes instanceof Uint8Array ? stored.bytes : new Uint8Array(stored.bytes),
    {
      headers: {
        "Content-Type": stored.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
