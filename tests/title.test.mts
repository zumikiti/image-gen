import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TITLE_LENGTH, normalizeTitle } from "../src/lib/title.ts";

test("前後の空白を落とし、改行や連続空白は 1 つの空白に畳む", () => {
  assert.deepEqual(normalizeTitle("  赤い船\nと 夕焼け  "), {
    ok: true,
    title: "赤い船 と 夕焼け",
  });
});

test("空文字と空白だけは null(未設定)になる", () => {
  assert.deepEqual(normalizeTitle(""), { ok: true, title: null });
  assert.deepEqual(normalizeTitle("   \n\t　 "), { ok: true, title: null });
});

test("上限ちょうどは通り、超えたら弾く", () => {
  assert.deepEqual(normalizeTitle("あ".repeat(MAX_TITLE_LENGTH)), {
    ok: true,
    title: "あ".repeat(MAX_TITLE_LENGTH),
  });

  const tooLong = normalizeTitle("あ".repeat(MAX_TITLE_LENGTH + 1));
  assert.equal(tooLong.ok, false);
});

test("絵文字はコードポイントで数える(2 文字と数えぬ)", () => {
  const emoji = "😀".repeat(MAX_TITLE_LENGTH);
  assert.equal(emoji.length, MAX_TITLE_LENGTH * 2, "前提: UTF-16 では 2 倍");
  assert.deepEqual(normalizeTitle(emoji), { ok: true, title: emoji });
});
