import {
  QUALITIES,
  SIZES,
  STANDARD_SIZES,
  type ModelDefinition,
} from "./types";

/**
 * モデルカタログ。モデルを増やすときはここに定義を足すだけでよい。
 * フォーム・サーバーアクション・ギャラリーは触らないこと(Open/Closed)。
 */
export const MODEL_CATALOG: readonly ModelDefinition[] = [
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 mini",
    priceHint: "安い(試し撃ち向け)",
    sizes: STANDARD_SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-1",
    label: "GPT Image 1",
    priceHint: "標準",
    sizes: STANDARD_SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-1.5",
    label: "GPT Image 1.5",
    priceHint: "やや高い",
    sizes: STANDARD_SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    priceHint: "高い(トークン消費大)",
    sizes: STANDARD_SIZES,
    qualities: QUALITIES,
  },
  {
    id: "mflux",
    label: "MFlux(ローカル)",
    provider: "mflux",
    priceHint: "無料(ローカル生成)",
    sizes: SIZES,
    // 標準 3 種に加えて大判も選べる(ローカルは 4096 まで許される)
    qualities: QUALITIES,
  },
] as const;

export const DEFAULT_MODEL_ID = "mflux";

export function findModel(id: string): ModelDefinition | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
