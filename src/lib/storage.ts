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

  // 原本を消したら、その派生も残す意味が無い
  deleteThumbFiles(id);
}

/** 一覧のカード用サムネイルは `data/thumbs/<id>@<幅>.webp` に置く */
function thumbsDir(): string {
  return path.join(process.cwd(), "data", "thumbs");
}

export function thumbFilePath(id: string, width: number): string {
  return path.join(thumbsDir(), `${id}@${width}.webp`);
}

export function readThumbFile(id: string, width: number): Buffer | undefined {
  try {
    return fs.readFileSync(thumbFilePath(id, width));
  } catch {
    return undefined;
  }
}

/**
 * 派生を書く。書きかけを配信せぬよう、別名で書いてから差し替える。
 * deliberate: 同時要求で二重に変換しうるが、最後に書いた方が残るだけで害が無い
 */
export function saveThumbFile(id: string, width: number, webp: Buffer): void {
  const filePath = thumbFilePath(id, width);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, webp);
  fs.renameSync(temporary, filePath);
}

/** 同じ id の派生を幅違いも含めて消す */
export function deleteThumbFiles(id: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(thumbsDir());
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.startsWith(`${id}@`)) continue;
    try {
      fs.unlinkSync(path.join(thumbsDir(), entry));
    } catch {
      // 消えていればそれでよい
    }
  }
}

/** 動画は `data/videos/<id>.mp4` に置く。元画像とは別の器じゃ */
function videoPath(id: string): string {
  return path.join(process.cwd(), "data", "videos", `${id}.mp4`);
}

export function saveVideoFile(id: string, mp4: Buffer): void {
  const dir = path.dirname(videoPath(id));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(videoPath(id), mp4);
}

/**
 * 配信に要る情報(パスと大きさ)を返す。中身は読まずに流すゆえ、
 * 2MB 程度でも無駄な複製を作らぬ。無ければ undefined。
 */
export function statVideoFile(
  id: string,
): { path: string; size: number } | undefined {
  const filePath = videoPath(id);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return undefined;
    return { path: filePath, size: stat.size };
  } catch {
    return undefined;
  }
}

export function deleteVideoFile(id: string): void {
  try {
    fs.unlinkSync(videoPath(id));
  } catch {
    // no-op if file doesn't exist
  }
}
