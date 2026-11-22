import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { generateWithMflux } from "../src/lib/mflux.ts";

type Handler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void | Promise<void>;

/** モックサーバーを立て、MFLUX_BASE_URL をそこへ向けてから fn を走らせる */
async function withMockServer(
  handler: Handler,
  fn: (port: number) => Promise<void>,
) {
  const server = http.createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const previousBase = process.env.MFLUX_BASE_URL;
  const previousModel = process.env.MFLUX_MODEL;
  process.env.MFLUX_BASE_URL = `http://127.0.0.1:${port}/v1`;

  try {
    await fn(port);
  } finally {
    if (previousBase === undefined) delete process.env.MFLUX_BASE_URL;
    else process.env.MFLUX_BASE_URL = previousBase;
    if (previousModel === undefined) delete process.env.MFLUX_MODEL;
    else process.env.MFLUX_MODEL = previousModel;

    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** リクエスト本文を読む */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

const INPUT = {
  prompt: "a red boat",
  model: "mflux",
  size: "1024x1024",
  quality: "auto",
} as const;

test("b64_json を受け取り、送信内容も期待どおり", async () => {
  const png = Buffer.from("fake-png-bytes");

  await withMockServer(
    async (req, res) => {
      const body = JSON.parse(await readBody(req));

      assert.equal(req.method, "POST");
      assert.equal(req.url, "/v1/images/generations");
      assert.equal(req.headers["content-type"], "application/json");
      assert.equal(body.model, "mflux");
      assert.equal(body.prompt, INPUT.prompt);
      assert.equal(body.size, "1024x1024");
      assert.equal(body.quality, "auto");
      assert.equal(body.n, 1);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
    },
    async () => {
      const buffer = await generateWithMflux({ ...INPUT });
      assert.deepEqual(buffer, png);
    },
  );
});

test("MFLUX_MODEL があればカタログ ID より優先する", async () => {
  process.env.MFLUX_MODEL = "z-image-turbo";

  await withMockServer(
    async (req, res) => {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.model, "z-image-turbo");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: "aGk=" }] }));
    },
    async () => {
      await generateWithMflux({ ...INPUT });
    },
  );
});

test("url だけが返れば取得して Buffer 化する", async () => {
  const png = Buffer.from("from-url");

  await withMockServer(
    (req, res) => {
      if (req.url === "/v1/images/generations") {
        res.writeHead(200, { "Content-Type": "application/json" });
        const origin = `http://${req.headers.host}`;
        res.end(JSON.stringify({ data: [{ url: `${origin}/image.png` }] }));
        return;
      }
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(png);
    },
    async () => {
      const buffer = await generateWithMflux({ ...INPUT });
      assert.deepEqual(buffer, png);
    },
  );
});

test("エラー封筒の message を例外の文言にする", async () => {
  await withMockServer(
    (_req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad prompt" } }));
    },
    async () => {
      await assert.rejects(() => generateWithMflux({ ...INPUT }), /bad prompt/);
    },
  );
});

test("JSON でない 200 応答は解釈できないと断る", async () => {
  await withMockServer(
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("not json");
    },
    async () => {
      await assert.rejects(
        () => generateWithMflux({ ...INPUT }),
        /JSON として解釈できませんでした/,
      );
    },
  );
});

test("画像データが空なら断る", async () => {
  await withMockServer(
    (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
    },
    async () => {
      await assert.rejects(
        () => generateWithMflux({ ...INPUT }),
        /画像データが含まれていません/,
      );
    },
  );
});

test("MFLUX_BASE_URL 未設定なら設定を促す", async () => {
  const previous = process.env.MFLUX_BASE_URL;
  delete process.env.MFLUX_BASE_URL;

  try {
    await assert.rejects(
      () => generateWithMflux({ ...INPUT }),
      /MFLUX_BASE_URL/,
    );
  } finally {
    if (previous !== undefined) process.env.MFLUX_BASE_URL = previous;
  }
});
