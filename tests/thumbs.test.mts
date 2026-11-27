import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import sharp from "sharp";

import { encodeThumb, getOrCreateThumb } from "../src/lib/thumbs.ts";
import {
  deleteImageFile,
  saveImageFile,
  thumbFilePath,
} from "../src/lib/storage.ts";

/** 変換の元になる PNG をその場で作る(網掛けゆえ webp で縮む) */
async function samplePng(width = 300, height = 200): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = (x * 7) % 256;
      pixels[offset + 1] = (y * 11) % 256;
      pixels[offset + 2] = (x + y) % 256;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

test("encodeThumb は正方形の webp を返す(横長は切り抜く)", async () => {
  const png = await samplePng(300, 200);
  const webp = await encodeThumb(png, 200);

  assert.ok(isWebp(webp), "webp になっていない");
  const meta = await sharp(webp).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 200);
  assert.equal(meta.height, 200);
  assert.ok(webp.length < png.length, "元の PNG より重くなっておる");
});

test("getOrCreateThumb は初回に作り、以後はキャッシュから返す", async () => {
  const previousCwd = process.cwd();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "image-gen-thumbs-"));

  try {
    process.chdir(workDir);
    const png = await samplePng(240, 160);
    saveImageFile("abc", png);

    const first = await getOrCreateThumb("abc", 128);
    assert.ok(first && isWebp(first));
    assert.ok(
      fs.existsSync(thumbFilePath("abc", 128)),
      "キャッシュが置かれておらぬ",
    );

    // 原本を消しても、キャッシュから返ること(＝変換し直していない)
    fs.unlinkSync(path.join(workDir, "data", "images", "abc.png"));
    const second = await getOrCreateThumb("abc", 128);
    assert.deepEqual(second, first);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("原本を消すと、同じ id の派生も消える", async () => {
  const previousCwd = process.cwd();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "image-gen-thumbs-"));

  try {
    process.chdir(workDir);
    saveImageFile("xyz", await samplePng());
    await getOrCreateThumb("xyz", 128);
    await getOrCreateThumb("xyz", 256);

    assert.ok(fs.existsSync(thumbFilePath("xyz", 128)));
    assert.ok(fs.existsSync(thumbFilePath("xyz", 256)));

    deleteImageFile("xyz");

    assert.equal(fs.existsSync(thumbFilePath("xyz", 128)), false);
    assert.equal(fs.existsSync(thumbFilePath("xyz", 256)), false);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test("原本が無ければ undefined を返す(呼び出し側は 404 へ落ちる)", async () => {
  const previousCwd = process.cwd();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "image-gen-thumbs-"));

  try {
    process.chdir(workDir);
    assert.equal(await getOrCreateThumb("missing", 128), undefined);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});
