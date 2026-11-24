import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PIXIV_TAG_MAX_COUNT,
  PIXIV_TITLE_MAX_LENGTH,
  normalizePixivTags,
  normalizePixivTitle,
  parsePixivDraft,
} from "../src/lib/pixiv.ts";

test("題名は単一行に畳み、pixiv の上限で切り詰める", () => {
  assert.equal(
    normalizePixivTitle("  赤い船\nと 夕焼け  "),
    "赤い船 と 夕焼け",
  );
  assert.equal(
    normalizePixivTitle("あ".repeat(PIXIV_TITLE_MAX_LENGTH + 5)),
    "あ".repeat(PIXIV_TITLE_MAX_LENGTH),
  );
});

test("題名の切り詰めは絵文字を割らない(コードポイントで数える)", () => {
  const emoji = "😀".repeat(PIXIV_TITLE_MAX_LENGTH + 3);
  const title = normalizePixivTitle(emoji);
  assert.equal([...title].length, PIXIV_TITLE_MAX_LENGTH);
  assert.equal(title, "😀".repeat(PIXIV_TITLE_MAX_LENGTH));
});

test("タグはカンマ・読点・空白のどれでも区切り、空と重複を落とす", () => {
  assert.deepEqual(normalizePixivTags("少女, 夕焼け、海  少女"), [
    "少女",
    "夕焼け",
    "海",
  ]);
});

test("タグは上限の個数で打ち切る", () => {
  const tags = normalizePixivTags(
    Array.from({ length: PIXIV_TAG_MAX_COUNT + 4 }, (_, i) => `tag${i}`),
  );
  assert.equal(tags.length, PIXIV_TAG_MAX_COUNT);
});

test("コードフェンスや前置きが混ざった応答からも下書きを取り出す", () => {
  const raw = [
    "はい、できました。",
    "```json",
    '{"title":"夕焼けの少女","tags":["夕焼け","海"],"caption":"海辺の一枚です。"}',
    "```",
  ].join("\n");

  assert.deepEqual(parsePixivDraft(raw), {
    ok: true,
    draft: {
      title: "夕焼けの少女",
      tags: ["夕焼け", "海"],
      caption: "海辺の一枚です。",
    },
  });
});

test("題名やキャプションが欠けた応答、JSON でない応答は弾く", () => {
  assert.equal(
    parsePixivDraft('{"tags": [], "caption": "no title"}').ok,
    false,
  );
  assert.equal(parsePixivDraft('{"title": "t", "tags": []}').ok, false);
  assert.equal(parsePixivDraft("これは JSON ではない").ok, false);
});
