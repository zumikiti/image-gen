import type { ContextTemplate, GeneratedImage } from "./types";
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
      title TEXT,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      size TEXT NOT NULL,
      quality TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS context_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  addMissingColumns(db, "images", IMAGE_COLUMNS);

  cachedDb = db;
  return db;
}

/** 後から images に足した列。新しい DB は CREATE TABLE が作り、既存の DB はここで補う */
const IMAGE_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
  { name: "title", ddl: "TEXT" },
];

/**
 * テーブルに無い列だけを ALTER TABLE で足す(冪等)。
 * deliberate: 列の追加だけを補う。型変更や外部キーが必要になったら
 * PRAGMA user_version による番号付きマイグレーションへ昇格する
 */
function addMissingColumns(
  db: Database.Database,
  table: string,
  columns: ReadonlyArray<{ name: string; ddl: string }>,
): void {
  const existing = new Set(
    (
      db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((row) => row.name),
  );

  for (const column of columns) {
    if (!existing.has(column.name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.ddl}`);
    }
  }
}

/** DB の行(スネークケース)をドメインの型へ写す */
function mapImageRow(row: {
  id: string;
  title: string | null;
  prompt: string;
  model: string;
  size: string;
  quality: string;
  created_at: string;
}): GeneratedImage {
  return {
    id: row.id,
    title: row.title ?? null,
    prompt: row.prompt,
    model: row.model,
    size: row.size as never,
    quality: row.quality as never,
    createdAt: row.created_at,
  };
}

export function insertImage(image: GeneratedImage): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "INSERT INTO images (id, title, prompt, model, size, quality, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  stmt.run(
    image.id,
    image.title,
    image.prompt,
    image.model,
    image.size,
    image.quality,
    image.createdAt,
  );
}

const IMAGE_SELECT =
  "SELECT id, title, prompt, model, size, quality, created_at FROM images";

export function listImages(): GeneratedImage[] {
  const db = getDatabase();
  const stmt = db.prepare(`${IMAGE_SELECT} ORDER BY created_at DESC`);
  return (stmt.all() as Parameters<typeof mapImageRow>[0][]).map(mapImageRow);
}

export function getImage(id: string): GeneratedImage | undefined {
  const db = getDatabase();
  const stmt = db.prepare(`${IMAGE_SELECT} WHERE id = ?`);
  const row = stmt.get(id) as Parameters<typeof mapImageRow>[0] | undefined;
  return row ? mapImageRow(row) : undefined;
}

/** タイトルを差し替える。空(null)は解除。対象が無ければ false */
export function updateImageTitle(id: string, title: string | null): boolean {
  const db = getDatabase();
  const stmt = db.prepare("UPDATE images SET title = ? WHERE id = ?");
  return stmt.run(title, id).changes > 0;
}

export function deleteImage(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM images WHERE id = ?");
  stmt.run(id);
}

/**
 * 複数 id を 1 トランザクションで削除する。
 * 存在せぬ id は 0 行ヒットで無視される(呼び出し側は気にせず渡してよい)。
 */
export function deleteImages(ids: string[]): void {
  if (ids.length === 0) return;

  const db = getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  const stmt = db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`);
  db.transaction(() => stmt.run(...ids))();
}

function mapContextRow(row: {
  id: string;
  name: string;
  content: string;
  created_at: string;
}): ContextTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function listContextTemplates(): ContextTemplate[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT id, name, content, created_at FROM context_templates ORDER BY created_at DESC",
  );
  const rows = stmt.all() as Array<{
    id: string;
    name: string;
    content: string;
    created_at: string;
  }>;
  return rows.map(mapContextRow);
}

export function getContextTemplate(id: string): ContextTemplate | undefined {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT id, name, content, created_at FROM context_templates WHERE id = ?",
  );
  const row = stmt.get(id) as
    | {
        id: string;
        name: string;
        content: string;
        created_at: string;
      }
    | undefined;
  return row ? mapContextRow(row) : undefined;
}

export function insertContextTemplate(
  name: string,
  content: string,
): ContextTemplate {
  const db = getDatabase();
  const template: ContextTemplate = {
    id: crypto.randomUUID(),
    name,
    content,
    createdAt: new Date().toISOString(),
  };
  const stmt = db.prepare(
    "INSERT INTO context_templates (id, name, content, created_at) VALUES (?, ?, ?, ?)",
  );
  stmt.run(template.id, template.name, template.content, template.createdAt);
  return template;
}

export function updateContextTemplate(
  id: string,
  name: string,
  content: string,
): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE context_templates SET name = ?, content = ? WHERE id = ?",
  );
  stmt.run(name, content, id);
}

export function deleteContextTemplate(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM context_templates WHERE id = ?");
  stmt.run(id);
}
