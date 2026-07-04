"use server";

import type { GenerationResult } from "@/lib/types";

/**
 * フォームから呼ばれるサーバーアクション。
 * 実装は generation 担当が埋める。
 */

export async function generateAction(
  _prevState: GenerationResult | null,
  _formData: FormData,
): Promise<GenerationResult> {
  throw new Error("not implemented");
}

export async function deleteAction(_id: string): Promise<void> {
  throw new Error("not implemented");
}
