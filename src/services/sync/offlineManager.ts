// Offline Manager
// Provides offline-first CRUD operations with automatic sync queue management

import * as Network from 'expo-network';
import { getDatabase } from '@/lib/database';
import { supabase } from '@/lib/supabase';
import { addToQueue, getPendingQueue, markQueueItemSynced, markQueueItemFailed, getQueueStats } from './queueManager';
import { useSyncStore } from '@/stores/syncStore';
import * as Crypto from 'expo-crypto';

// Generate UUID
const generateId = () => Crypto.randomUUID();

// Tables that support offline operations
export type OfflineTable = 'trips' | 'documents' | 'transactions';

// Generic record type
export interface OfflineRecord {
  id: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

// Operation result
export interface OfflineOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  queued?: boolean;
  syncedImmediately?: boolean;
}

/**
 * Check if device is online
 */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected ?? false;
  } catch {
    return false;
  }
}

/**
 * Create a record with offline support
 * - If online: Creates in Supabase immediately, also stores locally
 * - If offline: Creates locally and queues for sync
 */
export async function createOffline<T extends OfflineRecord>(
  table: OfflineTable,
  data: Omit<T, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<OfflineOperationResult<T>> {
  const db = await getDatabase();
  const online = await isOnline();
  const now = new Date().toISOString();

  // Generate ID if not provided
  const record: T = {
    ...data,
    id: data.id || generateId(),
    created_at: now,
    updated_at: now,
  } as T;

  try {
    // Always store locally first (offline-first)
    await insertLocalRecord(table, record);

    if (online) {
      // Try to sync immediately
      const { error } = await supabase.from(table).insert(record);

      if (error) {
        // Failed to sync - queue for later
        await addToQueue(table, 'INSERT', record.id, record);
        useSyncStore.getState().updatePendingCount(
          useSyncStore.getState().pendingCount + 1
        );
        return { success: true, data: record, queued: true, syncedImmediately: false };
      }

      // Mark as synced
      await markLocalRecordSynced(table, record.id);
      return { success: true, data: record, queued: false, syncedImmediately: true };
    } else {
      // Offline - queue for sync
      await addToQueue(table, 'INSERT', record.id, record);
      useSyncStore.getState().updatePendingCount(
        useSyncStore.getState().pendingCount + 1
      );
      return { success: true, data: record, queued: true, syncedImmediately: false };
    }
  } catch (error) {
    console.error(`Failed to create ${table} record:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create record',
    };
  }
}

/**
 * Update a record with offline support
 */
export async function updateOffline<T extends OfflineRecord>(
  table: OfflineTable,
  id: string,
  updates: Partial<T>
): Promise<OfflineOperationResult<T>> {
  const db = await getDatabase();
  const online = await isOnline();
  const now = new Date().toISOString();

  const updateData = {
    ...updates,
    updated_at: now,
  };

  try {
    // Update locally first
    await updateLocalRecord(table, id, updateData);

    // Get the full updated record
    const record = await getLocalRecord<T>(table, id);

    if (!record) {
      return { success: false, error: 'Record not found' };
    }

    if (online) {
      // Try to sync immediately
      const { error } = await supabase.from(table).update(updateData).eq('id', id);

      if (error) {
        // Failed to sync - queue for later
        await addToQueue(table, 'UPDATE', id, record);
        useSyncStore.getState().updatePendingCount(
          useSyncStore.getState().pendingCount + 1
        );
        return { success: true, data: record, queued: true, syncedImmediately: false };
      }

      // Mark as synced
      await markLocalRecordSynced(table, id);
      return { success: true, data: record, queued: false, syncedImmediately: true };
    } else {
      // Offline - queue for sync
      await addToQueue(table, 'UPDATE', id, record);
      useSyncStore.getState().updatePendingCount(
        useSyncStore.getState().pendingCount + 1
      );
      return { success: true, data: record, queued: true, syncedImmediately: false };
    }
  } catch (error) {
    console.error(`Failed to update ${table} record:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update record',
    };
  }
}

/**
 * Delete a record with offline support
 */
export async function deleteOffline(
  table: OfflineTable,
  id: string
): Promise<OfflineOperationResult> {
  const db = await getDatabase();
  const online = await isOnline();

  try {
    if (online) {
      // Try to delete from server first
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) {
        // Failed to sync - queue for later, mark local as deleted
        await markLocalRecordDeleted(table, id);
        await addToQueue(table, 'DELETE', id, { id });
        useSyncStore.getState().updatePendingCount(
          useSyncStore.getState().pendingCount + 1
        );
        return { success: true, queued: true, syncedImmediately: false };
      }

      // Delete locally
      await deleteLocalRecord(table, id);
      return { success: true, queued: false, syncedImmediately: true };
    } else {
      // Offline - mark as deleted locally, queue for sync
      await markLocalRecordDeleted(table, id);
      await addToQueue(table, 'DELETE', id, { id });
      useSyncStore.getState().updatePendingCount(
        useSyncStore.getState().pendingCount + 1
      );
      return { success: true, queued: true, syncedImmediately: false };
    }
  } catch (error) {
    console.error(`Failed to delete ${table} record:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete record',
    };
  }
}

/**
 * Read a record (local first, then server if online and not found locally)
 */
export async function readOffline<T extends OfflineRecord>(
  table: OfflineTable,
  id: string
): Promise<OfflineOperationResult<T>> {
  try {
    // Try local first
    const localRecord = await getLocalRecord<T>(table, id);

    if (localRecord) {
      return { success: true, data: localRecord };
    }

    // If online, try server
    const online = await isOnline();
    if (online) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();

      if (error || !data) {
        return { success: false, error: 'Record not found' };
      }

      // Cache locally
      await insertLocalRecord(table, data as T);
      return { success: true, data: data as T };
    }

    return { success: false, error: 'Record not found' };
  } catch (error) {
    console.error(`Failed to read ${table} record:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read record',
    };
  }
}

