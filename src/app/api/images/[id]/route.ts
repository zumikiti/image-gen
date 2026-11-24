import { updateImageTitle } from "@/lib/db";
import { readImageFile } from "@/lib/storage";
import { normalizeTitle } from "@/lib/title";

/** パストラバーサル対策。id に使える文字を絞る */
const ID_PATTERN = /^[A-Za-z0-9-]+$/;

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * 保存された画像をPNGで配信するAPIエンドポイント
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // IDの妥当性をチェック（パストラバーサル対策）
  if (!ID_PATTERN.test(id)) {
    return jsonError(400, "Invalid ID");
  }

  // 画像ファイルを読み込む
  const buffer = readImageFile(id);
  if (!buffer) {
    return jsonError(404, "Image not found");
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * タイトルの登録・更新。body は {"title": "..."} で、null または空文字なら解除。
 * 認証は無いので、信頼できる LAN に留めること(既存の GET と同じ前提)。
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  if (!ID_PATTERN.test(id)) {
    return jsonError(400, "Invalid ID");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "JSON を読めませんでした");
  }

  if (typeof body !== "object" || body === null || !("title" in body)) {
    return jsonError(422, "title を指定してください(null で解除)");
  }

  const rawTitle = (body as { title: unknown }).title;
  if (rawTitle !== null && typeof rawTitle !== "string") {
    return jsonError(422, "title は文字列か null です");
  }

  const titleInput = normalizeTitle(rawTitle ?? "");
  if (!titleInput.ok) {
    return jsonError(422, titleInput.error);
  }

  if (!updateImageTitle(id, titleInput.title)) {
    return jsonError(404, "Image not found");
  }

  return Response.json({ id, title: titleInput.title });
}
