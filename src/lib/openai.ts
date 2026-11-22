import type { GenerationInput } from "./types";

/**
 * OpenAI API クライアント。API キーは環境変数 OPENAI_API_KEY から読む。
 * このモジュールは OpenAI 専用。バックエンドの振り分けは lib/generate.ts が担当する。
 */

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "OPENAI_API_KEY が設定されておりません。.env に設定してください",
    );
  }
  return apiKey;
}

/** エラーレスポンスの message を取り出す */
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

/** OpenAI Images API を呼び、1 枚の画像(Buffer)を返す */
export async function generateWithOpenAi(
  input: GenerationInput,
): Promise<Buffer> {
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

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
  };

  const b64_json = data.data?.[0]?.b64_json;
  if (!b64_json) {
    throw new Error("API response に b64_json が含まれていません");
  }

  return Buffer.from(b64_json, "base64");
}
