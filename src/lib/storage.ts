/**
 * 画像ファイル(data/images/<id>.png)の読み書き層。
 */

import * as fs from "fs";
import * as path from "path";

export function saveImageFile(id: string, png: Buffer): void {
  const imagesDir = path.join(process.cwd(), "data", "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  const filePath = path.join(imagesDir, `${id}.png`);
  fs.writeFileSync(filePath, png);
}

export function readImageFile(id: string): Buffer | undefined {
  const filePath = path.join(process.cwd(), "data", "images", `${id}.png`);

  try {
    return fs.readFileSync(filePath);
  } catch {
    return undefined;
  }
}

export function deleteImageFile(id: string): void {
  const filePath = path.join(process.cwd(), "data", "images", `${id}.png`);

  try {
    fs.unlinkSync(filePath);
  } catch {
    // no-op if file doesn't exist
  }
}

