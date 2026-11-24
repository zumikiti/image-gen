/**
 * ギャラリーのあいまい検索(クライアント側)。
 * 全角半角・大文字小文字・ひらがなカタカナの揺れを潰したうえでの部分一致で当てる。
 * 打ち間違いの許容までは行わぬ(説明できぬ誤ヒットは絞り込みの役に立たぬため)。
 */

import type { GeneratedImage } from "./types";

/** カタカナ(U+30A1–U+30F6)を対応するひらがなへ寄せる */
function toHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

/** 比較用の正規化。NFKC(全角→半角など) → 小文字化 → カタカナ→ひらがな */
export function normalizeForSearch(text: string): string {
  return toHiragana(text.normalize("NFKC").toLowerCase());
}

/**
 * 1 枚の画像から検索対象のテキストを組み立てる。
 * タグなどを増やすときはここへ足すだけでよく、呼び出し側は変更不要。
 */
export function searchableText(
  image: Pick<GeneratedImage, "title" | "prompt">,
): string {
  return [image.title ?? "", image.prompt].join("\n");
}

/**
 * 空白区切りの語をすべて含むか(AND)。語が無ければ全件に当たる。
 * 語はタイトルとプロンプトをまたいで探す(「猫」がタイトル、「cinematic」が
 * プロンプトにあっても当たる)。
 */
export function matchesQuery(
  image: Pick<GeneratedImage, "title" | "prompt">,
  query: string,
): boolean {
  const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  const target = normalizeForSearch(searchableText(image));
  return tokens.every((token) => target.includes(token));
}
