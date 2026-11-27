import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

import { updateVideoTitle } from "@/lib/db";
import { statVideoFile } from "@/lib/storage";
import { normalizeTitle } from "@/lib/title";

/** パストラバーサル対策。id に使える文字を絞る(画像側と同じ作法) */
const ID_PATTERN = /^[A-Za-z0-9-]+$/;

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * 保存された動画を配信する。
 *
 * `<video>` のシークには `Range` への応答が要るゆえ、全体を返さずに
 * 要求された範囲だけを流す(206)。ここが画像配信と違うところじゃ。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  if (!ID_PATTERN.test(id)) {
    return jsonError(400, "Invalid ID");
  }

  const file = statVideoFile(id);
  if (!file) {
    return jsonError(404, "Video not found");
  }

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    // 動画の id は内容ごとに一意ゆえ、差し替わることはない
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  const parsed = range ? parseRange(range, file.size) : undefined;

  if (range && !parsed) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${file.size}` },
    });
  }

  if (parsed) {
    const { start, end } = parsed;
    return new Response(toWebStream(file.path, start, end), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new Response(toWebStream(file.path), {
    status: 200,
    headers: { ...headers, "Content-Length": String(file.size) },
  });
}

/** `bytes=0-`、`bytes=100-199`、`bytes=-500`(末尾 500 バイト)を受ける */
function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return undefined;

  let start: number;
  let end: number;

  if (rawStart === "") {
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return undefined;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === "" ? size - 1 : Number(rawEnd);
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end))
    return undefined;
  if (start < 0 || start >= size || end < start) return undefined;

  return { start, end: Math.min(end, size - 1) };
}

function toWebStream(
  filePath: string,
  start?: number,
  end?: number,
): ReadableStream {
  const nodeStream = createReadStream(filePath, { start, end });
  return Readable.toWeb(nodeStream) as ReadableStream;
}

/**
 * タイトルの登録・更新。body は {"title": "..."} で、null または空文字なら解除。
 * 画像側の API と同じ作法じゃ(認証は無いので LAN に留めること)。
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

  if (!updateVideoTitle(id, titleInput.title)) {
    return jsonError(404, "Video not found");
  }

  return Response.json({ id, title: titleInput.title });
}
