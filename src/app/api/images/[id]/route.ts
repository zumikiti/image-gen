import { updateImageTitle } from "@/lib/db";
import { readImageFile } from "@/lib/storage";
import { getOrCreateThumb } from "@/lib/thumbs";
import { parseThumbWidth, THUMB_WIDTH_RANGE } from "@/lib/thumbnail";
import { normalizeTitle } from "@/lib/title";

/** パストラバーサル対策。id に使える文字を絞る */
const ID_PATTERN = /^[A-Za-z0-9-]+$/;

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * 保存された画像を配信するAPIエンドポイント。
 *
 * `?w=<幅>` を付けると、一覧のカード用に正方形へ切り抜いた webp を返す
 * (初回だけ変換し、`data/thumbs` にキャッシュする)。
 * 付けねば今までどおり原本の PNG を返すゆえ、詳細やピクシブの導線は変わらぬ。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // IDの妥当性をチェック（パストラバーサル対策）
  if (!ID_PATTERN.test(id)) {
    return jsonError(400, "Invalid ID");
  }

  const requestedWidth = new URL(req.url).searchParams.get("w");
  if (requestedWidth !== null) {
    const width = parseThumbWidth(requestedWidth);
    if (width === undefined) {
      return jsonError(
        400,
        `w は ${THUMB_WIDTH_RANGE.min}〜${THUMB_WIDTH_RANGE.max} の整数で指定してください`,
      );
    }

    const thumb = await getOrCreateThumb(id, width);
    if (thumb) {
      return new Response(new Uint8Array(thumb), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(thumb.length),
          // id は内容に対して不変で、幅も URL に入っておるゆえ永久に効く
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    // 変換できなければ原本へ落ちる(下の PNG 配信へ)
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
