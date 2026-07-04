"use server";

import { revalidatePath } from "next/cache";
import { deleteImage, insertImage } from "@/lib/db";
import { deleteImageFile, saveImageFile } from "@/lib/storage";
import type { GeneratedImage, GenerationResult, Size, Quality } from "@/lib/types";
import { findModel } from "@/lib/models";
import { generateImage } from "@/lib/openai";

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
      return { ok: false, error: "選択されたサイズはこのモデルでは利用できません" };
    }

    // 品質検証
    if (!modelDef.qualities.includes(quality as Quality)) {
      return { ok: false, error: "選択された品質はこのモデルでは利用できません" };
    }

    // 画像生成
    const id = crypto.randomUUID();
    const buffer = await generateImage({
      prompt: prompt.trim(),
      model,
      size: size as Size,
      quality: quality as Quality,
    });

    // 画像ファイルを保存
    saveImageFile(id, buffer);

    // DB に記録
    const image: GeneratedImage = {
      id,
      prompt: prompt.trim(),
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
 * 画像削除用サーバーアクション。
 * DB と ストレージの両方から削除してからリバリデートする。
 */
export async function deleteAction(id: string): Promise<void> {
  deleteImage(id);
  deleteImageFile(id);
  revalidatePath("/");
}

