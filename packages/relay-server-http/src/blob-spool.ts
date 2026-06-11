import type { Database } from "bun:sqlite";

const DEFAULT_MAX_FRAMES_PER_CHANNEL = 10_000;
const DEFAULT_MAX_BYTES_PER_CHANNEL = 64 * 1024 * 1024;

export type BlobSpool = {
  append(channelId: string, blob: Uint8Array, nowMs: number): number;
  getBlobsAfter(channelId: string, afterId: number): Array<{ id: number; blob: Uint8Array }>;
  getMaxId(channelId: string): number | undefined;
  purgeChannel(channelId: string): void;
};

export function ensureBlobSpoolSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS relay_spool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      blob BLOB NOT NULL,
      byte_length INTEGER NOT NULL,
      created_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS relay_spool_channel ON relay_spool(channel_id, id);
  `);
}

type TrimStmts = {
  stats: ReturnType<Database["query"]>;
  trimFrames: ReturnType<Database["prepare"]>;
  trimBytes: ReturnType<Database["prepare"]>;
};

function trimChannelSpool(_db: Database, channelId: string, stmts: TrimStmts): void {
  const stats = stmts.stats.get(channelId) as { total: number; count: number; avg: number } | null;
  if (stats === null || stats.count === 0) return;

  const excessFrames = stats.count - DEFAULT_MAX_FRAMES_PER_CHANNEL;
  if (excessFrames > 0) {
    stmts.trimFrames.run(channelId, channelId, excessFrames);
  }

  if (stats.total > DEFAULT_MAX_BYTES_PER_CHANNEL) {
    const excess = stats.total - DEFAULT_MAX_BYTES_PER_CHANNEL;
    const avg = Math.max(stats.avg, 1);
    const rowsToDelete = Math.ceil(excess / avg) + 1;
    stmts.trimBytes.run(channelId, channelId, rowsToDelete);
  }
}

export function createBlobSpool(db: Database): BlobSpool {
  ensureBlobSpoolSchema(db);

  const insertStmt = db.query(
    `INSERT INTO relay_spool (channel_id, blob, byte_length, created_ms) VALUES (?, ?, ?, ?) RETURNING id`,
  );
  const selectAfterStmt = db.query(
    `SELECT id, blob FROM relay_spool WHERE channel_id = ? AND id > ? ORDER BY id ASC`,
  );
  const maxIdStmt = db.query(`SELECT MAX(id) AS max_id FROM relay_spool WHERE channel_id = ?`);
  const purgeStmt = db.prepare(`DELETE FROM relay_spool WHERE channel_id = ?`);

  const trimStmts: TrimStmts = {
    stats: db.query(
      `SELECT COALESCE(SUM(byte_length), 0) AS total,
              COUNT(*) AS count,
              COALESCE(AVG(byte_length), 1) AS avg
       FROM relay_spool WHERE channel_id = ?`,
    ),
    trimFrames: db.prepare(
      `DELETE FROM relay_spool WHERE channel_id = ? AND id IN (
         SELECT id FROM relay_spool WHERE channel_id = ? ORDER BY id ASC LIMIT ?
       )`,
    ),
    trimBytes: db.prepare(
      `DELETE FROM relay_spool WHERE channel_id = ? AND id IN (
         SELECT id FROM relay_spool WHERE channel_id = ? ORDER BY id ASC LIMIT ?
       )`,
    ),
  };

  return {
    append(channelId: string, blob: Uint8Array, nowMs: number): number {
      const row = insertStmt.get(channelId, blob, blob.byteLength, nowMs) as { id: number };
      trimChannelSpool(db, channelId, trimStmts);
      return row.id;
    },

    getBlobsAfter(channelId: string, afterId: number): Array<{ id: number; blob: Uint8Array }> {
      const rows = selectAfterStmt.all(channelId, afterId) as Array<{
        id: number;
        blob: Uint8Array;
      }>;
      return rows.map((r) => ({ id: r.id, blob: new Uint8Array(r.blob) }));
    },

    getMaxId(channelId: string): number | undefined {
      const row = maxIdStmt.get(channelId) as { max_id: number | null } | null;
      if (row === null || row.max_id === null) return undefined;
      return row.max_id;
    },

    purgeChannel(channelId: string): void {
      purgeStmt.run(channelId);
    },
  };
}
