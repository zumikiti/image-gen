import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THUMB_WIDTH,
  originalUrl,
  parseThumbWidth,
  THUMB_WIDTH_RANGE,
  thumbUrl,
} from "../src/lib/thumbnail.ts";

test("?w= は範囲内の整数だけを受け付ける", () => {
  assert.equal(parseThumbWidth("600"), 600);
  assert.equal(
    parseThumbWidth(String(THUMB_WIDTH_RANGE.min)),
    THUMB_WIDTH_RANGE.min,
  );
  assert.equal(
    parseThumbWidth(String(THUMB_WIDTH_RANGE.max)),
    THUMB_WIDTH_RANGE.max,
  );
  assert.equal(parseThumbWidth(" 400 "), 400);

  assert.equal(parseThumbWidth(String(THUMB_WIDTH_RANGE.min - 1)), undefined);
  assert.equal(parseThumbWidth(String(THUMB_WIDTH_RANGE.max + 1)), undefined);
  assert.equal(parseThumbWidth("600.5"), undefined);
  assert.equal(parseThumbWidth("-600"), undefined);
  assert.equal(parseThumbWidth("abc"), undefined);
  assert.equal(parseThumbWidth(""), undefined);
  // 未指定は「原本を返す」を意味するゆえ、不正と同じ undefined でも呼び出し側が区別する
  assert.equal(parseThumbWidth(null), undefined);
});

test("サムネイルの URL は幅を含み、原本の URL は含まぬ", () => {
  assert.equal(thumbUrl("abc-123"), "/api/images/abc-123?w=600");
  assert.equal(thumbUrl("abc-123", 200), "/api/images/abc-123?w=200");
  assert.equal(DEFAULT_THUMB_WIDTH, 600);
  assert.equal(originalUrl("abc-123"), "/api/images/abc-123");
});
