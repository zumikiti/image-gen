/**
 * 動画生成(Video Generation)の進行係。
 *
 * 状態の真実は ComfyUI の側にあり、こちらは `comfy_prompt_id` を持って
 * **訊きに行く**だけじゃ。常駐のワーカーは置かぬゆえ、一覧を開いた者が
 * `syncVideos` を呼び、そのときに完了品を回収する。
 *
 * deliberate: ゆえに誰も一覧を開かぬ間は mp4 が回収されぬ。ComfyUI の
 * `output/` と history を消さぬ限り後から回収できるので、困るまで放置する。
 */

import * as fs from "node:fs";
import * as path from "node:path";

import {
  getVideo,
  getImage,
  insertVideo,
  listVideos,
  updateVideoState,
} from "./db";
import { readImageFile, saveVideoFile } from "./storage";
import {
  deleteQueued,
  downloadVideo,
  getHistory,
  getQueue,
  interrupt,
  submitPrompt,
  uploadImage,
  type ComfyHistoryEntry,
} from "./comfyui";
import { applyH3Overrides, framesForSeconds, type H3Graph } from "./h3Graph";
import {
  VIDEO_ASPECTS,
  VIDEO_SECONDS,
  type GeneratedVideo,
  type VideoAspect,
  type VideoGenerationInput,
} from "./types";

/** 形が正しければ秒数として通す */
export function normalizeSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const seconds = Math.round(value);
  if (seconds < VIDEO_SECONDS.min) return undefined;
  if (seconds > VIDEO_SECONDS.max) return undefined;
  return seconds;
}

