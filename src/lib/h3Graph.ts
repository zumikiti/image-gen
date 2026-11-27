/**
 * MiniMax H3 の API 形式グラフ(`h3/skeleton.json`)を依頼に合わせて書き換える純関数。
 *
 * ノード ID は決め打ちせず **class_type で探し、リンクを 1 ホップ辿る**。
 * ComfyUI の UI でノードを足し引きしても番号は変わるゆえ、番号を埋め込むと
 * 静かに壊れる。壊れ方は「30 分待って出来損ないが出る」ゆえ、ここは厳しく検査する。
 */

import type { VideoAspect } from "./types";

export interface H3Node {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: unknown;
}

/** ComfyUI の `/prompt` が受ける形。ノード ID をキーにした平坦な辞書じゃ */
export type H3Graph = Record<string, H3Node>;

export const FRAME_RATE = 24;

/**
 * 要求した秒数を H3 の尺へ丸める。skeleton の数式
 * `max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17` と同じ計算じゃ。
 */
export function framesForSeconds(seconds: number): number {
  const rounded = Math.max(5, Math.round(seconds * FRAME_RATE));
  // ComfyUI の数式は Python と同じ「負にならぬ剰余」じゃ。JS の % は負を返すゆえ畳む
  const adjust = (((5 - (rounded % 17)) % 17) + 17) % 17;
  return rounded + adjust;
}

/** フレーム数から実尺(秒)を出す。画面に「5 秒 → 5.17 秒」と出すために使う */
export function secondsForFrames(frames: number): number {
  return frames / FRAME_RATE;
}

export interface H3Overrides {
  prompt: string;
  /** ComfyUI の `input/` に置いた画像のファイル名 */
  firstFrameImage: string;
  /** 要求した秒数。丸めはここで行う */
  seconds: number;
  seed: number;
  aspect: VideoAspect;
  /** 出力の filename_prefix。動画 ID を混ぜて識別できるようにする */
  prefix: string;
}

function findAll(graph: H3Graph, classType: string): H3Node[] {
  return Object.values(graph).filter((node) => node?.class_type === classType);
}

function findOne(graph: H3Graph, classType: string, what: string): H3Node {
  const found = findAll(graph, classType)[0];
  if (!found) {
    throw new Error(
      `グラフに ${classType} がありません(${what})。ComfyUI で workflow を確かめ、skeleton を取り直してください`,
    );
  }
  return found;
}

/** `[ノードID, 出力番号]` のリンクを 1 ホップ辿る */
function resolveLink(graph: H3Graph, value: unknown): H3Node | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [id] = value;
  if (typeof id !== "string" && typeof id !== "number") return undefined;
  return graph[String(id)];
}

/**
 * 尺の入力(秒を保持する上流ノード)を探す。
 * 数式ノードの `values.a` を辿るゆえ、丸めの式を書き換えずに済む。
 */
function findDurationInput(graph: H3Graph): H3Node {
  for (const expression of findAll(graph, "ComfyMathExpression")) {
    if (!String(expression.inputs.expression ?? "").includes("24")) continue;
    const upstream = resolveLink(graph, expression.inputs["values.a"]);
    if (upstream && typeof upstream.inputs.value === "number") {
      return upstream;
    }
  }
  throw new Error(
    "グラフに尺(秒)の入力が見つかりません。skeleton を取り直してください",
  );
}

/**
 * 依頼を反映した新しいグラフを返す。引数のグラフは書き換えぬ
 * (テンプレートを毎回そのまま使い回すためじゃ)。
 */
export function applyH3Overrides(
  graph: H3Graph,
  overrides: H3Overrides,
): H3Graph {
  const next = structuredClone(graph);

  findOne(next, "MiniMaxH3ImageToVideo", "プロンプト").inputs.prompt =
    overrides.prompt;

  findOne(next, "LoadImage", "最初のコマ").inputs.image =
    overrides.firstFrameImage;

  findDurationInput(next).inputs.value = overrides.seconds;

  findOne(next, "RandomNoise", "seed").inputs.noise_seed = overrides.seed;

  // ResolutionSelector は無くても動く(幅と高さが直に書かれた workflow もある)
  const resolution = findAll(next, "ResolutionSelector")[0];
  if (resolution) {
    resolution.inputs.aspect_ratio = overrides.aspect;
  }

  const save = findAll(next, "SaveVideo")[0] ?? findAll(next, "SaveImage")[0];
  if (!save) {
    throw new Error(
      "グラフに保存ノードがありません。skeleton を取り直してください",
    );
  }
  save.inputs.filename_prefix = overrides.prefix;

  return next;
}
