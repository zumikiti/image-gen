/**
 * ComfyUI の HTTP API を叩く薄い層。
 *
 * 呼び出しはどれも短い(投入・状態照会・ファイル取得)ゆえ、`fetch` に時限を
 * 付けて済ませる。30 分かかるのは **ComfyUI の側**であって、こちらは待たぬ。
 */

import type { H3Graph } from "./h3Graph";

/** LAN の Mac mini で動く ComfyUI。外部公開はせぬ前提じゃ */
const DEFAULT_BASE_URL = "http://192.168.68.56:8188";
const JSON_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

export function resolveBaseUrl(): string {
  const configured = process.env.H3_BASE_URL?.trim();
  const base = configured && configured !== "" ? configured : DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

/** 出力ファイルの 1 件。`/view` に渡す 3 つ組じゃ */
export interface ComfyOutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

export interface ComfyHistoryEntry {
  outputs?: Record<string, Record<string, unknown>>;
  status?: {
    status_str?: string;
    completed?: boolean;
    messages?: unknown;
  };
}

export interface ComfyQueue {
  /** 実行中の prompt_id */
  running: string[];
  /** 待ちの prompt_id(投入順) */
  pending: string[];
}

/** ComfyUI のエラー封筒から、人が読める 1 行を作る */
function describeError(status: number, body: string): string {
  let detail = body.trim();

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; details?: string };
      node_errors?: Record<
        string,
        { errors?: Array<{ message?: string; details?: string }> }
      >;
    };
    const nodeMessages = Object.entries(parsed.node_errors ?? {}).flatMap(
      ([nodeId, node]) =>
        (node.errors ?? []).map((error) =>
          [nodeId, error.message, error.details].filter(Boolean).join(": "),
        ),
    );
    detail =
      [parsed.error?.message ?? parsed.error?.details, ...nodeMessages]
        .filter(Boolean)
        .join(" / ") || detail;
  } catch {
    // JSON でなければ本文をそのまま使う
  }

  return `ComfyUI が ${status} を返しました: ${detail.slice(0, 400)}`;
}

async function request(
  path: string,
  init?: RequestInit,
  timeoutMs: number = JSON_TIMEOUT_MS,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(resolveBaseUrl() + path, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`ComfyUI (${resolveBaseUrl()}) に繋がりません: ${reason}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(describeError(response.status, body));
  }

  return response;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const response = await request(path, init, timeoutMs);
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("ComfyUI の応答を JSON として読めませんでした");
  }
}

/** グラフを投入し、ComfyUI 側の prompt_id を返す */
export async function submitPrompt(graph: H3Graph): Promise<string> {
  const body = JSON.stringify({ prompt: graph, client_id: "image-gen" });
  const result = await requestJson<{ prompt_id?: string; error?: unknown }>(
    "/prompt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
  );

  if (!result.prompt_id) {
    throw new Error(
      `ComfyUI が prompt_id を返しませんでした: ${JSON.stringify(result).slice(0, 300)}`,
    );
  }
  return result.prompt_id;
}

/** `queue_running` / `queue_pending` の要素は `[番号, prompt_id, ...]` じゃ */
export async function getQueue(): Promise<ComfyQueue> {
  const raw = await requestJson<{
    queue_running?: unknown[][];
    queue_pending?: unknown[][];
  }>("/queue");

  const extract = (items: unknown[][] | undefined): string[] =>
    (items ?? [])
      .map((item) => (Array.isArray(item) ? item[1] : undefined))
      .filter((id): id is string => typeof id === "string");

  return {
    running: extract(raw.queue_running),
    pending: extract(raw.queue_pending),
  };
}

/** 完了したジョブの記録。まだ history に無ければ undefined */
export async function getHistory(
  promptId: string,
): Promise<ComfyHistoryEntry | undefined> {
  const raw = await requestJson<Record<string, ComfyHistoryEntry>>(
    `/history/${encodeURIComponent(promptId)}`,
  );
  return raw[promptId];
}

/** 出力ノードに並ぶファイルを平坦に集める */
export function listOutputFiles(entry: ComfyHistoryEntry): ComfyOutputFile[] {
  const files: ComfyOutputFile[] = [];

  for (const output of Object.values(entry.outputs ?? {})) {
    for (const value of Object.values(output ?? {})) {
      if (!Array.isArray(value)) continue;
      for (const item of value) {
        if (typeof item !== "object" || item === null) continue;
        const meta = item as Partial<ComfyOutputFile>;
        if (typeof meta.filename !== "string") continue;
        files.push({
          filename: meta.filename,
          subfolder: meta.subfolder ?? "",
          type: meta.type ?? "output",
        });
      }
    }
  }

  return files;
}

/** 出力のうち動画ファイル(最初の 1 件)を取ってくる */
export async function downloadVideo(
  entry: ComfyHistoryEntry,
): Promise<{ file: ComfyOutputFile; data: Buffer }> {
  const file = listOutputFiles(entry).find((candidate) =>
    /\.(mp4|webm|mov)$/i.test(candidate.filename),
  );
  if (!file) {
    throw new Error("ComfyUI の出力に動画ファイルがありません");
  }

  const query = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder,
    type: file.type,
  });
  const response = await request(
    `/view?${query.toString()}`,
    undefined,
    DOWNLOAD_TIMEOUT_MS,
  );

  return { file, data: Buffer.from(await response.arrayBuffer()) };
}

/**
 * 最初のコマを ComfyUI の `input/` へ送り、`LoadImage` に渡す名前を返す。
 * deliberate: 送った画像は消さぬ。掃除の口が ComfyUI に無く、
 * 溜まる量も 1 本あたり数 MB ゆえ、困るまで放置する
 */
export async function uploadImage(
  data: Buffer,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append(
    "image",
    new Blob([new Uint8Array(data)], { type: "image/png" }),
    filename,
  );
  form.append("overwrite", "true");

  const response = await request("/upload/image", {
    method: "POST",
    body: form,
  });
  const result = (await response.json()) as {
    name?: string;
    subfolder?: string;
  };
  if (!result.name) {
    throw new Error("ComfyUI がアップロード先の名前を返しませんでした");
  }
  return result.subfolder ? `${result.subfolder}/${result.name}` : result.name;
}

/** 実行中のジョブを止める。実行中のものを止めるゆえ、確認を挟むこと */
export async function interrupt(): Promise<void> {
  await request("/interrupt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/** まだ実行されていないジョブを待ち行列から外す */
export async function deleteQueued(promptId: string): Promise<void> {
  await request("/queue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delete: [promptId] }),
  });
}
