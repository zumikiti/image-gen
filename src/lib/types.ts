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
  /** 任意の 1 行の名前。未設定は null(空文字では表さぬ) */
  title: string | null;
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
  { ok: true; image: GeneratedImage } | { ok: false; error: string };

/**
 * プロンプト調整に添えるベースコンテキスト(AGENTS.md / SKILL.md 的なテンプレート)。
 * 管理画面(/admin)で一覧・新規・編集・削除できる。
 */
export interface ContextTemplate {
  id: string;
  name: string;
  content: string;
  /** ISO 8601 */
  createdAt: string;
}

/**
 * 動画生成(MiniMax H3 / ComfyUI)の状態。
 * ComfyUI の queue と history を真実とし、こちらは写しを持つだけじゃ。
 */
export const VIDEO_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

/**
 * 出力の縦横比。ComfyUI の ResolutionSelector が受ける値と同一じゃ
 * (勝手に増やすと `POST /prompt` が 400 で弾かれる)。
 */
export const VIDEO_ASPECTS = [
  "1:1 (Square)",
  "2:3 (Portrait Photo)",
  "3:2 (Photo)",
  "3:4 (Portrait Standard)",
  "4:3 (Standard)",
  "9:16 (Portrait Widescreen)",
  "16:9 (Widescreen)",
  "21:9 (Ultrawide)",
] as const;
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];

/**
 * 尺の受付範囲(秒)。5 秒で約 30 分かかるゆえ、上限は控えめにする。
 * クライアントからも読むゆえ node 依存を持たぬここに置く。
 */
export const VIDEO_SECONDS = { min: 3, max: 10 } as const;

/** 動画の 1 件。mp4 は /api/videos/[id] で配信される */
export interface GeneratedVideo {
  id: string;
  /** 任意の 1 行の名前。未設定は null(空文字では表さぬ) */
  title: string | null;
  prompt: string;
  /** 最初のコマに使った Gallery の画像。消えておれば null */
  firstFrameImageId: string | null;
  aspect: VideoAspect;
  /** 要求した秒数 */
  seconds: number;
  /** 丸めた実フレーム数(17k+5)。実尺は frames / 24 秒 */
  frames: number;
  seed: number | null;
  status: VideoStatus;
  /** ComfyUI の prompt_id。状態照会と取り消しに使う */
  comfyPromptId: string | null;
  /** 失敗・取り消しの理由。成功時は null */
  error: string | null;
  /** ISO 8601 */
  createdAt: string;
}

/** 動画生成の依頼。投入に要る最小限じゃ */
export interface VideoGenerationInput {
  prompt: string;
  firstFrameImageId: string;
  seconds: number;
  aspect: VideoAspect;
  /** 未指定なら乱数を振る */
  seed?: number;
}

export type VideoGenerationResult =
  { ok: true; video: GeneratedVideo } | { ok: false; error: string };
