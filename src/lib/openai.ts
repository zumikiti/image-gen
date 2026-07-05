import type { GenerationInput } from "./types";

/**
 * OpenAI API クライアント。API キーは環境変数 OPENAI_API_KEY から読む。
 */

/** プロンプトクレンジングに使う言語モデル */
const CLEANSE_MODEL = "gpt-5.4";

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY が設定されておりません。.env に設定してください");
  }
  return apiKey;
}

async function extractErrorMessage(response: Response): Promise<string> {
  let message = response.statusText;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    // JSON parse に失敗したら statusText をそのまま使う
  }
  return message;
}

export async function generateImage(input: GenerationInput): Promise<Buffer> {
  const apiKey = requireApiKey();

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      n: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };

  const b64_json = data.data?.[0]?.b64_json;
  if (!b64_json) {
    throw new Error("API response に b64_json が含まれていません");
  }

  return Buffer.from(b64_json, "base64");
}

const CLEANSE_SYSTEM_PROMPT = [
  "あなたは画像生成モデル向けのプロンプトを整える専門家です。",
  "ユーザーが入力した画像の説明を、画像生成モデルがより正確で高品質な画像を作れるように書き直してください。",
  "被写体・構図・画風・色・光・背景・雰囲気などの具体的な描写を補い、曖昧さを取り除きます。",
  "ユーザーの元の意図を絶対に変えず、勝手に新しい題材を足さないこと。入力と同じ言語で書くこと。",
  "出力は書き直したプロンプト本文のみ。前置き・解説・引用符・箇条書きは一切付けないこと。",
].join("\n");

/**
 * gpt-5.4 にユーザーのプロンプトを渡し、画像生成向けに練り直した文面を返す。
 */
export async function cleansePrompt(userPrompt: string): Promise<string> {
  const apiKey = requireApiKey();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLEANSE_MODEL,
      messages: [
        { role: "system", content: CLEANSE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(`プロンプト調整に失敗しました: ${await extractErrorMessage(response)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const cleansed = data.choices?.[0]?.message?.content?.trim();
  if (!cleansed) {
    throw new Error("プロンプト調整の応答が空でした");
  }

  return cleansed;
}
