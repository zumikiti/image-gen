/**
 * ローカル LLM(OpenAI 互換)のチャット補完クライアント。
 * pi エージェントが oxlm プロバイダとして使うのと同じ端点(192.168.68.56:8888)を
 * アプリから直接叩く。プロンプト調整(cleanse)に用いる。
 * バックエンドの振り分けは lib/generate.ts が担当し、ここはチャット補完専用。
 */

/** 既定のローカル LLM 端点。環境変数 LOCAL_LLM_BASE_URL で上書き可 */
const DEFAULT_BASE_URL = "http://192.168.68.56:8888/v1";
/** 既定の調整用モデル。環境変数 LOCAL_LLM_MODEL で上書き可 */
const DEFAULT_MODEL = "gemma-4-31b-it-4bit";

function requireApiKey(): string {
  const apiKey =
    process.env.LOCAL_LLM_API_KEY?.trim() || process.env.OXLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LOCAL_LLM_API_KEY または OXLM_API_KEY が設定されておりません。.env に設定してください",
    );
  }
  return apiKey;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
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

/**
 * OpenAI 互換 /v1/chat/completions を呼び、回答本文(1 つ目)を返す。
 * プロンプト調整は一定時間で終わる想定のため、既定の fetch 上限で十分とする。
 */
export async function completeChat(messages: ChatMessage[]): Promise<string> {
  const baseUrl =
    (process.env.LOCAL_LLM_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    ) + "/chat/completions";

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.LOCAL_LLM_MODEL?.trim() || DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `ローカルLLMの応答エラー: ${await extractErrorMessage(response)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("ローカルLLMの応答が空でした");
  }
  return content;
}
