import { findModel } from "./models";
import { generateWithOpenAi } from "./openai";
import { generateWithMflux } from "./mflux";
import type { GenerationInput, Provider } from "./types";

/**
 * 画像生成の単一エントリポイント。モデルカタログの provider でバックエンドを振り分ける。
 * モデルの追加は Model Catalog への定義追加だけで済み、このファイルは変更不要。
 * 新しい provider を足す場合はここだけ分岐を追加する(Open/Closed の境界)。
 */
export async function generateImage(input: GenerationInput): Promise<Buffer> {
  const provider: Provider = findModel(input.model)?.provider ?? "openai";

  switch (provider) {
    case "mflux":
      return generateWithMflux(input);
    default:
      return generateWithOpenAi(input);
  }
}
