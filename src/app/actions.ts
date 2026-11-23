"use server";

import { revalidatePath } from "next/cache";
import {
  deleteContextTemplate,
  deleteImage,
  getContextTemplate,
  insertContextTemplate,
  insertImage,
  updateContextTemplate,
  updateImageTitle,
} from "@/lib/db";
import { deleteImageFile, saveImageFile } from "@/lib/storage";
import type {
  GeneratedImage,
  GenerationResult,
  Size,
  Quality,
} from "@/lib/types";
import { findModel } from "@/lib/models";
import { generateImage } from "@/lib/generate";
import { cleansePrompt } from "@/lib/cleanse";
import { normalizeTitle } from "@/lib/title";

type ContextSaveResult = { ok: true } | { ok: false; error: string };
type TitleUpdateResult =
  { ok: true; title: string | null } | { ok: false; error: string };
type CleanseResult =
  { ok: true; prompt: string } | { ok: false; error: string };

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
    const rawTitle = formData.get("title");

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

    // タイトルは任意。空なら未設定(null)として保存する
    if (rawTitle !== null && typeof rawTitle !== "string") {
      return { ok: false, error: "タイトルが不正です" };
    }
    const titleInput = normalizeTitle(rawTitle ?? "");
    if (!titleInput.ok) {
      return { ok: false, error: titleInput.error };
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
    const image: GeneratedImage = {
      id,
      title: titleInput.title,
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
