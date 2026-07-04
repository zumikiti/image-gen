/**
 * 画像ファイル(data/images/<id>.png)の読み書き層。
 * 実装は persistence 担当が埋める。
 */

export function saveImageFile(_id: string, _png: Buffer): void {
  throw new Error("not implemented");
}

export function readImageFile(_id: string): Buffer | undefined {
  throw new Error("not implemented");
}

export function deleteImageFile(_id: string): void {
  throw new Error("not implemented");
}
