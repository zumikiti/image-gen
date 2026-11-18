import type { GenerationInput } from "./types";
import { extractErrorMessage } from "./openai";

/**
 * MFlux バックエンドクライアント。
 * olmx を起動している PC 上で稼働する OpenAI 互換サーバー(LAN)を叩く。
 * MFLUX_BASE_URL に例: http://192.168.x.x:8080/v1 のように設定する。
 * MFLUX_MODEL でサーバー側のモデル名を上書き可能(未設定ならカタログ ID をそのまま使う)。
 */

function resolveEndpoint(): string {
  const baseUrl = process.env.MFLUX_BASE_URL;
  if (!baseUrl || baseUrl.trim() === "") {
    throw new Error(
      "MFlux バックエンドが設定されていません。.env に MFLUX_BASE_URL を設定してください(例: http://<olmx起動PCのLAN IP>:8080/v1)"
    );
  }
  return baseUrl.replace(/\/+$/, "") + "/images/generations";
}

async function toBuffer(data: Array<{ b64_json?: string; url?: string }>): Promise<Buffer> {
  const first = data[0];
  if (!first) {
    throw new Error("MFlux サーバーの応答に画像データが含まれていません");
  }

  if (first.b64_json) {
    return Buffer.from(first.b64_json, "base64");
  }

  if (first.url) {
    const res = await fetch(first.url);
    if (!res.ok) {
      throw new Error(`MFlux サーバーの画像ダウンロードに失敗しました: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("MFlux サーバーの応答に b64_json も url も含まれていません");
}

export async function generateWithMflux(input: GenerationInput): Promise<Buffer> {
  const endpoint = resolveEndpoint();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MFLUX_MODEL?.trim() || input.model,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      n: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const data = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };

  if (!data.data || data.data.length === 0) {
    throw new Error("MFlux サーバーの応答に画像データが含まれていません");
  }

  return toBuffer(data.data);
}
