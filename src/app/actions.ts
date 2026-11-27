"use server";

import { revalidatePath } from "next/cache";
import {
  deleteContextTemplate,
  deleteImage,
  deleteImages,
  deleteVideo,
  getContextTemplate,
  getImage,
  insertContextTemplate,
  insertImage,
  updateContextTemplate,
  updateImageTitle,
  updateVideoTitle,
} from "@/lib/db";
import { deleteImageFile, deleteVideoFile, saveImageFile } from "@/lib/storage";
import type {
  GeneratedImage,
  GenerationResult,
  Size,
  Quality,
  VideoGenerationResult,
} from "@/lib/types";
import { VIDEO_SECONDS } from "@/lib/types";
import {
  cancelVideo,
  createVideo,
  isVideoAspect,
  normalizeSeconds,
  retryVideo,
  syncVideos,
} from "@/lib/videos";
import { findModel } from "@/lib/models";
import { generateImage } from "@/lib/generate";
import { cleansePrompt } from "@/lib/cleanse";
import { draftPixivPost } from "@/lib/pixivDraft";
import type { PixivDraft } from "@/lib/pixiv";
import { normalizeTitle } from "@/lib/title";

type ContextSaveResult = { ok: true } | { ok: false; error: string };
type TitleUpdateResult =
  { ok: true; title: string | null } | { ok: false; error: string };
type CleanseResult =
  { ok: true; prompt: string } | { ok: false; error: string };
type VideoActionResult = { ok: true } | { ok: false; error: string };
type PixivDraftAction =
  { ok: true; draft: PixivDraft } | { ok: false; error: string };

/**
 * 画像生成フォームから呼ばれるサーバーアクション。
 * prompt, model, size, quality を読み取り、バリデーション後に API を呼び出す。
 */
