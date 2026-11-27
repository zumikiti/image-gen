/**
 * 一覧のカード用サムネイル(webp)を配信時に作る層。
 *
 * 原本の PNG は正本として残し、正方形に切り抜いた派生だけを `data/thumbs` に持つ。
 * 見られた順に出来るゆえ、まだ見ぬ画像のために先回りして CPU を回さずに済む。
 */

import sharp from "sharp";

import { readImageFile, readThumbFile, saveThumbFile } from "./storage";
import { DEFAULT_THUMB_WIDTH } from "./thumbnail";

/** webp の品質。272px 角のカードで違いの見えぬ範囲まで詰める */
const QUALITY = 80;

/**
 * PNG を正方形の webp に落とす。
 * 一覧は `object-cover` の正方形ゆえ、切り落とされる画素は運ばぬ。
 */
export async function encodeThumb(png: Buffer, width: number): Promise<Buffer> {
  return sharp(png)
    .resize(width, width, { fit: "cover", position: "centre" })
    .webp({ quality: QUALITY })
    .toBuffer();
}

/**
 * キャッシュを見て、無ければ作る。
 *
 * 変換に失敗したら undefined を返す。呼び出し側は原本の PNG に落ちるゆえ、
 * 「軽い」より「見える」を優先する(原本が無ければそれは 404 じゃ)。
 */
export async function getOrCreateThumb(
  id: string,
  width: number = DEFAULT_THUMB_WIDTH,
): Promise<Buffer | undefined> {
  const cached = readThumbFile(id, width);
  if (cached) return cached;

  const png = readImageFile(id);
  if (!png) return undefined;

  try {
    const webp = await encodeThumb(png, width);
    saveThumbFile(id, width, webp);
    return webp;
  } catch {
    return undefined;
  }
}
