import type { GeneratedImage } from "./types";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

/**
 * SQLite(data/app.db)による生成結果の永続化層。
 */

/** グローバルにキャッシュされたDatabaseインスタンス */
let cachedDb: Database.Database | null = null;

/**
 * Database インスタンスを取得（キャッシュから）
 */
function getDatabase(): Database.Database {
  if (cachedDb) {
    return cachedDb;
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, "app.db");
  const db = new Database(dbPath);

  // テーブルを作成（既に存在する場合はスキップ）
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      size TEXT NOT NULL,
      quality TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  cachedDb = db;
  return db;
}

export function insertImage(image: GeneratedImage): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "INSERT INTO images (id, prompt, model, size, quality, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  stmt.run(image.id, image.prompt, image.model, image.size, image.quality, image.createdAt);
}

export function listImages(): GeneratedImage[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT id, prompt, model, size, quality, created_at FROM images ORDER BY created_at DESC"
  );
  const rows = stmt.all() as Array<{
    id: string;
    prompt: string;
    model: string;
    size: string;
    quality: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    model: row.model,
    size: row.size as never,
    quality: row.quality as never,
    createdAt: row.created_at,
  }));
}

export function getImage(id: string): GeneratedImage | undefined {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT id, prompt, model, size, quality, created_at FROM images WHERE id = ?"
  );
  const row = stmt.get(id) as
    | {
        id: string;
        prompt: string;
        model: string;
        size: string;
        quality: string;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return {
    id: row.id,
    prompt: row.prompt,
    model: row.model,
    size: row.size as never,
    quality: row.quality as never,
    createdAt: row.created_at,
  };
}

export function deleteImage(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM images WHERE id = ?");
  stmt.run(id);
}

