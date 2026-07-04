import type { GenerationInput } from "./types";

/**
 * OpenAI Images API クライアント。API キーは環境変数 OPENAI_API_KEY から読む。
 * 実装は generation 担当が埋める。
 */

export async function generateImage(_input: GenerationInput): Promise<Buffer> {
  throw new Error("not implemented");
}
