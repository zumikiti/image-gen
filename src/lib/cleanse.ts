import { completeChat, type ChatMessage } from "./llm";

/**
 * プロンプト調整(cleanse): ユーザーの画像説明を、ローカル LLM に
 * 「画像生成向けに書き直させる」層。システム指示は固定(管理対象外)で、
 * コンテキストは生成フォームで選択されたテンプレート本文を添える。
 */

/**
 * 画像生成向けにプロンプトを整える共通システム指示。
 * 各家で書き直すと挙動がブレるため、ここに固定して置く(Open/Closed)。
 */
export const CLEANSE_SYSTEM_PROMPT = [
  "あなたは画像生成モデル向けのプロンプトを整える専門家です。",
  "ユーザーが入力した画像の説明を、画像生成モデルがより正確で高品質な画像を作れるように書き直してください。",
  "被写体・構図・画風・色・光・背景・雰囲気などの具体的な描写を補い、曖昧さを取り除きます。",
  "ユーザーの元の意図を絶対に変えず、勝手に新しい題材を足さないこと。入力と同じ言語で書くこと。",
  "出力は書き直したプロンプト本文のみ。前置き・解説・引用符・箇条書きは一切付けないこと。",
].join("\n");

/** コンテキストを添えるための前置き。書き直し対象でないことを明示する */
const CONTEXT_PREAMBLE =
  "以下は本プロンプトの前提コンテキスト(参照用)です。背景として扱い、これ自体を書き直さないでください:\n\n";

/**
 * ローカル LLM に「コンテキスト(あれば)+ユーザープロンプト」を渡し、
 * 画像生成向けに練り直した文面を返す。
 */
export async function cleansePrompt(
  userPrompt: string,
  context?: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: CLEANSE_SYSTEM_PROMPT },
  ];
  if (context && context.trim() !== "") {
    messages.push({ role: "user", content: CONTEXT_PREAMBLE + context });
  }
  messages.push({ role: "user", content: userPrompt });
  return completeChat(messages);
}
