import type { GeneratedImage } from "./types";

/**
 * SQLite(data/app.db)による生成結果の永続化層。
 * 実装は persistence 担当が埋める。
 */

export function insertImage(_image: GeneratedImage): void {
  throw new Error("not implemented");
}

export function listImages(): GeneratedImage[] {
  throw new Error("not implemented");
}

export function getImage(_id: string): GeneratedImage | undefined {
  throw new Error("not implemented");
}

export function deleteImage(_id: string): void {
  throw new Error("not implemented");
}
