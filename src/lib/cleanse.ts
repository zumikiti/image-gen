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

/**
 * 動画(H3)向けの調整に使う共通システム指示。
 * 画像用とは型がまったく違うゆえ、システム指示も別に持つ(Open/Closed)。
 * 細目はコンテキスト(ルールブック)側に置き、ここは骨格だけを言う。
 */
export const VIDEO_CLEANSE_SYSTEM_PROMPT = [
  "あなたは MiniMax H3 の動画プロンプトを整える専門家です。",
  "ユーザーの短いアイデアを、H3 が解釈できる 1 本のプロンプトに書き直してください。",
  "出力の骨格は次の順で固定です: アンカー行(I2VA) → integrated_multimodal_description → overall_soundscape → non_diegetic_music。",
  "本文は英語で書き、台詞だけ元の言語のまま <d>[Japanese] …</d> に入れます。アンカー行は必ず含め、空行を 1 つ挟みます。",
  "否定文は書きません。カメラは語彙・振幅・速さで書き、動かさぬなら Static Shot と明記します。話者は初出時に (S1) と声質で固定します。",
  "出力は書き直したプロンプト本文のみ。前置き・解説・見出し・箇条書き・引用符は一切付けないこと。",
].join("\n");

/** コンテキストを「ルールブック」としてシステム指示へ足すときの見出し */
const VIDEO_RULES_PREAMBLE =
  "以下はこのアプリの H3 向けルールブックです。逸脱せず従ってください:\n\n";

/**
 * ローカル LLM に H3 向けの書き直しをさせる。
 *
 * 画像用と違い、コンテキストは**ルールブック**としてシステム指示側へ足す。
 * 参照用の素材ではなく「守るべき型」じゃゆえ、user 側に混ぜると薄まる。
 */
export async function cleanseVideoPrompt(
  userPrompt: string,
  context?: string,
  seconds?: number,
): Promise<string> {
  const rules = context?.trim() ?? "";
  const system =
    rules === ""
      ? VIDEO_CLEANSE_SYSTEM_PROMPT
      : VIDEO_CLEANSE_SYSTEM_PROMPT + "\n\n" + VIDEO_RULES_PREAMBLE + rules;

  // 尺はカット数と台詞の長さを決めるゆえ、ユーザーの文面に添える
  const budget =
    typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
      ? `クリップの尺は ${seconds} 秒です。カットはこの尺の内側に置き、台詞も尺に収めてください。`
      : "";

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: budget === "" ? userPrompt : `${budget}\n\n${userPrompt}`,
    },
  ];
  return completeChat(messages);
}
