import { getDatabase } from './schema';
import type {
  Trip,
  TripPoint,
  JurisdictionMiles,
  Transaction,
  Document,
  TripStatus,
} from '@/types/database.types';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TRIP OPERATIONS
// ============================================

export async function createTrip(
  userId: string,
  data: Partial<Trip>
): Promise<Trip> {
  const db = await getDatabase();
  const id = data.id || uuidv4();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO trips (id, user_id, status, started_at, ended_at, loaded, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      data.status || 'draft',
      data.started_at || now,
      data.ended_at || null,
      data.loaded ? 1 : 0,
      data.notes || null,
      data.source || 'gps',
      now,
      now,
    ]
  );

  return getTripById(id) as Promise<Trip>;
}

export async function getTripById(id: string): Promise<Trip | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Trip>(
    'SELECT * FROM trips WHERE id = ?',
    [id]
  );
  return result || null;
}

export async function getActiveTrip(userId: string): Promise<Trip | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Trip>(
    `SELECT * FROM trips WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`,
    [userId]
  );
  return result || null;
}

export async function getUserTrips(
  userId: string,
  options?: { limit?: number; offset?: number; status?: TripStatus }
): Promise<Trip[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM trips WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY started_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  return db.getAllAsync<Trip>(query, params);
}

export async function updateTrip(
  id: string,
  updates: Partial<Trip>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.ended_at !== undefined) {
    fields.push('ended_at = ?');
    values.push(updates.ended_at);
  }
  if (updates.loaded !== undefined) {
    fields.push('loaded = ?');
    values.push(updates.loaded ? 1 : 0);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.auto_miles_total !== undefined) {
    fields.push('auto_miles_total = ?');
    values.push(updates.auto_miles_total);
  }
  if (updates.manual_miles_total !== undefined) {
    fields.push('manual_miles_total = ?');
    values.push(updates.manual_miles_total);
  }

  fields.push('updated_at = ?');
  values.push(now);
  fields.push('pending_sync = ?');
  values.push(1);

  values.push(id);

  await db.runAsync(
    `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTrip(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

export async function getMonthlyTripCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM trips
     WHERE user_id = ?
     AND started_at >= ?
     AND started_at <= ?
     AND status != 'draft'`,
    [userId, startOfMonth, endOfMonth]
  );
  return result?.count ?? 0;
}

export async function getMonthlyDocumentCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM documents
     WHERE user_id = ?
     AND uploaded_at >= ?
     AND uploaded_at <= ?`,
    [userId, startOfMonth, endOfMonth]
  );
  return result?.count ?? 0;
}

// ============================================
// TRIP POINTS OPERATIONS
// ============================================

export async function addTripPoint(
  tripId: string,
  point: Omit<TripPoint, 'id'>
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO trip_points (trip_id, ts, lat, lng, speed, accuracy_m, jurisdiction)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tripId,
      point.ts,
      point.lat,
      point.lng,
      point.speed,
      point.accuracy_m,
      point.jurisdiction,
    ]
  );
  return result.lastInsertRowId;
}

export async function addTripPointsBatch(
  tripId: string,
  points: Omit<TripPoint, 'id'>[]
): Promise<void> {
  const db = await getDatabase();

  // Use a transaction for batch insert
  await db.withTransactionAsync(async () => {
    for (const point of points) {
      await db.runAsync(
        `INSERT INTO trip_points (trip_id, ts, lat, lng, speed, accuracy_m, jurisdiction)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tripId,
          point.ts,
          point.lat,
          point.lng,
          point.speed,
          point.accuracy_m,
          point.jurisdiction,
        ]
      );
    }
  });
}

export async function getTripPoints(tripId: string): Promise<TripPoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<TripPoint>(
    'SELECT * FROM trip_points WHERE trip_id = ? ORDER BY ts ASC',
    [tripId]
  );
}

