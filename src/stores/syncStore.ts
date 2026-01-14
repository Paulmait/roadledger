import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  // Connection state
  isOnline: boolean;
  networkType: string | null;

  // Sync state
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  syncError: string | null;

  // Per-table sync state
  tableSyncStatus: Record<string, {
    lastSyncAt: string | null;
    pendingCount: number;
    error: string | null;
  }>;

  // Actions
  checkNetworkStatus: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  updateLastSync: (timestamp: string) => void;
  updatePendingCount: (count: number) => void;
  updateTableSyncStatus: (
    table: string,
    status: { lastSyncAt?: string; pendingCount?: number; error?: string | null }
  ) => void;
  startSync: () => void;
  completeSync: () => void;
  failSync: (error: string) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      // Initial state
      isOnline: true,
      networkType: null,
      syncStatus: 'idle',
      lastSyncAt: null,
      pendingCount: 0,
      syncError: null,
      tableSyncStatus: {},

      // Check network status
      checkNetworkStatus: async () => {
        try {
          const networkState = await Network.getNetworkStateAsync();

          set({
            isOnline: networkState.isConnected ?? false,
            networkType: networkState.type ?? null,
            syncStatus: networkState.isConnected ? get().syncStatus : 'offline',
          });
        } catch (error) {
          console.error('Failed to check network status:', error);
          set({ isOnline: false, syncStatus: 'offline' });
        }
      },

      // Set sync status
      setSyncStatus: (status: SyncStatus) => {
        set({ syncStatus: status });
      },

      // Set sync error
      setSyncError: (error: string | null) => {
        set({ syncError: error });
      },

      // Update last sync timestamp
      updateLastSync: (timestamp: string) => {
        set({ lastSyncAt: timestamp });
      },

      // Update pending count
      updatePendingCount: (count: number) => {
        set({ pendingCount: count });
      },

      // Update table-specific sync status
      updateTableSyncStatus: (table, status) => {
        const { tableSyncStatus } = get();
        set({
          tableSyncStatus: {
            ...tableSyncStatus,
            [table]: {
              ...tableSyncStatus[table],
              ...status,
            },
          },
        });
      },

      // Start sync process
      startSync: () => {
        const { isOnline } = get();
        if (!isOnline) {
          set({ syncStatus: 'offline' });
          return;
        }
        set({ syncStatus: 'syncing', syncError: null });
      },

      // Complete sync successfully
      completeSync: () => {
        set({
          syncStatus: 'idle',
          lastSyncAt: new Date().toISOString(),
          syncError: null,
        });
      },

      // Fail sync with error
      failSync: (error: string) => {
        set({
          syncStatus: 'error',
          syncError: error,
        });
      },
    }),
    {
      name: 'sync-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        lastSyncAt: state.lastSyncAt,
        tableSyncStatus: state.tableSyncStatus,
      }),
    }
  )
);

// Selector hooks
export const useIsOnline = () => useSyncStore((state) => state.isOnline);
export const useSyncStatus = () => useSyncStore((state) => state.syncStatus);
export const usePendingCount = () => useSyncStore((state) => state.pendingCount);
