import { QUALITIES, SIZES, type ModelDefinition } from "./types";

/**
 * モデルカタログ。モデルを増やすときはここに定義を足すだけでよい。
 * フォーム・サーバーアクション・ギャラリーは触らないこと(Open/Closed)。
 */
export const MODEL_CATALOG: readonly ModelDefinition[] = [
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 mini",
    priceHint: "安い(試し撃ち向け)",
    sizes: SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-1",
    label: "GPT Image 1",
    priceHint: "標準",
    sizes: SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-1.5",
    label: "GPT Image 1.5",
    priceHint: "やや高い",
    sizes: SIZES,
    qualities: QUALITIES,
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    priceHint: "高い(トークン消費大)",
    sizes: SIZES,
    qualities: QUALITIES,
  },
] as const;

export const DEFAULT_MODEL_ID = "gpt-image-1-mini";

export function findModel(id: string): ModelDefinition | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