export async function generateAction(
  _prevState: GenerationResult | null,
  formData: FormData,
): Promise<GenerationResult> {
  try {
    // FormData から値を取得
    const prompt = formData.get("prompt");
    const model = formData.get("model");
    const size = formData.get("size");
    const quality = formData.get("quality");

    // 型チェックと値の確認
    if (typeof prompt !== "string" || !prompt.trim()) {
      return { ok: false, error: "プロンプトは空にできません" };
    }

    if (typeof model !== "string" || !model) {
      return { ok: false, error: "モデルが選択されていません" };
    }

    if (typeof size !== "string" || !size) {
      return { ok: false, error: "サイズが選択されていません" };
    }

    if (typeof quality !== "string" || !quality) {
      return { ok: false, error: "品質が選択されていません" };
    }

    // モデル存在チェック
    const modelDef = findModel(model);
    if (!modelDef) {
      return { ok: false, error: "指定されたモデルが見つかりません" };
    }

    // サイズ検証
    if (!modelDef.sizes.includes(size as Size)) {
      return {
        ok: false,
        error: "選択されたサイズはこのモデルでは利用できません",
      };
    }

    // 品質検証
    if (!modelDef.qualities.includes(quality as Quality)) {
      return {
        ok: false,
        error: "選択された品質はこのモデルでは利用できません",
      };
    }

    // 調整は cleanseAction が済ませている。ここは渡された文面をそのまま生成に使う。
    const finalPrompt = prompt.trim();

    // 画像生成
    const id = crypto.randomUUID();
    const buffer = await generateImage({
      prompt: finalPrompt,
      model,
      size: size as Size,
      quality: quality as Quality,
    });

    // 画像ファイルを保存
    saveImageFile(id, buffer);

    // DB に記録
    // 画面の生成フォームはタイトルを訊かぬ。名付けはモーダル・API・CLI で行う
    const image: GeneratedImage = {
      id,
      title: null,
      prompt: finalPrompt,
      model,
      size: size as Size,
      quality: quality as Quality,
      createdAt: new Date().toISOString(),
    };
    insertImage(image);

    // ページをリバリデート
    revalidatePath("/");

    return { ok: true, image };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}

/**
 * プロンプト調整用サーバーアクション。画像生成とは分け、クライアントが
 * 「調整中」「生成中」を区別して表示できるようにする。画像は生成せず、
 * 練り直した文面だけを返す。contextId があればその本文を添える。
 */
export async function cleanseAction(
  rawPrompt: string,
  contextId: string,
): Promise<CleanseResult> {
  if (!rawPrompt.trim()) {
    return { ok: false, error: "プロンプトは空にできません" };
  }
  try {
    const context =
      contextId.trim() !== ""
        ? getContextTemplate(contextId.trim())?.content
        : undefined;
    const prompt = await cleansePrompt(rawPrompt.trim(), context);
    return { ok: true, prompt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * pixiv 投稿の下書き作成用サーバーアクション(モーダルから呼ばれる)。
 * 画像は生成せず、ローカル LLM に題名・タグ・キャプションを作らせて返す。
 */
export async function draftPixivAction(
  imageId: string,
): Promise<PixivDraftAction> {
  if (typeof imageId !== "string" || imageId.trim() === "") {
    return { ok: false, error: "画像が指定されていません" };
  }

  const image = getImage(imageId.trim());
  if (!image) {
    return { ok: false, error: "画像が見つかりません" };
  }

  try {
    const draft = await draftPixivPost({
      title: image.title,
      prompt: image.prompt,
    });
    return { ok: true, draft };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * タイトルの登録・更新用サーバーアクション(ギャラリーのモーダルから呼ばれる)。
 * 空文字で保存すればタイトル解除(null)になる。
 */
export async function updateTitleAction(
  id: string,
  rawTitle: string,
): Promise<TitleUpdateResult> {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, error: "画像が指定されていません" };
  }

  const titleInput = normalizeTitle(rawTitle);
  if (!titleInput.ok) {
    return { ok: false, error: titleInput.error };
  }

  if (!updateImageTitle(id.trim(), titleInput.title)) {
    return { ok: false, error: "画像が見つかりません" };
  }

  revalidatePath("/");
  return { ok: true, title: titleInput.title };
}

/**
 * 画像削除用サーバーアクション。
 * DB と ストレージの両方から削除してからリバリデートする。
 */
export async function deleteAction(id: string): Promise<void> {
  deleteImage(id);
  deleteImageFile(id);
  revalidatePath("/");
}

/**
 * 一括削除用サーバーアクション。
 * DB は 1 トランザクションで消し、ファイルは件数分だけ消す。
 */
export async function deleteManyAction(ids: string[]): Promise<void> {
  const validIds = ids.filter(
    (id) => typeof id === "string" && id.trim() !== "",
  );
  if (validIds.length === 0) return;

  deleteImages(validIds);
  for (const id of validIds) {
    deleteImageFile(id);
  }
  revalidatePath("/");
}

/**
 * コンテキスト設定の新規登録・更新用サーバーアクション(管理画面から呼ばれる)。
 * formData に id があれば更新、なければ新規作成する。
 */
export async function saveContextAction(
  _prevState: ContextSaveResult | null,
  formData: FormData,
): Promise<ContextSaveResult> {
  const id = formData.get("id");
  const name = formData.get("name");
  const content = formData.get("content");

  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "名前は空にできません" };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false, error: "本文は空にできません" };
  }

  if (typeof id === "string" && id.trim() !== "") {
    updateContextTemplate(id.trim(), name.trim(), content.trim());
  } else {
    insertContextTemplate(name.trim(), content.trim());
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

/** コンテキスト設定の削除用サーバーアクション */
export async function deleteContextAction(id: string): Promise<void> {
  deleteContextTemplate(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * 動画生成の投入。mp4 は 30 分後に出来るゆえ、ここでは待たずに
 * 「待ち」の 1 件を返す。以後の進行は syncVideosAction が見回る。
 */
export async function submitVideoAction(input: {
  prompt: string;
  firstFrameImageId: string;
  seconds: number;
  aspect: string;
  /** 空文字なら乱数で振る */
  seed: string;
}): Promise<VideoGenerationResult> {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) {
    return { ok: false, error: "プロンプトは空にできません" };
  }

  if (
    typeof input.firstFrameImageId !== "string" ||
    input.firstFrameImageId.trim() === ""
  ) {
    return { ok: false, error: "最初のコマの画像を選んでください" };
  }

  const seconds = normalizeSeconds(input.seconds);
  if (seconds === undefined) {
    return {
      ok: false,
      error: `尺は ${VIDEO_SECONDS.min}〜${VIDEO_SECONDS.max} 秒の整数で指定してください`,
    };
  }

  if (!isVideoAspect(input.aspect)) {
    return { ok: false, error: "アスペクト比が不正です" };
  }

  let seed: number | undefined;
  const rawSeed = typeof input.seed === "string" ? input.seed.trim() : "";
  if (rawSeed !== "") {
    const parsed = Number(rawSeed);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      return { ok: false, error: "seed は 0 以上の整数で指定してください" };
    }
    seed = parsed;
  }

  try {
    const created = await createVideo({
      prompt,
      firstFrameImageId: input.firstFrameImageId.trim(),
      seconds,
      aspect: input.aspect,
      seed,
    });
    revalidatePath("/videos");
    return { ok: true, video: created.video, note: created.note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 未完了の動画を ComfyUI に問い直し、完成品を回収する。
 * 一覧を開いておる間、クライアントが繰り返し呼ぶ見回りじゃ。
 */
export async function syncVideosAction(): Promise<VideoActionResult> {
  try {
    await syncVideos();
    revalidatePath("/videos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 待ち・実行中の動画を取り消す。実行中のものを止めるゆえ、画面で確認を挟む */
export async function cancelVideoAction(
  id: string,
): Promise<VideoActionResult> {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, error: "動画が指定されていません" };
  }

  try {
    await cancelVideo(id.trim());
    revalidatePath("/videos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 同じ条件でもう一度投入する(seed は引き直す) */
export async function retryVideoAction(
  id: string,
): Promise<VideoGenerationResult> {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, error: "動画が指定されていません" };
  }

  try {
    const created = await retryVideo(id.trim());
    revalidatePath("/videos");
    return { ok: true, video: created.video, note: created.note };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 動画の削除。DB と mp4 の両方を消す(ComfyUI 側の出力は触らぬ) */
export async function deleteVideoAction(id: string): Promise<void> {
  if (typeof id !== "string" || id.trim() === "") return;

  deleteVideo(id.trim());
  deleteVideoFile(id.trim());
  revalidatePath("/videos");
}

/** 動画のタイトル。画像と同じ正規化を通す(100 文字、空は未設定) */
export async function updateVideoTitleAction(
  id: string,
  rawTitle: string,
): Promise<TitleUpdateResult> {
  if (typeof id !== "string" || id.trim() === "") {
    return { ok: false, error: "動画が指定されていません" };
  }

  const titleInput = normalizeTitle(rawTitle);
  if (!titleInput.ok) {
    return { ok: false, error: titleInput.error };
  }

  if (!updateVideoTitle(id.trim(), titleInput.title)) {
    return { ok: false, error: "動画が見つかりません" };
  }

  revalidatePath("/videos");
  return { ok: true, title: titleInput.title };
}
