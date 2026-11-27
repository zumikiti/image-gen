import { test } from "node:test";
import assert from "node:assert/strict";

import { isVideoAspect, normalizeSeconds } from "../src/lib/videos.ts";
import { VIDEO_ASPECTS, VIDEO_SECONDS } from "../src/lib/types.ts";

test("尺は範囲内の整数だけを受け付ける", () => {
  assert.equal(normalizeSeconds(5), 5);
  assert.equal(normalizeSeconds(5.4), 5);
  assert.equal(normalizeSeconds(VIDEO_SECONDS.min), VIDEO_SECONDS.min);
  assert.equal(normalizeSeconds(VIDEO_SECONDS.max), VIDEO_SECONDS.max);

  assert.equal(normalizeSeconds(VIDEO_SECONDS.min - 1), undefined);
  assert.equal(normalizeSeconds(VIDEO_SECONDS.max + 1), undefined);
  assert.equal(normalizeSeconds("5"), undefined);
  assert.equal(normalizeSeconds(Number.NaN), undefined);
  assert.equal(normalizeSeconds(undefined), undefined);
});

test("アスペクトは ComfyUI が受ける 8 種だけを通す", () => {
  assert.equal(VIDEO_ASPECTS.length, 8);
  for (const aspect of VIDEO_ASPECTS) {
    assert.ok(isVideoAspect(aspect), `${aspect} が弾かれた`);
  }

  assert.equal(isVideoAspect("1:1"), false);
  assert.equal(isVideoAspect(""), false);
  assert.equal(isVideoAspect(undefined), false);
});
