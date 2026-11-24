import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesQuery,
  normalizeForSearch,
  searchableText,
} from "../src/lib/search.ts";

test("全角半角・大文字小文字・カタカナひらがなの揺れを潰す", () => {
  const normalized = normalizeForSearch("ｷﾞｬﾗﾘｰ GALLERY");
  assert.equal(normalized, "ぎゃらりー gallery");
});

test("空白区切りの語はすべて含むものだけに当たる(フィールドをまたいでよい)", () => {
  const image = { title: "猫の肖像", prompt: "A cinematic shot of a cat" };

  assert.equal(matchesQuery(image, "猫"), true, "タイトルで当たる");
  assert.equal(matchesQuery(image, "ぎゃらりー"), false, "含まぬ語は当たらぬ");
  assert.equal(
    matchesQuery(image, "猫 cinematic"),
    true,
    "タイトルとプロンプトをまたいだ AND",
  );
  assert.equal(
    matchesQuery(image, "猫 犬"),
    false,
    "片方しか含まぬ AND は当たらぬ",
  );
});

test("ひらがなで打ってもカタカナの語に当たる", () => {
  const image = { title: "シネマティックな夜景", prompt: "" };
  assert.equal(matchesQuery(image, "しねまてぃっく"), true);
});

test("空のクエリは全件に当たる", () => {
  const image = { title: null, prompt: "anything" };
  assert.equal(matchesQuery(image, ""), true);
  assert.equal(matchesQuery(image, "   "), true);
});

test("タイトル未設定でもプロンプトで当たる", () => {
  const image = { title: null, prompt: "A red boat at sunset" };
  assert.equal(matchesQuery(image, "RED boat"), true);
  assert.equal(searchableText(image), "\nA red boat at sunset");
});
