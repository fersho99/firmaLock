import * as SQLite from "expo-sqlite";

export type DocType = "pdf" | "docx";
export type DocStatus = "pendiente" | "firmado";

export type DocumentItem = {
  id: string;
  name: string;
  type: DocType;
  uri: string; // versión actual (original o firmada, según status)
  status: DocStatus;
  signedAt: number | null;
  createdAt: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("firmalock.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          uri TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pendiente',
          signedAt INTEGER,
          createdAt INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function insertDocument(item: DocumentItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO documents (id, name, type, uri, status, signedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    item.id,
    item.name,
    item.type,
    item.uri,
    item.status,
    item.signedAt,
    item.createdAt
  );
}

export async function markSigned(id: string, signedUri: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE documents SET uri = ?, status = 'firmado', signedAt = ? WHERE id = ?;`,
    signedUri,
    Date.now(),
    id
  );
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const db = await getDb();
  return db.getAllAsync<DocumentItem>(`SELECT * FROM documents ORDER BY createdAt DESC;`);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM documents WHERE id = ?;`, id);
}
