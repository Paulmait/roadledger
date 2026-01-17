import * as Network from 'expo-network';
import { supabase } from '@/lib/supabase';
import {
  getDatabase,
  getPendingRecords,
  markRecordSynced,
  getSyncMetadata,
  updateSyncMetadata,
  getPendingTripPoints,
  markTripPointsSynced,
} from '@/lib/database';
import { useSyncStore } from '@/stores/syncStore';
import { SYNC_CONFIG } from '@/constants';

// Sync priority order
const SYNC_PRIORITY = [
  'trips', // Finalized trips first
  'trip_points', // Then GPS data
  'jurisdiction_miles',
  'documents',
  'transactions',
];

// Track if sync is currently running
let isSyncing = false;

// Start the sync engine
export async function startSyncEngine(): Promise<void> {
  try {
    // Initial sync check (don't fail if this errors)
    await checkAndSync().catch((err) => {
      console.log('Initial sync check failed:', err);
    });

    // Set up periodic sync
    setInterval(async () => {
      try {
        await checkAndSync();
      } catch (err) {
        console.log('Periodic sync failed:', err);
      }
    }, SYNC_CONFIG.syncIntervalMs);

    // Set up network change listener
    Network.addNetworkStateListener(async (state) => {
      if (state.isConnected) {
        console.log('Network connected, triggering sync');
        try {
          await checkAndSync();
        } catch (err) {
          console.log('Network reconnect sync failed:', err);
        }
      }
    });
  } catch (error) {
    console.error('Failed to start sync engine:', error);
    // Don't throw - allow app to continue without sync
  }
}

// Check network and sync if online
export async function checkAndSync(): Promise<void> {
  const networkState = await Network.getNetworkStateAsync();

  useSyncStore.getState().checkNetworkStatus();

  if (!networkState.isConnected) {
    console.log('Offline, skipping sync');
    return;
  }

  await performSync();
}

// Perform the actual sync
export async function performSync(): Promise<void> {
  if (isSyncing) {
    console.log('Sync already in progress, skipping');
    return;
  }

  const store = useSyncStore.getState();
  store.startSync();
  isSyncing = true;

  try {
    // Push local changes to server
    await pushChanges();

    // Pull server changes to local
    await pullChanges();

    store.completeSync();
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Sync failed:', error);
    store.failSync(error instanceof Error ? error.message : 'Sync failed');
  } finally {
    isSyncing = false;
  }
}

// Push local changes to server
async function pushChanges(): Promise<void> {
  const db = await getDatabase();

  for (const tableName of SYNC_PRIORITY) {
    try {
      await pushTableChanges(tableName);
    } catch (error) {
      console.error(`Failed to push ${tableName}:`, error);
      // Continue with other tables
    }
  }
}

// Push changes for a specific table
async function pushTableChanges(tableName: string): Promise<void> {
  // Handle trip_points specially due to volume
  if (tableName === 'trip_points') {
    await pushTripPoints();
    return;
  }

  const pending = await getPendingRecords(tableName, SYNC_CONFIG.batchSize);

  if (pending.length === 0) {
    return;
  }

  console.log(`Pushing ${pending.length} ${tableName} records`);

  for (const record of pending) {
    try {
      await pushRecord(tableName, record as Record<string, unknown>);
    } catch (error) {
      console.error(`Failed to push ${tableName} record:`, error);
      // Continue with other records
    }
  }
}

// Push a single record to server
async function pushRecord(
  tableName: string,
  record: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from(tableName).upsert(
    {
      ...record,
      // Remove local-only fields
      pending_sync: undefined,
      synced_at: undefined,
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw error;
  }

  await markRecordSynced(tableName, record.id as string);
}

// Push trip points in batches
async function pushTripPoints(): Promise<void> {
  let hasMore = true;

  while (hasMore) {
    const points = await getPendingTripPoints(SYNC_CONFIG.batchSize);

    if (points.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Pushing ${points.length} trip points`);

    // Format points for insert
    const formattedPoints = points.map((p) => ({
      trip_id: p.trip_id,
      ts: p.ts,
      lat: p.lat,
      lng: p.lng,
      speed: p.speed,
      accuracy_m: p.accuracy_m,
      jurisdiction: p.jurisdiction,
    }));

    const { error } = await supabase.from('trip_points').insert(formattedPoints);

    if (error) {
      console.error('Failed to push trip points:', error);
      break;
    }

    // Mark as synced
    const ids = points.map((p) => p.id);
    await markTripPointsSynced(ids);

    // Check if there might be more
    hasMore = points.length === SYNC_CONFIG.batchSize;
  }
}

// Pull changes from server
async function pullChanges(): Promise<void> {
  // For now, we primarily push data
  // Pull is mainly for AI extraction results and server-side updates

  try {
    await pullDocumentUpdates();
  } catch (error) {
    console.error('Failed to pull document updates:', error);
  }
}

// Pull document extraction updates
async function pullDocumentUpdates(): Promise<void> {
  const db = await getDatabase();
  const metadata = await getSyncMetadata('documents');
  const lastPull = metadata?.last_pull_at || '1970-01-01T00:00:00Z';

  // Get documents that have been parsed on the server
  const { data: updates, error } = await supabase
    .from('documents')
    .select('*')
    .eq('parsed_status', 'parsed')
    .gt('uploaded_at', lastPull);

  if (error) {
    throw error;
  }

  if (!updates || updates.length === 0) {
    return;
  }

  console.log(`Pulling ${updates.length} document updates`);

  // Update local database
  for (const doc of updates) {
    await db.runAsync(
      `UPDATE documents SET
        parsed_status = ?,
        vendor = ?,
        document_date = ?,
        total_amount = ?,
        extraction_json = ?,
        synced_at = ?
      WHERE id = ?`,
      [
        doc.parsed_status,
        doc.vendor,
        doc.document_date,
        doc.total_amount,
        doc.extraction_json ? JSON.stringify(doc.extraction_json) : null,
        new Date().toISOString(),
        doc.id,
      ]
    );
  }

  await updateSyncMetadata('documents', undefined, new Date().toISOString());
}

// Force sync now
export async function forceSyncNow(): Promise<boolean> {
  const networkState = await Network.getNetworkStateAsync();

  if (!networkState.isConnected) {
    return false;
  }

  await performSync();
  return true;
}

// Get pending sync count
export async function getPendingSyncCount(): Promise<number> {
  let total = 0;

  for (const tableName of SYNC_PRIORITY) {
    const pending = await getPendingRecords(tableName, 1000);
    total += pending.length;
  }

  return total;
}

// Check if there are pending changes
export async function hasPendingChanges(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}
