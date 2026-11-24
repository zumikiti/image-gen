import { completeChat, type ChatMessage } from "./llm";
import {
  PIXIV_CAPTION_MAX_LENGTH,
  PIXIV_TAG_MAX_COUNT,
  PIXIV_TAG_MAX_LENGTH,
  PIXIV_TITLE_MAX_LENGTH,
  parsePixivDraft,
  type PixivDraft,
} from "./pixiv";

/**
 * pixiv への投稿下書きをローカル LLM に作らせる層。
 * 材料は画像のプロンプトと既存の Title だけじゃ(画像そのものは渡さぬ)。
 * 純粋な検証・正規化は pixiv.ts が担う。
 */

/**
 * 下書き作成の共通システム指示。各家で書き直すと挙動がブレるため、
 * ここに固定して置く(cleanse.ts のシステム指示と同じ流儀)。
 */
export const PIXIV_DRAFT_SYSTEM_PROMPT = [
  "あなたは pixiv への投稿を手伝うアシスタントです。",
  "与えられた画像生成プロンプトから、pixiv に投稿する作品の題名・タグ・キャプションを日本語で作ってください。",
  `題名は ${PIXIV_TITLE_MAX_LENGTH} 文字以内の短い一行にしてください。`,
  `タグは ${PIXIV_TAG_MAX_COUNT} 個までで、各 ${PIXIV_TAG_MAX_LENGTH} 文字以内。画風・題材・雰囲気など、探している人が使いそうな語を選んでください。`,
  `キャプションは ${PIXIV_CAPTION_MAX_LENGTH} 文字以内で、作品の見どころを短く紹介してください。`,
  "与えられたプロンプトに書かれていない要素を創作しないこと。",
  "出力は次の形の JSON のみ。前置き・解説・コードフェンスは一切付けないこと。",
  '{"title": "…", "tags": ["…", "…"], "caption": "…"}',
].join("\n");

/**
 * ローカル LLM に下書きを作らせ、検証済みの Pixiv Draft を返す。
 * 形が崩れておれば例外にする(呼び出し側が利用者に見せる)。
 */
export async function draftPixivPost(image: {
  title: string | null;
  prompt: string;
}): Promise<PixivDraft> {
  const materials = [
    image.title ? `既存のタイトル: ${image.title}` : "既存のタイトル: なし",
    `画像生成プロンプト:\n${image.prompt}`,
  ].join("\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: PIXIV_DRAFT_SYSTEM_PROMPT },
    { role: "user", content: materials },
  ];

  const result = parsePixivDraft(await completeChat(messages));
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.draft;
}
