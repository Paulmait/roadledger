// useOfflineSync Hook
// Provides offline-first data operations with automatic sync

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import {
  isOnline,
  createOffline,
  updateOffline,
  deleteOffline,
  readOffline,
  listOffline,
  processSyncQueue,
  fullSync,
  OfflineTable,
  OfflineRecord,
  OfflineOperationResult,
} from '@/services/sync/offlineManager';
import { useSyncStore, useIsOnline, useSyncStatus, usePendingCount } from '@/stores/syncStore';
import { getQueueStats } from '@/services/sync/queueManager';

interface UseOfflineSyncOptions {
  autoSync?: boolean;
  syncIntervalMs?: number;
}

/**
 * Hook for offline-first data operations
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}) {
  const { autoSync = true, syncIntervalMs = 30000 } = options;

  const online = useIsOnline();
  const syncStatus = useSyncStatus();
  const pendingCount = usePendingCount();
  const checkNetworkStatus = useSyncStore((state) => state.checkNetworkStatus);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Check network status on mount and when app state changes
  useEffect(() => {
    checkNetworkStatus();

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkNetworkStatus();
        if (autoSync) {
          syncNow();
        }
      }
    });

    // Network listener
    const networkSubscription = Network.addNetworkStateListener((state) => {
      useSyncStore.getState().checkNetworkStatus();
      if (state.isConnected && autoSync) {
        syncNow();
      }
    });

    return () => {
      subscription.remove();
      networkSubscription.remove();
    };
  }, [autoSync]);

  // Auto sync interval
  useEffect(() => {
    if (!autoSync) return;

    const interval = setInterval(() => {
      if (online) {
        syncNow();
      }
    }, syncIntervalMs);

    return () => clearInterval(interval);
  }, [autoSync, syncIntervalMs, online]);

  /**
   * Trigger sync now
   */
  const syncNow = useCallback(async (): Promise<boolean> => {
    const isNetworkOnline = await isOnline();
    if (!isNetworkOnline) {
      return false;
    }

    const result = await processSyncQueue();
    setLastSyncTime(new Date());

    // Update pending count
    const stats = await getQueueStats();
    useSyncStore.getState().updatePendingCount(stats.pending);

    return result.succeeded > 0 || result.failed === 0;
  }, []);

  /**
   * Full sync for a user
   */
  const fullSyncForUser = useCallback(async (userId: string): Promise<boolean> => {
    const result = await fullSync(userId);
    if (result.success) {
      setLastSyncTime(new Date());
    }
    return result.success;
  }, []);

  return {
    // State
    isOnline: online,
    syncStatus,
    pendingCount,
    lastSyncTime,

    // Actions
    syncNow,
    fullSync: fullSyncForUser,
    checkNetworkStatus,
  };
}

/**
 * Hook for offline-first CRUD operations on a specific table
 */
export function useOfflineTable<T extends OfflineRecord>(
  table: OfflineTable,
  userId: string | null
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T[]>([]);

  const { isOnline, pendingCount, syncNow } = useOfflineSync();

  /**
   * Load all records for this table
   */
  const loadData = useCallback(async (options?: {
    limit?: number;
    orderBy?: string;
    where?: Record<string, unknown>;
  }) => {
    if (!userId) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await listOffline<T>(table, userId, options);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [table, userId]);

  /**
   * Create a new record
   */
  const create = useCallback(async (
    record: Omit<T, 'id' | 'created_at' | 'updated_at'> & { id?: string }
  ): Promise<OfflineOperationResult<T>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await createOffline<T>(table, record);
      if (result.success && result.data) {
        setData((prev) => [result.data!, ...prev]);
      } else {
        setError(result.error || 'Failed to create record');
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create record';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [table]);

  /**
   * Update a record
   */
  const update = useCallback(async (
    id: string,
    updates: Partial<T>
  ): Promise<OfflineOperationResult<T>> => {
    setLoading(true);
    setError(null);

    try {
      const result = await updateOffline<T>(table, id, updates);
      if (result.success && result.data) {
        setData((prev) =>
          prev.map((item) => (item.id === id ? result.data! : item))
        );
      } else {
        setError(result.error || 'Failed to update record');
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update record';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [table]);

  /**
   * Delete a record
   */
  const remove = useCallback(async (id: string): Promise<OfflineOperationResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await deleteOffline(table, id);
      if (result.success) {
        setData((prev) => prev.filter((item) => item.id !== id));
      } else {
        setError(result.error || 'Failed to delete record');
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete record';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [table]);

  /**
   * Get a single record by ID
   */
  const getById = useCallback(async (id: string): Promise<T | null> => {
    const result = await readOffline<T>(table, id);
    return result.success ? result.data || null : null;
  }, [table]);

  /**
   * Refresh data from local database
   */
  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  // Load data on mount
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  return {
    // State
    data,
    loading,
    error,
    isOnline,
    pendingCount,

    // CRUD operations
    create,
    update,
    remove,
    getById,
    refresh,

    // Sync
    syncNow,
  };
}

/**
 * Hook to monitor sync status
 */
export function useSyncMonitor() {
  const isOnline = useIsOnline();
  const syncStatus = useSyncStatus();
  const pendingCount = usePendingCount();
  const lastSyncAt = useSyncStore((state) => state.lastSyncAt);
  const syncError = useSyncStore((state) => state.syncError);

  const [queueStats, setQueueStats] = useState({
    pending: 0,
    failed: 0,
    synced: 0,
    byTable: {} as Record<string, number>,
  });

  // Load queue stats
  useEffect(() => {
    const loadStats = async () => {
      const stats = await getQueueStats();
      setQueueStats(stats);
    };
    loadStats();

    // Refresh every 10 seconds
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncAt: lastSyncAt ? new Date(lastSyncAt) : null,
    syncError,
    queueStats,
  };
}
