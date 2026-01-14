import { getDatabase } from '@/lib/database';

// Operation types
export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

// Queue item interface
export interface QueueItem {
  id: number;
  table_name: string;
  operation: SyncOperation;
  record_id: string;
  payload: string;
  created_at: string;
  retry_count: number;
  last_error: string | null;
  synced_at: string | null;
}

// Add an operation to the sync queue
export async function addToQueue(
  tableName: string,
  operation: SyncOperation,
  recordId: string,
  payload: Record<string, unknown>
): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO sync_queue (table_name, operation, record_id, payload)
     VALUES (?, ?, ?, ?)`,
    [tableName, operation, recordId, JSON.stringify(payload)]
  );

  return result.lastInsertRowId;
}

// Get pending queue items
export async function getPendingQueue(limit: number = 100): Promise<QueueItem[]> {
  const db = await getDatabase();

  const items = await db.getAllAsync<QueueItem>(
    `SELECT * FROM sync_queue
     WHERE synced_at IS NULL
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit]
  );

  return items;
}

// Get queue items by table
export async function getQueueByTable(
  tableName: string,
  limit: number = 100
): Promise<QueueItem[]> {
  const db = await getDatabase();

  return db.getAllAsync<QueueItem>(
    `SELECT * FROM sync_queue
     WHERE table_name = ? AND synced_at IS NULL
     ORDER BY created_at ASC
     LIMIT ?`,
    [tableName, limit]
  );
}

// Mark queue item as synced
export async function markQueueItemSynced(id: number): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

// Mark queue item as failed
export async function markQueueItemFailed(
  id: number,
  error: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET retry_count = retry_count + 1, last_error = ?
     WHERE id = ?`,
    [error, id]
  );
}

// Remove synced items older than specified days
export async function cleanupQueue(olderThanDays: number = 7): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM sync_queue
     WHERE synced_at IS NOT NULL
     AND synced_at < datetime('now', ?)`,
    [`-${olderThanDays} days`]
  );

  return result.changes;
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  pending: number;
  failed: number;
  synced: number;
  byTable: Record<string, number>;
}> {
  const db = await getDatabase();

  const [pending] = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL`
  );

  const [failed] = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL AND retry_count > 0`
  );

  const [synced] = await db.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NOT NULL`
  );

  const byTable = await db.getAllAsync<{ table_name: string; count: number }>(
    `SELECT table_name, COUNT(*) as count
     FROM sync_queue
     WHERE synced_at IS NULL
     GROUP BY table_name`
  );

  const byTableMap: Record<string, number> = {};
  for (const row of byTable) {
    byTableMap[row.table_name] = row.count;
  }

  return {
    pending: pending?.count ?? 0,
    failed: failed?.count ?? 0,
    synced: synced?.count ?? 0,
    byTable: byTableMap,
  };
}

// Retry failed items
export async function retryFailed(maxRetries: number = 3): Promise<QueueItem[]> {
  const db = await getDatabase();

  return db.getAllAsync<QueueItem>(
    `SELECT * FROM sync_queue
     WHERE synced_at IS NULL
     AND retry_count > 0
     AND retry_count < ?
     ORDER BY created_at ASC`,
    [maxRetries]
  );
}

// Clear all failed items
export async function clearFailed(): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `DELETE FROM sync_queue WHERE synced_at IS NULL AND retry_count > 0`
  );

  return result.changes;
}
