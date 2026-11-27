/**
 * oMLX(ローカル LLM)のメモリ解放。
 *
 * 動画生成は ComfyUI が Mac mini のメモリを総取りする。LLM のモデルが載ったままでは
 * 生成が OOM で落ちるゆえ、投入の直前に降ろす。oMLX は OpenAI 互換の外側に
 * `/v1/models/status` と `/v1/models/<id>/unload` を用意しておる。
 *
 * 繋がらぬときは「LLM はメモリを握っておらぬ」とみなして通す。止める理由が無いゆえじゃ。
 * 一方、解放を頼んだのに降りぬときは止める。30 分待って落ちるより、その場で叱る方がよい。
 */

import {
  extractErrorMessage,
  localLlmRootUrl,
  requireLocalLlmApiKey,
} from "./llm";

const JSON_TIMEOUT_MS = 15_000;
/** 解放を待つ上限。降ろすのは数秒じゃが、余裕を見る */
const WAIT_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 1_000;

export interface UnloadResult {
  /** 降ろしたモデル。何も載っておらねば空 */
  unloaded: string[];
  /** 人が読むための一言。画面にそのまま出す */
  message: string;
}

interface ModelStatus {
  id?: string;
  loaded?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function call(
  key: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(localLlmRootUrl() + path, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
  });
}

/** いま載っておるモデルの id を返す */
async function loadedModelIds(key: string): Promise<string[]> {
  const response = await call(key, "/v1/models/status");
  if (!response.ok) {
    throw new Error(
      `oMLX の状態を読めませんでした: ${await extractErrorMessage(response)}`,
    );
  }

  const body = (await response.json()) as { models?: ModelStatus[] };
  return (body.models ?? [])
    .filter((model) => model.loaded === true && typeof model.id === "string")
    .map((model) => model.id as string);
}

/** fetch が繋がらなかった/応答が無かったことを表す失敗か */
function isUnreachable(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  return e instanceof DOMException && e.name === "TimeoutError";
}

/**
 * 載っておるモデルをすべて降ろし、降りるまで待つ。
 *
 * 降ろしたくても鍵が無ければ何もできぬゆえ、そのときは通す(画面で一言添える)。
 */
export async function unloadLocalLlmModels(): Promise<UnloadResult> {
  let key: string;
  try {
    key = requireLocalLlmApiKey();
  } catch {
    return {
      unloaded: [],
      message: "oMLX の鍵が無いため、モデルの解放はしておりません",
    };
  }

  let loaded: string[];
  try {
    loaded = await loadedModelIds(key);
  } catch (e) {
    if (isUnreachable(e)) {
      return {
        unloaded: [],
        message: "oMLX に繋がらぬため、解放は要らぬとみなしました",
      };
    }
    throw e;
  }

  if (loaded.length === 0) {
    return { unloaded: [], message: "oMLX に載っておるモデルはありません" };
  }

  const unloaded: string[] = [];
  for (const id of loaded) {
    const response = await call(
      key,
      `/v1/models/${encodeURIComponent(id)}/unload`,
      { method: "POST" },
    );
    if (response.ok) {
      unloaded.push(id);
      continue;
    }

    const message = await extractErrorMessage(response);
    // 自動解放と競合しただけなら、既にメモリは空いておる
    if (response.status === 400 && /not loaded/i.test(message)) continue;

    throw new Error(`oMLX のモデル ${id} を解放できませんでした: ${message}`);
  }

  // 降りたことを確かめてから ComfyUI へ渡す(降り切る前に投げると OOM になる)
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let remaining = loaded;
  while (Date.now() < deadline) {
    remaining = await loadedModelIds(key);
    if (remaining.length === 0) {
      return {
        unloaded,
        message: `oMLX のモデルを解放しました: ${unloaded.join(", ")}`,
      };
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `oMLX のモデルが解放されませんでした: ${remaining.join(", ")}`,
  );
}
