import * as http from "node:http";
import * as https from "node:https";
import type { GenerationInput } from "./types";

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
      "MFlux バックエンドが設定されていません。.env に MFLUX_BASE_URL を設定してください(例: http://<olmx起動PCのLAN IP>:8080/v1)",
    );
  }
  return baseUrl.replace(/\/+$/, "") + "/images/generations";
}

/** 大判は 8 分ほどかかるため、既定の 5 分では足りぬ。無限待ちは避けて 20 分で切る */
const GENERATION_TIMEOUT_MS = 20 * 60 * 1000;

interface RawResponse {
  status: number;
  statusText: string;
  text: string;
}

/**
 * Node 組み込みの fetch(undici) は、応答ヘッダを受け取るまでに既定 300 秒の
 * 上限(headersTimeout)を課す。ローカル生成は大判だと分単位にかかり、生成が
 * 成功しても 5 分で打ち切られてしまう。ゆえに node:http(s) で直接叩き、
 * 既定より長い上限(下の GENERATION_TIMEOUT_MS)を自分で持たせる。
 */
function postJson(endpoint: string, payload: unknown): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const body = Buffer.from(JSON.stringify(payload));
    const client = url.protocol === "https:" ? https : http;

    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.length,
        },
        timeout: GENERATION_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            text: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );

    req.on("timeout", () => {
      req.destroy(
        new Error(
          `MFlux サーバーの応答が ${GENERATION_TIMEOUT_MS / 60000} 分以内に返りませんでした`,
        ),
      );
    });
    req.on("error", reject);
    req.end(body);
  });
}

/** OpenAI 互換のエラー封筒 `{ error: { message } }` から文言を取り出す */
function errorFromResponse(res: RawResponse): Error {
  let message = res.statusText || `HTTP ${res.status}`;
  try {
    const body = JSON.parse(res.text) as { error?: { message?: string } };
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    // JSON でなければ statusText をそのまま使う
  }
  return new Error(message);
}

async function toBuffer(
  data: Array<{ b64_json?: string; url?: string }>,
): Promise<Buffer> {
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
      throw new Error(
        `MFlux サーバーの画像ダウンロードに失敗しました: ${res.status}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("MFlux サーバーの応答に b64_json も url も含まれていません");
}

export async function generateWithMflux(
  input: GenerationInput,
): Promise<Buffer> {
  const endpoint = resolveEndpoint();

  const response = await postJson(endpoint, {
    model: process.env.MFLUX_MODEL?.trim() || input.model,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    n: 1,
  });

  if (response.status < 200 || response.status >= 300) {
    throw errorFromResponse(response);
  }

  let data: { data?: Array<{ b64_json?: string; url?: string }> };
  try {
    data = JSON.parse(response.text) as typeof data;
  } catch {
    throw new Error("MFlux サーバーの応答を JSON として解釈できませんでした");
  }

  if (!data.data || data.data.length === 0) {
    throw new Error("MFlux サーバーの応答に画像データが含まれていません");
  }

  return toBuffer(data.data);
}