/**
 * List records (local first)
 */
export async function listOffline<T extends OfflineRecord>(
  table: OfflineTable,
  userId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    where?: Record<string, unknown>;
  }
): Promise<OfflineOperationResult<T[]>> {
  try {
    const records = await getLocalRecords<T>(table, userId, options);
    return { success: true, data: records };
  } catch (error) {
    console.error(`Failed to list ${table} records:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list records',
    };
  }
}

/**
 * Process pending sync queue
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const online = await isOnline();
  if (!online) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pendingItems = await getPendingQueue(50);
  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      const payload = JSON.parse(item.payload);

      let error: Error | null = null;

      switch (item.operation) {
        case 'INSERT':
          const insertResult = await supabase.from(item.table_name).insert(payload);
          if (insertResult.error) error = insertResult.error;
          break;

        case 'UPDATE':
          const updateResult = await supabase
            .from(item.table_name)
            .update(payload)
            .eq('id', item.record_id);
          if (updateResult.error) error = updateResult.error;
          break;

        case 'DELETE':
          const deleteResult = await supabase
            .from(item.table_name)
            .delete()
            .eq('id', item.record_id);
          if (deleteResult.error) error = deleteResult.error;
          break;
      }

      if (error) {
        await markQueueItemFailed(item.id, error.message);
        failed++;
      } else {
        await markQueueItemSynced(item.id);
        await markLocalRecordSynced(item.table_name as OfflineTable, item.record_id);
        succeeded++;
      }
    } catch (error) {
      await markQueueItemFailed(
        item.id,
        error instanceof Error ? error.message : 'Unknown error'
      );
      failed++;
    }
  }

  // Update pending count
  const stats = await getQueueStats();
  useSyncStore.getState().updatePendingCount(stats.pending);

  return { processed: pendingItems.length, succeeded, failed };
}

// ============================================
// LOCAL DATABASE HELPERS
// ============================================

async function insertLocalRecord<T extends OfflineRecord>(
  table: OfflineTable,
  record: T
): Promise<void> {
  const db = await getDatabase();
  const columns = Object.keys(record);
  const placeholders = columns.map(() => '?').join(', ');
  const values: (string | number | null)[] = columns.map((col) => {
    const val = record[col];
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val as string | number;
  });

  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}, pending_sync)
     VALUES (${placeholders}, 1)`,
    values
  );
}

async function updateLocalRecord(
  table: OfflineTable,
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  const setClause = Object.keys(updates)
    .map((col) => `${col} = ?`)
    .join(', ');
  const values: (string | number | null)[] = Object.values(updates).map((val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val as string | number;
  });

  await db.runAsync(
    `UPDATE ${table} SET ${setClause}, pending_sync = 1 WHERE id = ?`,
    [...values, id]
  );
}

async function deleteLocalRecord(table: OfflineTable, id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

async function markLocalRecordDeleted(table: OfflineTable, id: string): Promise<void> {
  const db = await getDatabase();
  // For tables with soft delete, mark as deleted; otherwise hard delete
  await db.runAsync(
    `UPDATE ${table} SET pending_sync = 1, status = 'deleted' WHERE id = ?`,
    [id]
  );
}

async function markLocalRecordSynced(table: OfflineTable, id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE ${table} SET pending_sync = 0, synced_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

async function getLocalRecord<T extends OfflineRecord>(
  table: OfflineTable,
  id: string
): Promise<T | null> {
  const db = await getDatabase();
  const records = await db.getAllAsync<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return records[0] || null;
}

async function getLocalRecords<T extends OfflineRecord>(
  table: OfflineTable,
  userId: string,
  options?: {
    limit?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    where?: Record<string, unknown>;
  }
): Promise<T[]> {
  const db = await getDatabase();
  let query = `SELECT * FROM ${table} WHERE user_id = ?`;
  const params: (string | number | null)[] = [userId];

  // Add additional where clauses
  if (options?.where) {
    Object.entries(options.where).forEach(([key, value]) => {
      query += ` AND ${key} = ?`;
      if (value === null || value === undefined) {
        params.push(null);
      } else if (typeof value === 'boolean') {
        params.push(value ? 1 : 0);
      } else {
        params.push(value as string | number);
      }
    });
  }

  // Exclude soft-deleted records
  query += ` AND (status IS NULL OR status != 'deleted')`;

  // Order
  if (options?.orderBy) {
    query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'DESC'}`;
  } else {
    query += ` ORDER BY created_at DESC`;
  }

  // Limit
  if (options?.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  return db.getAllAsync<T>(query, params);
}

/**
 * Sync all local data to server (full sync)
 */
export async function fullSync(userId: string): Promise<{
  success: boolean;
  synced: number;
  errors: number;
}> {
  const online = await isOnline();
  if (!online) {
    return { success: false, synced: 0, errors: 0 };
  }

  const tables: OfflineTable[] = ['trips', 'documents', 'transactions'];
  let totalSynced = 0;
  let totalErrors = 0;

  useSyncStore.getState().startSync();

  try {
    // Process queue first
    const queueResult = await processSyncQueue();
    totalSynced += queueResult.succeeded;
    totalErrors += queueResult.failed;

    // Pull latest from server
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(1000);

        if (!error && data) {
          const db = await getDatabase();
          for (const record of data) {
            await insertLocalRecord(table, record as OfflineRecord);
            await markLocalRecordSynced(table, record.id);
          }
          totalSynced += data.length;
        }
      } catch (error) {
        console.error(`Failed to sync ${table}:`, error);
        totalErrors++;
      }
    }

    useSyncStore.getState().completeSync();
    return { success: true, synced: totalSynced, errors: totalErrors };
  } catch (error) {
    useSyncStore.getState().failSync(error instanceof Error ? error.message : 'Sync failed');
    return { success: false, synced: totalSynced, errors: totalErrors };
  }
}
