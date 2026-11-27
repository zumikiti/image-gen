import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { unloadLocalLlmModels } from "../src/lib/omlx.ts";

interface MockState {
  /** いま載っておるモデル。unload されると減る */
  loaded: string[];
  /** POST /v1/models/<id>/unload の応答を差し替える */
  unloadResponse?: (id: string) => { status: number; body: unknown };
  /** 受け取った要求の記録 */
  requests: string[];
}

type Handler = (state: MockState) => http.RequestListener;

/** モックの oMLX を立て、LOCAL_LLM_BASE_URL をそこへ向けてから fn を走らせる */
async function withMockOmlx(
  state: MockState,
  handler: Handler,
  fn: (state: MockState) => Promise<void>,
) {
  const server = http.createServer(handler(state));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const previousBase = process.env.LOCAL_LLM_BASE_URL;
  const previousKey = process.env.LOCAL_LLM_API_KEY;
  const previousOxlm = process.env.OXLM_API_KEY;
  process.env.LOCAL_LLM_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.LOCAL_LLM_API_KEY = "test-key";

  try {
    await fn(state);
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("LOCAL_LLM_BASE_URL", previousBase);
    restore("LOCAL_LLM_API_KEY", previousKey);
    restore("OXLM_API_KEY", previousOxlm);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const defaultHandler: Handler = (state) => (req, res) => {
  const url = req.url ?? "";
  state.requests.push(`${req.method ?? ""} ${url}`);

  if (req.method === "GET" && url === "/v1/models/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        models: state.loaded.map((id) => ({ id, loaded: true })),
      }),
    );
    return;
  }

  const match = /^\/v1\/models\/(.+)\/unload$/.exec(url);
  if (req.method === "POST" && match) {
    const id = decodeURIComponent(match[1]);
    const override = state.unloadResponse?.(id);
    if (override) {
      res.writeHead(override.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(override.body));
      return;
    }
    state.loaded = state.loaded.filter((loaded) => loaded !== id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: "not found" } }));
};

test("載っておるモデルを降ろし、降りたことを確かめてから返す", async () => {
  const state: MockState = { loaded: ["gemma-4-31b-it-4bit"], requests: [] };

  await withMockOmlx(state, defaultHandler, async (mock) => {
    const result = await unloadLocalLlmModels();

    assert.deepEqual(result.unloaded, ["gemma-4-31b-it-4bit"]);
    assert.match(result.message, /解放しました/);
    assert.deepEqual(mock.loaded, []);
    // 解放の後に「本当に降りたか」を訊き直しておる
    assert.ok(
      mock.requests.filter((r) => r === "GET /v1/models/status").length >= 2,
    );
  });
});

test("何も載っておらねば、解放の要求は出さぬ", async () => {
  const state: MockState = { loaded: [], requests: [] };

  await withMockOmlx(state, defaultHandler, async (mock) => {
    const result = await unloadLocalLlmModels();

    assert.deepEqual(result.unloaded, []);
    assert.match(result.message, /載っておるモデルはありません/);
    assert.deepEqual(
      mock.requests.filter((r) => r.startsWith("POST")),
      [],
    );
  });
});

test("自動解放と競合した 400 は成功とみなす", async () => {
  const state: MockState = {
    loaded: ["gemma-4-31b-it-4bit"],
    requests: [],
    unloadResponse: () => ({
      status: 400,
      body: { error: { message: "Model not loaded: gemma-4-31b-it-4bit" } },
    }),
  };

  await withMockOmlx(state, defaultHandler, async (mock) => {
    // 400 を返したうえで、向こうは既に降りておる
    mock.loaded = [];
    const result = await unloadLocalLlmModels();
    assert.match(result.message, /解放しました|載っておるモデルはありません/);
  });
});

test("解放を断られたら、黙って進まずに弾く", async () => {
  const state: MockState = {
    loaded: ["gemma-4-31b-it-4bit"],
    requests: [],
    unloadResponse: () => ({
      status: 500,
      body: { error: { message: "engine busy" } },
    }),
  };

  await withMockOmlx(state, defaultHandler, async () => {
    await assert.rejects(
      unloadLocalLlmModels(),
      /解放できませんでした.*engine busy/,
    );
  });
});

test("oMLX に繋がらぬときは、解放は要らぬとみなして通す", async () => {
  const previousBase = process.env.LOCAL_LLM_BASE_URL;
  const previousKey = process.env.LOCAL_LLM_API_KEY;
  // 使われておらぬポートへ向ける(接続拒否)
  process.env.LOCAL_LLM_BASE_URL = "http://127.0.0.1:1/v1";
  process.env.LOCAL_LLM_API_KEY = "test-key";

  try {
    const result = await unloadLocalLlmModels();
    assert.deepEqual(result.unloaded, []);
    assert.match(result.message, /繋がらぬ/);
  } finally {
    if (previousBase === undefined) delete process.env.LOCAL_LLM_BASE_URL;
    else process.env.LOCAL_LLM_BASE_URL = previousBase;
    if (previousKey === undefined) delete process.env.LOCAL_LLM_API_KEY;
    else process.env.LOCAL_LLM_API_KEY = previousKey;
  }
});
