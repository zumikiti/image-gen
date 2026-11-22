import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { generateImage } from "../src/lib/generate.ts";

test("provider が mflux のモデルは mflux クライアントへ振り分ける", async () => {
  const png = Buffer.from("dispatched");
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64") }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  const previous = process.env.MFLUX_BASE_URL;
  process.env.MFLUX_BASE_URL = `http://127.0.0.1:${port}/v1`;

  try {
    const buffer = await generateImage({
      prompt: "a red boat",
      model: "mflux",
      size: "1024x1024",
      quality: "auto",
    });
    assert.deepEqual(buffer, png);
  } finally {
    if (previous === undefined) delete process.env.MFLUX_BASE_URL;
    else process.env.MFLUX_BASE_URL = previous;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
