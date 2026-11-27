import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  applyH3Overrides,
  framesForSeconds,
  secondsForFrames,
  type H3Graph,
  type H3Node,
  type H3Overrides,
} from "../src/lib/h3Graph.ts";

const SKELETON_PATH = path.join(process.cwd(), "h3", "skeleton.json");

function loadSkeleton(): H3Graph {
  return JSON.parse(fs.readFileSync(SKELETON_PATH, "utf8")) as H3Graph;
}

function findByClass(graph: H3Graph, classType: string): H3Node | undefined {
  return Object.values(graph).find((node) => node.class_type === classType);
}

const OVERRIDES: H3Overrides = {
  prompt: "テスト用のプロンプト",
  firstFrameImage: "abc.png",
  seconds: 5,
  seed: 12345,
  aspect: "9:16 (Portrait Widescreen)",
  prefix: "video/test",
};

test("尺は 17k+5 フレームに丸まる", () => {
  assert.equal(framesForSeconds(5), 124);
  assert.equal(secondsForFrames(124), 124 / 24);

  for (let seconds = 3; seconds <= 10; seconds += 1) {
    const frames = framesForSeconds(seconds);
    assert.equal(frames % 17, 5, `${seconds} 秒が 17k+5 になっていない`);
    assert.ok(frames >= 5);
    // 要求した尺より短くならぬ(丸めは切り上げ側)
    assert.ok(frames >= seconds * 24, `${seconds} 秒が短く丸まりすぎておる`);
  }
});

test("要求した尺が長いほどフレームも増える", () => {
  const frames = [3, 4, 5, 6, 7, 8, 9, 10].map(framesForSeconds);
  for (let i = 1; i < frames.length; i += 1) {
    assert.ok(frames[i] > frames[i - 1], `単調増加でない: ${frames}`);
  }
});

test("同梱の skeleton に、差し替えるべきノードが揃っておる", () => {
  const skeleton = loadSkeleton();

  for (const classType of [
    "MiniMaxH3ImageToVideo",
    "LoadImage",
    "RandomNoise",
    "ResolutionSelector",
    "SaveVideo",
    "ComfyMathExpression",
  ]) {
    assert.ok(
      findByClass(skeleton, classType),
      `${classType} が skeleton に無い`,
    );
  }
});

test("skeleton を書き換えると、依頼の値が入る", () => {
  const skeleton = loadSkeleton();
  const graph = applyH3Overrides(skeleton, OVERRIDES);

  assert.equal(
    findByClass(graph, "MiniMaxH3ImageToVideo")?.inputs.prompt,
    OVERRIDES.prompt,
  );
  assert.equal(findByClass(graph, "LoadImage")?.inputs.image, "abc.png");
  assert.equal(findByClass(graph, "RandomNoise")?.inputs.noise_seed, 12345);
  assert.equal(
    findByClass(graph, "ResolutionSelector")?.inputs.aspect_ratio,
    "9:16 (Portrait Widescreen)",
  );
  assert.equal(
    findByClass(graph, "SaveVideo")?.inputs.filename_prefix,
    "video/test",
  );

  // 尺は数式ノードの上流(秒を保持する側)へ入る
  const expression = findByClass(graph, "ComfyMathExpression");
  assert.equal(expression?.inputs["values.a"]?.constructor, Array);
  const [upstreamId] = expression?.inputs["values.a"] as [string, number];
  assert.equal(graph[upstreamId]?.inputs.value, 5);
});

test("元のグラフは書き換えぬ(テンプレートを使い回すため)", () => {
  const skeleton = loadSkeleton();
  const before = JSON.stringify(skeleton);

  applyH3Overrides(skeleton, { ...OVERRIDES, prompt: "別のプロンプト" });
  applyH3Overrides(skeleton, { ...OVERRIDES, prompt: "さらに別" });

  assert.equal(JSON.stringify(skeleton), before);
});

test("ノード ID が変わっても class_type で追従する", () => {
  // UI でノードを足し引きすれば番号は変わる。番号を埋め込んでおらぬことを確かめる
  const synthetic: H3Graph = {
    "901": { class_type: "MiniMaxH3ImageToVideo", inputs: { prompt: "" } },
    "902": { class_type: "LoadImage", inputs: { image: "" } },
    "903": {
      class_type: "ComfyMathExpression",
      inputs: {
        expression:
          "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17",
        "values.a": ["904", 0],
      },
    },
    "904": { class_type: "PrimitiveFloat", inputs: { value: 5 } },
    "905": { class_type: "RandomNoise", inputs: { noise_seed: 0 } },
    "906": {
      class_type: "ResolutionSelector",
      inputs: { aspect_ratio: "1:1 (Square)" },
    },
    "907": { class_type: "SaveVideo", inputs: { filename_prefix: "old" } },
  };

  const graph = applyH3Overrides(synthetic, OVERRIDES);

  assert.equal(graph["901"].inputs.prompt, OVERRIDES.prompt);
  assert.equal(graph["902"].inputs.image, "abc.png");
  assert.equal(graph["904"].inputs.value, 5);
  assert.equal(graph["905"].inputs.noise_seed, 12345);
  assert.equal(graph["906"].inputs.aspect_ratio, OVERRIDES.aspect);
  assert.equal(graph["907"].inputs.filename_prefix, "video/test");
});

test("要るノードが欠けておれば、黙って進まずに弾く", () => {
  const broken: H3Graph = {
    "1": { class_type: "MiniMaxH3ImageToVideo", inputs: { prompt: "" } },
  };

  assert.throws(() => applyH3Overrides(broken, OVERRIDES), /LoadImage/);
});
