export const QUALITIES = ["auto", "low", "medium", "high"] as const;
export type Quality = (typeof QUALITIES)[number];

/** OpenAI 系が受け付ける標準 3 種 */
export const STANDARD_SIZES = ["1024x1024", "1536x1024", "1024x1536"] as const;

/**
 * ローカル生成(mflux)向けの大判。辺は 4096 以下、かつ 16 の倍数にする
 * (mflux は 16 で割り切れない辺を切り捨て、サーバー側の上限は 4096)
 */
export const LARGE_SIZES = ["2048x2048", "2304x1536", "1536x2304"] as const;

export const SIZES = [...STANDARD_SIZES, ...LARGE_SIZES] as const;
export type Size = (typeof SIZES)[number];

/** 生成を実行するバックエンド(openai=OpenAI API / mflux=別PC上のローカルサーバー) */
export type Provider = "openai" | "mflux";

export interface ModelDefinition {
  /** OpenAI API に渡すモデル ID(mflux の場合はカタログ内の識別用) */
  id: string;
  /** フォームに表示する名前 */
  label: string;
  /** 価格帯の目安(フォームの選択肢に添えて表示する) */
  priceHint: string;
  sizes: readonly Size[];
  qualities: readonly Quality[];
  /** どのバックエンドで生成するか。未指定なら openai */
  provider?: Provider;
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
