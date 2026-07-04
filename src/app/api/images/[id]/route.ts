import { readImageFile } from "@/lib/storage";

/**
 * 保存された画像をPNGで配信するAPIエンドポイント
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  // IDの妥当性をチェック（パストラバーサル対策）
  if (!/^[A-Za-z0-9-]+$/.test(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 画像ファイルを読み込む
  const buffer = readImageFile(id);
  if (!buffer) {
    return new Response(JSON.stringify({ error: "Image not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
