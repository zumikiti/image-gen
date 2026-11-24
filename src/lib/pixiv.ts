/**
 * pixiv への投稿下書き(Pixiv Draft)の正規化・検証。
 * pixiv には投稿用の公式 API が無いため、この層は「投稿画面へ持ち込む材料」を
 * 整えるところまでを担う。投稿そのものは人が pixiv の画面で行う。
 * LLM を呼ぶ層は pixivDraft.ts に分け、ここは純粋な関数だけを置く
 * (クライアントのコンポーネントからも読むため)。
 */

/**
 * pixiv の作品タイトルの上限。既存の Title(100 文字)より厳しいので、
 * pixiv へ渡す題名はここで切り詰めて別物として扱う。
 */
export const PIXIV_TITLE_MAX_LENGTH = 32;

/** タグの数の上限 */
export const PIXIV_TAG_MAX_COUNT = 10;

/**
 * タグ 1 つの長さの上限。pixiv の硬い制約ではなく、
 * 投稿画面の入力欄で扱いやすい長さに抑えるための我々の上限じゃ。
 */
export const PIXIV_TAG_MAX_LENGTH = 32;

/** キャプションの長さの上限。pixiv の上限より手前で抑える */
export const PIXIV_CAPTION_MAX_LENGTH = 1000;

/** 1 回の投稿に持ち込む材料。題名・タグ・キャプションの 3 点で足りる */
export interface PixivDraft {
  title: string;
  tags: string[];
  caption: string;
}

export type PixivDraftResult =
  { ok: true; draft: PixivDraft } | { ok: false; error: string };

/** コードポイントで切り詰める(絵文字の途中で割らぬため) */
function clamp(value: string, max: number): string {
  const chars = [...value];
  return chars.length <= max ? value : chars.slice(0, max).join("").trimEnd();
}

/** 改行や連続空白を 1 つの半角空白へ畳み、上限に収める(題名は単一行) */
export function normalizePixivTitle(raw: string): string {
  return clamp(raw.replace(/\s+/g, " ").trim(), PIXIV_TITLE_MAX_LENGTH);
}

/**
 * タグを整える。カンマ・読点・空白区切りの文字列と配列のどちらも受ける。
 * 空要素を捨て、重複を落とし、個数と長さの上限に収める。
 */
export function normalizePixivTags(raw: string | readonly string[]): string[] {
  const parts = typeof raw === "string" ? raw.split(/[,、\s]+/) : raw;
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of parts) {
    const tag = clamp(part.replace(/\s+/g, " ").trim(), PIXIV_TAG_MAX_LENGTH);
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length === PIXIV_TAG_MAX_COUNT) break;
  }

  return tags;
}

/** キャプションを整える */
export function normalizePixivCaption(raw: string): string {
  return clamp(raw.trim(), PIXIV_CAPTION_MAX_LENGTH);
}

/**
 * LLM の応答から Pixiv Draft を取り出す。応答は JSON だが、コードフェンスや
 * 前置きが混ざることがあるため、最初の `{` から最後の `}` までを JSON とみなす。
 */
export function parsePixivDraft(raw: string): PixivDraftResult {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: "LLM の応答から下書きを取り出せませんでした" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, error: "LLM の応答が JSON として読めませんでした" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "LLM の応答が下書きの形になっていません" };
  }

  const { title, tags, caption } = parsed as {
    title?: unknown;
    tags?: unknown;
    caption?: unknown;
  };

  if (typeof title !== "string" || title.trim() === "") {
    return { ok: false, error: "下書きに題名がありません" };
  }
  if (typeof caption !== "string") {
    return { ok: false, error: "下書きにキャプションがありません" };
  }

  const tagList = Array.isArray(tags)
    ? tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    ok: true,
    draft: {
      title: normalizePixivTitle(title),
      tags: normalizePixivTags(tagList),
      caption: normalizePixivCaption(caption),
    },
  };
}
