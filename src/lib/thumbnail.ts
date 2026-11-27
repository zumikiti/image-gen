/**
 * 一覧のカード用サムネイルの決まりごと(純関数のみ)。
 *
 * sharp を使う実装は `thumbs.ts`(サーバー専用)に置く。ここは
 * クライアントの `<img>` からも読むゆえ、node 依存を持たせぬ。
 */

/** カードの実寸は最大 272px 角。3 倍の携帯(816px)でも甘くならぬ線として 600 を採る */
export const DEFAULT_THUMB_WIDTH = 600;

/** 受け付ける幅。桁を間違えた要求で巨大な派生を作らせぬための門じゃ */
export const THUMB_WIDTH_RANGE = { min: 64, max: 1024 } as const;

/**
 * `?w=` を検証して幅を返す。数字以外・範囲外は undefined。
 * 「未指定」と「不正」は呼び出し側が区別する(未指定なら原本の PNG を返す)。
 */
export function parseThumbWidth(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw.trim())) return undefined;

  const width = Number(raw.trim());
  if (!Number.isSafeInteger(width)) return undefined;
  if (width < THUMB_WIDTH_RANGE.min) return undefined;
  if (width > THUMB_WIDTH_RANGE.max) return undefined;
  return width;
}

/**
 * サムネイルの URL。`w` を省けば既定幅。
 * id は内容に対して不変ゆえ、URL に幅が入ればキャッシュは永久に効く。
 */
export function thumbUrl(
  id: string,
  width: number = DEFAULT_THUMB_WIDTH,
): string {
  return `/api/images/${id}?w=${width}`;
}

/**
 * 原本の URL。詳細・ピクシブ用じゃ。
 * 一覧に使うと 1.2MB の PNG を 272px 角のために運ぶことになる。
 */
export function originalUrl(id: string): string {
  return `/api/images/${id}`;
}