export function isVideoAspect(value: unknown): value is VideoAspect {
  return (
    typeof value === "string" &&
    (VIDEO_ASPECTS as readonly string[]).includes(value)
  );
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** 投入直後は queue にも history にも現れないことがある。この間は状態を動かさぬ */
const LOST_GRACE_MS = 2 * 60_000;

function skeletonPath(): string {
  const configured = process.env.H3_SKELETON_PATH?.trim();
  if (configured) {
    // 任意のパスを許すと Turbopack がプロジェクト全体を辿るゆえ、明示的に外す
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
  }
  return path.join(process.cwd(), "h3", "skeleton.json");
}

/**
 * skeleton(API 形式のグラフ)を読む。テンプレートは不動ゆえ、
 * 投入のたびに読み直すだけで汚れぬ。
 */
export function loadSkeleton(): H3Graph {
  const file = skeletonPath();
  let raw: string;
  try {
    raw = fs.readFileSync(/* turbopackIgnore: true */ file, "utf8");
  } catch {
    throw new Error(
      `skeleton が読めません: ${file}。リポジトリの h3/skeleton.json を確かめてください`,
    );
  }
  return JSON.parse(raw) as H3Graph;
}

/**
 * 動画を 1 本投入する。mp4 はまだ無い(完成は 30 分後じゃ)。
 * 戻り値は「待ち」の状態を持つ 1 件で、以後は `syncVideos` が面倒を見る。
 */
export async function createVideo(
  input: VideoGenerationInput,
): Promise<GeneratedVideo> {
  const image = getImage(input.firstFrameImageId);
  if (!image) {
    throw new Error("最初のコマに選んだ画像が見つかりません");
  }

  const png = readImageFile(image.id);
  if (!png) {
    throw new Error("最初のコマに選んだ画像のファイルがありません");
  }

  const id = crypto.randomUUID();
  const frames = framesForSeconds(input.seconds);
  const seed = input.seed ?? randomSeed();

  // 画像を先に送る。名前は動画 ID に揃え、ComfyUI 側でも追えるようにする
  const uploaded = await uploadImage(png, `${id}.png`);

  const graph = applyH3Overrides(loadSkeleton(), {
    prompt: input.prompt,
    firstFrameImage: uploaded,
    seconds: input.seconds,
    seed,
    aspect: input.aspect,
    prefix: `video/${id}`,
  });

  const comfyPromptId = await submitPrompt(graph);

  const video: GeneratedVideo = {
    id,
    title: null,
    prompt: input.prompt,
    firstFrameImageId: image.id,
    aspect: input.aspect,
    seconds: input.seconds,
    frames,
    seed,
    status: "queued",
    comfyPromptId,
    error: null,
    createdAt: new Date().toISOString(),
  };
  insertVideo(video);

  return video;
}

/** 失敗の理由を history の messages から拾う */
function summarizeFailure(entry: ComfyHistoryEntry): string {
  const messages = Array.isArray(entry.status?.messages)
    ? entry.status.messages
    : [];

  for (const message of messages) {
    if (!Array.isArray(message) || message.length < 2) continue;
    const payload = message[1] as {
      node_id?: string;
      exception_message?: string;
    };
    if (payload?.exception_message) {
      return [payload.node_id, payload.exception_message]
        .filter(Boolean)
        .join(": ");
    }
  }

  return "ComfyUI が失敗を報告しました(理由は履歴に残っておりません)";
}

function isSettled(video: GeneratedVideo): boolean {
  return video.status !== "queued" && video.status !== "running";
}

/**
 * 未完了の動画だけ ComfyUI に問い、状態を進め、完成品を回収する。
 * 一覧を開いておる間、クライアントが繰り返し呼ぶ。
 */
export async function syncVideos(): Promise<void> {
  const unsettled = listVideos().filter((video) => !isSettled(video));
  if (unsettled.length === 0) return;

  // ComfyUI に繋がらぬときは状態を動かさぬ(勝手に失敗にせぬ)
  const queue = await getQueue();

  for (const video of unsettled) {
    const promptId = video.comfyPromptId;
    if (!promptId) {
      updateVideoState(video.id, {
        status: "failed",
        error: "ComfyUI の prompt_id が残っておりません",
      });
      continue;
    }

    if (queue.running.includes(promptId)) {
      if (video.status !== "running") {
        updateVideoState(video.id, { status: "running", error: null });
      }
      continue;
    }

    if (queue.pending.includes(promptId)) {
      if (video.status !== "queued") {
        updateVideoState(video.id, { status: "queued", error: null });
      }
      continue;
    }

    const entry = await getHistory(promptId);

    if (!entry) {
      const age = Date.now() - Date.parse(video.createdAt);
      if (age < LOST_GRACE_MS) continue;
      updateVideoState(video.id, {
        status: "failed",
        error:
          "ComfyUI の待ち行列にも履歴にも見つかりません(ComfyUI を再起動したか)",
      });
      continue;
    }

    if (entry.status?.status_str !== "success") {
      updateVideoState(video.id, {
        status: "failed",
        error: summarizeFailure(entry),
      });
      continue;
    }

    try {
      const { data } = await downloadVideo(entry);
      saveVideoFile(video.id, data);
      updateVideoState(video.id, { status: "succeeded", error: null });
    } catch (e) {
      updateVideoState(video.id, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/**
 * 未完了の動画を取り消す。待ちなら行列から外し、実行中なら止める。
 * 既に終わっておれば何もせず弾く(画面を更新させるためじゃ)。
 */
export async function cancelVideo(id: string): Promise<void> {
  const video = getVideo(id);
  if (!video) throw new Error("動画が見つかりません");
  if (isSettled(video)) throw new Error("この動画は既に終わっております");

  const promptId = video.comfyPromptId;
  if (!promptId) throw new Error("ComfyUI の prompt_id が残っておりません");

  const queue = await getQueue();
  if (queue.pending.includes(promptId)) {
    await deleteQueued(promptId);
  } else if (queue.running.includes(promptId)) {
    await interrupt();
  } else {
    // 既に終わっておる。状態は見回りに任せ、ここでは書き換えぬ
    throw new Error("この動画は既に終わっております(画面を更新してください)");
  }

  updateVideoState(id, { status: "canceled", error: null });
}

/**
 * 同じ条件でもう一度投入する。seed は引き直すゆえ、
 * 同じ絵から違う動きを試すのに使える。
 */
export async function retryVideo(id: string): Promise<GeneratedVideo> {
  const video = getVideo(id);
  if (!video) throw new Error("動画が見つかりません");
  if (!video.firstFrameImageId) {
    throw new Error("元の画像が消えておるゆえ、同じ条件では引き直せません");
  }

  return createVideo({
    prompt: video.prompt,
    firstFrameImageId: video.firstFrameImageId,
    seconds: video.seconds,
    aspect: video.aspect,
  });
}
