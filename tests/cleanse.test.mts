import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { cleansePrompt, CLEANSE_SYSTEM_PROMPT } from "../src/lib/cleanse.ts";

interface CapturedRequest {
  body: Record<string, unknown>;
}

/** リクエストを捕まえて固定の ChatCompletion 応答を返す簡易サーバーを立てる */
function startMockServer() {
  const captured: CapturedRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      captured.push({ body });
      const reply = {
        choices: [{ message: { content: "REDRAWN_PROMPT" } }],
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });
  return {
    server,
    captured: () => captured,
    async url(): Promise<string> {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const { port } = server.address() as AddressInfo;
      return `http://127.0.0.1:${port}/v1`;
    },
  };
}

test("cleansePrompt はシステム指示・コンテキスト・ユーザープロンプトを送り、応答本文を返す", async () => {
  const mock = startMockServer();
  const baseUrl = await mock.url();

  const prevBase = process.env.LOCAL_LLM_BASE_URL;
  const prevKey = process.env.LOCAL_LLM_API_KEY;
  process.env.LOCAL_LLM_API_KEY = "test-key";
  process.env.LOCAL_LLM_BASE_URL = baseUrl;

  try {
    const result = await cleansePrompt(
      "赤い船",
      "油絵調のファンタジー。暖色主体。",
    );

    assert.equal(result, "REDRAWN_PROMPT");
    const { body } = mock.captured()[0];
    const messages = body.messages as Array<{ role: string; content: string }>;
    assert.equal(messages.length, 3);
    assert.equal(messages[0].role, "system");
    assert.equal(messages[0].content, CLEANSE_SYSTEM_PROMPT);
    assert.equal(messages[1].role, "user");
    assert.ok(messages[1].content.includes("油絵調のファンタジー"));
    assert.equal(messages[2].role, "user");
    assert.equal(messages[2].content, "赤い船");
  } finally {
    if (prevBase === undefined) delete process.env.LOCAL_LLM_BASE_URL;
    else process.env.LOCAL_LLM_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.LOCAL_LLM_API_KEY;
    else process.env.LOCAL_LLM_API_KEY = prevKey;
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});

test("cleansePrompt はコンテキスト無しならプロンプトだけを送る", async () => {
  const mock = startMockServer();
  const baseUrl = await mock.url();

  const prevBase = process.env.LOCAL_LLM_BASE_URL;
  const prevKey = process.env.LOCAL_LLM_API_KEY;
  process.env.LOCAL_LLM_API_KEY = "test-key";
  process.env.LOCAL_LLM_BASE_URL = baseUrl;

  try {
    await cleansePrompt("青い空");

    const { body } = mock.captured()[0];
    const messages = body.messages as Array<{ role: string; content: string }>;
    assert.equal(messages.length, 2);
    assert.equal(messages[1].content, "青い空");
  } finally {
    if (prevBase === undefined) delete process.env.LOCAL_LLM_BASE_URL;
    else process.env.LOCAL_LLM_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.LOCAL_LLM_API_KEY;
    else process.env.LOCAL_LLM_API_KEY = prevKey;
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  }
});
