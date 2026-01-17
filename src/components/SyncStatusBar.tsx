// Sync Status Bar Component
// Shows current sync status and allows manual sync

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSyncMonitor } from '@/hooks/useOfflineSync';
import { processSyncQueue } from '@/services/sync/offlineManager';

const COLORS = {
  online: '#2ECC71',
  offline: '#E74C3C',
  syncing: '#3498DB',
  error: '#E67E22',
  background: '#1B2838',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
};

interface SyncStatusBarProps {
  compact?: boolean;
  showLastSync?: boolean;
}

export function SyncStatusBar({ compact = false, showLastSync = true }: SyncStatusBarProps) {
  const {
    isOnline,
    syncStatus,
    pendingCount,
    lastSyncAt,
    syncError,
    queueStats,
  } = useSyncMonitor();

  const [syncing, setSyncing] = React.useState(false);

  const handleManualSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    try {
      await processSyncQueue();
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return COLORS.offline;
    if (syncStatus === 'syncing' || syncing) return COLORS.syncing;
    if (syncStatus === 'error') return COLORS.error;
    return COLORS.online;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncStatus === 'syncing' || syncing) return 'Syncing...';
    if (syncStatus === 'error') return 'Sync Error';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'Synced';
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return lastSyncAt.toLocaleDateString();
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={handleManualSync}
        disabled={!isOnline || syncing}
      >
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        {(syncStatus === 'syncing' || syncing) && (
          <ActivityIndicator size="small" color={COLORS.syncing} style={styles.spinner} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.statusText}>{getStatusText()}</Text>
        {(syncStatus === 'syncing' || syncing) && (
          <ActivityIndicator size="small" color={COLORS.syncing} style={styles.spinner} />
        )}
      </View>

      {showLastSync && lastSyncAt && (
        <Text style={styles.lastSyncText}>Last sync: {formatLastSync()}</Text>
      )}

      {syncError && (
        <Text style={styles.errorText} numberOfLines={1}>
          {syncError}
        </Text>
      )}

      {pendingCount > 0 && isOnline && !syncing && (
        <TouchableOpacity style={styles.syncButton} onPress={handleManualSync}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      )}

      {!isOnline && pendingCount > 0 && (
        <Text style={styles.offlineText}>
          Changes will sync when online
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  spinner: {
    marginLeft: 8,
  },
  lastSyncText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  offlineText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  syncButton: {
    backgroundColor: COLORS.syncing,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  syncButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SyncStatusBar;
