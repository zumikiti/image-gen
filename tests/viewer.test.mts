import { test } from "node:test";
import assert from "node:assert/strict";
import {
  indexOfImage,
  resolveInitialImageId,
  stepIndex,
} from "../src/lib/viewer.ts";

const image = (id: string) => ({ id });

test("端では止まり、巡回せぬ", () => {
  assert.equal(stepIndex(0, 3, -1), 0, "先頭で戻っても先頭");
  assert.equal(stepIndex(2, 3, 1), 2, "末尾で進んでも末尾");
  assert.equal(stepIndex(0, 3, 1), 1);
  assert.equal(stepIndex(2, 3, -1), 1);
});

test("1 枚しか無ければ動かぬ", () => {
  assert.equal(stepIndex(0, 1, 1), 0);
  assert.equal(stepIndex(0, 1, -1), 0);
});

test("空の一覧には開く先が無い", () => {
  assert.equal(stepIndex(0, 0, 1), -1);
});

test("id から位置を引ける。無ければ -1", () => {
  const images = [image("a"), image("b")];
  assert.equal(indexOfImage(images, "b"), 1);
  assert.equal(indexOfImage(images, "z"), -1);
});

test("URL の id は一覧にあるものだけ受け付ける", () => {
  const images = [image("a"), image("b")];
  assert.equal(resolveInitialImageId("b", images), "b");
  assert.equal(resolveInitialImageId("z", images), null, "削除済みの墓標");
  assert.equal(resolveInitialImageId(undefined, images), null);
  assert.equal(resolveInitialImageId("", images), null);
});

test("?image=a&image=b のように重複したら先頭を使う", () => {
  const images = [image("a"), image("b")];
  assert.equal(resolveInitialImageId(["b", "a"], images), "b");
});
