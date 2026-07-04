export const QUALITIES = ["auto", "low", "medium", "high"] as const;
export type Quality = (typeof QUALITIES)[number];

export const SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;
export type Size = (typeof SIZES)[number];

export interface ModelDefinition {
  /** OpenAI API に渡すモデル ID */
  id: string;
  /** フォームに表示する名前 */
  label: string;
  /** 価格帯の目安(フォームの選択肢に添えて表示する) */
  priceHint: string;
  sizes: readonly Size[];
  qualities: readonly Quality[];
}

/** ギャラリーに並ぶ 1 件の生成結果。画像本体は /api/images/[id] で配信される */
export interface GeneratedImage {
  id: string;
  prompt: string;
  model: string;
  size: Size;
  quality: Quality;
  /** ISO 8601 */
  createdAt: string;
}

export interface GenerationInput {
  prompt: string;
  model: string;
  size: Size;
  quality: Quality;
}

export type GenerationResult =
  | { ok: true; image: GeneratedImage }
  | { ok: false; error: string };
