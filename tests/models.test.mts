import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  findModel,
} from "../src/lib/models.ts";
import {
  LARGE_SIZES,
  QUALITIES,
  SIZES,
  STANDARD_SIZES,
} from "../src/lib/types.ts";

test("findModel は既知の id を返し、未知は undefined", () => {
  assert.equal(findModel("mflux")?.provider, "mflux");
  assert.equal(findModel("gpt-image-1")?.provider, undefined);
  assert.equal(findModel("no-such-model"), undefined);
});

test("既定モデルはカタログに存在する", () => {
  assert.ok(findModel(DEFAULT_MODEL_ID), "DEFAULT_MODEL_ID がカタログに無い");
});

test("カタログの宣言は型の語彙に収まる", () => {
  for (const model of MODEL_CATALOG) {
    assert.ok(model.sizes.length > 0, `${model.id}: sizes が空`);
    assert.ok(model.qualities.length > 0, `${model.id}: qualities が空`);

    for (const size of model.sizes) {
      assert.ok(
        (SIZES as readonly string[]).includes(size),
        `${model.id}: 未知の size ${size}`,
      );
    }
    for (const quality of model.qualities) {
      assert.ok(
        (QUALITIES as readonly string[]).includes(quality),
        `${model.id}: 未知の quality ${quality}`,
      );
    }
  }
});

test("OpenAI 系は標準 3 種のみ、mflux は大判も選べる", () => {
  for (const model of MODEL_CATALOG) {
    if (model.provider === "mflux") {
      assert.deepEqual(model.sizes, SIZES, `${model.id}: 大判が選べない`);
    } else {
      assert.deepEqual(
        model.sizes,
        STANDARD_SIZES,
        `${model.id}: OpenAI 系は標準 3 種に限る`,
      );
    }
  }
});

test("大判は 16 の倍数かつ 4096 以下", () => {
  for (const size of LARGE_SIZES) {
    const [w, h] = size.split("x").map(Number);
    for (const n of [w, h]) {
      assert.ok(Number.isInteger(n), `${size}: 数値でない`);
      assert.equal(n % 16, 0, `${size}: 16 の倍数でない`);
      assert.ok(n > 0 && n <= 4096, `${size}: 1..4096 の外`);
    }
  }
});
