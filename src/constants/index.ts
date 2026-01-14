export * from './jurisdictions';
export * from './categories';

// App constants
export const APP_NAME = 'RoadLedger';
export const APP_VERSION = '1.0.0';

// Tracking modes
export const TRACKING_MODES = {
  precision: {
    label: 'Precision',
    description: 'High accuracy, more battery usage',
    distanceInterval: 100, // meters
    timeInterval: 10000, // 10 seconds
  },
  battery_saver: {
    label: 'Battery Saver',
    description: 'Lower accuracy, less battery usage',
    distanceInterval: 1000, // 1 km
    timeInterval: 60000, // 60 seconds
  },
} as const;

export type TrackingMode = keyof typeof TRACKING_MODES;

// Sync constants
export const SYNC_CONFIG = {
  batchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  syncIntervalMs: 30000, // 30 seconds
};

// Storage buckets
export const STORAGE_BUCKETS = {
  receipts: 'receipts',
  settlements: 'settlements',
  exports: 'exports',
} as const;

// Upload limits
export const UPLOAD_LIMITS = {
  maxFileSizeMb: 10,
  maxImageSizeMb: 5,
  supportedImageTypes: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
  supportedDocTypes: ['application/pdf', 'image/jpeg', 'image/png'],
};

// IFTA quarters
export function getCurrentIFTAQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${quarter}`;
}

export function getIFTAQuarter(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${date.getFullYear()}-Q${quarter}`;
}