export async function getPendingTripPoints(
  limit: number = 100
): Promise<TripPoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<TripPoint>(
    'SELECT * FROM trip_points WHERE pending_sync = 1 ORDER BY ts ASC LIMIT ?',
    [limit]
  );
}

export async function markTripPointsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  const db = await getDatabase();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');

  await db.runAsync(
    `UPDATE trip_points SET synced_at = ?, pending_sync = 0 WHERE id IN (${placeholders})`,
    [now, ...ids]
  );
}

// ============================================
// JURISDICTION MILES OPERATIONS
// ============================================

export async function upsertJurisdictionMiles(
  tripId: string,
  jurisdiction: string,
  miles: number,
  confidence?: number,
  method: string = 'gps'
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO jurisdiction_miles (trip_id, jurisdiction, miles, confidence, method)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(trip_id, jurisdiction) DO UPDATE SET
       miles = excluded.miles,
       confidence = excluded.confidence,
       pending_sync = 1`,
    [tripId, jurisdiction, miles, confidence ?? null, method]
  );
}

export async function getJurisdictionMiles(
  tripId: string
): Promise<JurisdictionMiles[]> {
  const db = await getDatabase();
  return db.getAllAsync<JurisdictionMiles>(
    'SELECT * FROM jurisdiction_miles WHERE trip_id = ? ORDER BY miles DESC',
    [tripId]
  );
}

export async function getTotalMilesByJurisdiction(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ jurisdiction: string; total_miles: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ jurisdiction: string; total_miles: number }>(
    `SELECT jm.jurisdiction, SUM(jm.miles) as total_miles
     FROM jurisdiction_miles jm
     JOIN trips t ON jm.trip_id = t.id
     WHERE t.user_id = ?
       AND t.status = 'finalized'
       AND t.started_at >= ?
       AND t.started_at <= ?
     GROUP BY jm.jurisdiction
     ORDER BY total_miles DESC`,
    [userId, startDate, endDate]
  );
}

// ============================================
// TRANSACTION OPERATIONS
// ============================================

export async function createTransaction(
  userId: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  const db = await getDatabase();
  const id = data.id || uuidv4();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO transactions (id, user_id, trip_id, type, category, amount, date, vendor, description, source, document_id, gallons, jurisdiction, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      data.trip_id || null,
      data.type || 'expense',
      data.category || 'other',
      data.amount || 0,
      data.date || now.split('T')[0],
      data.vendor || null,
      data.description || null,
      data.source || 'manual',
      data.document_id || null,
      data.gallons || null,
      data.jurisdiction || null,
      now,
      now,
    ]
  );

  return getTransactionById(id) as Promise<Transaction>;
}

export async function getTransactionById(
  id: string
): Promise<Transaction | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Transaction>(
    'SELECT * FROM transactions WHERE id = ?',
    [id]
  );
  return result || null;
}

export async function getUserTransactions(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    category?: string;
    type?: string;
  }
): Promise<Transaction[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (options?.startDate) {
    query += ' AND date >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND date <= ?';
    params.push(options.endDate);
  }
  if (options?.category) {
    query += ' AND category = ?';
    params.push(options.category);
  }
  if (options?.type) {
    query += ' AND type = ?';
    params.push(options.type);
  }

  query += ' ORDER BY date DESC, created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  return db.getAllAsync<Transaction>(query, params);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const updateableFields = [
    'trip_id',
    'type',
    'category',
    'amount',
    'date',
    'vendor',
    'description',
    'source',
    'document_id',
    'gallons',
    'jurisdiction',
  ] as const;

  for (const field of updateableFields) {
    if (updates[field] !== undefined) {
      fields.push(`${field} = ?`);
      values.push(updates[field] as string | number | null);
    }
  }

  fields.push('updated_at = ?');
  values.push(now);
  fields.push('pending_sync = ?');
  values.push(1);
  values.push(id);

  await db.runAsync(
    `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
}

