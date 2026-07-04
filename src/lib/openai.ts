import type { GenerationInput } from "./types";

/**
 * OpenAI Images API クライアント。API キーは環境変数 OPENAI_API_KEY から読む。
 */

export async function generateImage(input: GenerationInput): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY が設定されておりません。.env に設定してください");
  }

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
    let errorMessage = response.statusText;
    try {
      const errorBody = await response.json() as { error?: { message?: string } };
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message;
      }
    } catch {
      // JSON parse failed, use statusText
    }
    throw new Error(errorMessage);
  }

  const data = await response.json() as { data?: Array<{ b64_json?: string }> };

  const b64_json = data.data?.[0]?.b64_json;
  if (!b64_json) {
    throw new Error("API response に b64_json が含まれていません");
  }

  return Buffer.from(b64_json, "base64");
}