// ============================================
// DOCUMENT OPERATIONS
// ============================================

export async function createDocument(
  userId: string,
  data: Partial<Document>
): Promise<Document> {
  const db = await getDatabase();
  const id = data.id || uuidv4();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO documents (id, user_id, trip_id, type, local_path, storage_path, uploaded_at, parsed_status, vendor, document_date, total_amount, currency, extraction_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      data.trip_id || null,
      data.type || 'receipt',
      null,
      data.storage_path || null,
      now,
      data.parsed_status || 'pending',
      data.vendor || null,
      data.document_date || null,
      data.total_amount || null,
      data.currency || 'USD',
      data.extraction_json ? JSON.stringify(data.extraction_json) : null,
    ]
  );

  return getDocumentById(id) as Promise<Document>;
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<Document & { extraction_json: string }>(
    'SELECT * FROM documents WHERE id = ?',
    [id]
  );

  if (!result) return null;

  return {
    ...result,
    extraction_json: result.extraction_json
      ? JSON.parse(result.extraction_json)
      : null,
  } as Document;
}

export async function getUserDocuments(
  userId: string,
  options?: { limit?: number; offset?: number; type?: string }
): Promise<Document[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM documents WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (options?.type) {
    query += ' AND type = ?';
    params.push(options.type);
  }

  query += ' ORDER BY uploaded_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const results = await db.getAllAsync<Document & { extraction_json: string }>(
    query,
    params
  );

  return results.map((doc) => ({
    ...doc,
    extraction_json: doc.extraction_json
      ? JSON.parse(doc.extraction_json)
      : null,
  })) as Document[];
}

export async function updateDocument(
  id: string,
  updates: Partial<Document>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.storage_path !== undefined) {
    fields.push('storage_path = ?');
    values.push(updates.storage_path);
  }
  if (updates.parsed_status !== undefined) {
    fields.push('parsed_status = ?');
    values.push(updates.parsed_status);
  }
  if (updates.vendor !== undefined) {
    fields.push('vendor = ?');
    values.push(updates.vendor);
  }
  if (updates.document_date !== undefined) {
    fields.push('document_date = ?');
    values.push(updates.document_date);
  }
  if (updates.total_amount !== undefined) {
    fields.push('total_amount = ?');
    values.push(updates.total_amount);
  }
  if (updates.extraction_json !== undefined) {
    fields.push('extraction_json = ?');
    values.push(updates.extraction_json ? JSON.stringify(updates.extraction_json) : null);
  }

  if (fields.length === 0) return;

  values.push(id);

  await db.runAsync(
    `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
}

// ============================================
// SYNC OPERATIONS
// ============================================

export async function getPendingRecords(
  tableName: string,
  limit: number = 100
): Promise<unknown[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT * FROM ${tableName} WHERE pending_sync = 1 LIMIT ?`,
    [limit]
  );
}

export async function markRecordSynced(
  tableName: string,
  id: string | number
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ${tableName} SET synced_at = ?, pending_sync = 0 WHERE id = ?`,
    [now, id]
  );
}

export async function getSyncMetadata(
  tableName: string
): Promise<{ last_synced_at: string | null; last_pull_at: string | null } | null> {
  const db = await getDatabase();
  return db.getFirstAsync(
    'SELECT last_synced_at, last_pull_at FROM sync_metadata WHERE table_name = ?',
    [tableName]
  );
}

export async function updateSyncMetadata(
  tableName: string,
  lastSyncedAt?: string,
  lastPullAt?: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_metadata (table_name, last_synced_at, last_pull_at)
     VALUES (?, ?, ?)
     ON CONFLICT(table_name) DO UPDATE SET
       last_synced_at = COALESCE(excluded.last_synced_at, last_synced_at),
       last_pull_at = COALESCE(excluded.last_pull_at, last_pull_at)`,
    [tableName, lastSyncedAt || null, lastPullAt || null]
  );
}
