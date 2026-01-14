import * as Battery from 'expo-battery';
import { TRACKING_MODES, type TrackingMode } from '@/constants';

// Battery level thresholds
const LOW_BATTERY_THRESHOLD = 0.20; // 20%
const CRITICAL_BATTERY_THRESHOLD = 0.10; // 10%

// Callback types
type ModeChangeCallback = (newMode: TrackingMode, reason: string) => void;
type BatteryWarningCallback = (level: number, warning: string) => void;

// Current callbacks
let modeChangeCallback: ModeChangeCallback | null = null;
let batteryWarningCallback: BatteryWarningCallback | null = null;

// Current battery subscription
let batterySubscription: { remove: () => void } | null = null;

// Current state
let currentMode: TrackingMode = 'precision';
let autoModeEnabled = true;

// Start monitoring battery for automatic mode switching
export async function startBatteryMonitoring(
  onModeChange: ModeChangeCallback,
  onBatteryWarning?: BatteryWarningCallback
): Promise<void> {
  modeChangeCallback = onModeChange;
  batteryWarningCallback = onBatteryWarning || null;

  // Check initial battery level
  const initialLevel = await Battery.getBatteryLevelAsync();
  handleBatteryLevel(initialLevel);

  // Subscribe to battery level changes
  batterySubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
    handleBatteryLevel(batteryLevel);
  });
}

// Stop battery monitoring
export function stopBatteryMonitoring(): void {
  if (batterySubscription) {
    batterySubscription.remove();
    batterySubscription = null;
  }
  modeChangeCallback = null;
  batteryWarningCallback = null;
}

// Handle battery level changes
function handleBatteryLevel(level: number): void {
  // Send warnings
  if (batteryWarningCallback) {
    if (level <= CRITICAL_BATTERY_THRESHOLD) {
      batteryWarningCallback(
        level,
        'Critical battery level! Consider ending your trip soon.'
      );
    } else if (level <= LOW_BATTERY_THRESHOLD) {
      batteryWarningCallback(
        level,
        'Low battery. Switching to battery saver mode.'
      );
    }
  }

  // Auto-switch mode if enabled
  if (autoModeEnabled && modeChangeCallback) {
    if (level <= LOW_BATTERY_THRESHOLD && currentMode === 'precision') {
      currentMode = 'battery_saver';
      modeChangeCallback('battery_saver', 'Switched due to low battery');
    } else if (level > LOW_BATTERY_THRESHOLD + 0.1 && currentMode === 'battery_saver') {
      // Add hysteresis to prevent rapid switching
      // Only switch back when battery is significantly above threshold
      // User can manually switch back if desired
    }
  }
}

// Get current battery level
export async function getBatteryLevel(): Promise<number> {
  return Battery.getBatteryLevelAsync();
}

// Get battery state (charging, unplugged, etc.)
export async function getBatteryState(): Promise<Battery.BatteryState> {
  return Battery.getBatteryStateAsync();
}

// Check if device is charging
export async function isCharging(): Promise<boolean> {
  const state = await Battery.getBatteryStateAsync();
  return state === Battery.BatteryState.CHARGING ||
    state === Battery.BatteryState.FULL;
}

// Enable/disable automatic mode switching
export function setAutoModeEnabled(enabled: boolean): void {
  autoModeEnabled = enabled;
}

// Get recommended tracking mode based on battery
export async function getRecommendedMode(): Promise<TrackingMode> {
  const level = await getBatteryLevel();
  const charging = await isCharging();

  if (charging) {
    return 'precision';
  }

  if (level <= LOW_BATTERY_THRESHOLD) {
    return 'battery_saver';
  }

  return 'precision';
}

// Get battery status summary
export async function getBatteryStatus(): Promise<{
  level: number;
  state: Battery.BatteryState;
  isCharging: boolean;
  recommendedMode: TrackingMode;
  estimatedTrackingTime: number; // in minutes
}> {
  const level = await getBatteryLevel();
  const state = await getBatteryState();
  const charging = await isCharging();
  const recommendedMode = await getRecommendedMode();

  // Rough estimate of tracking time
  // Precision mode uses about 10% battery per hour
  // Battery saver uses about 3% battery per hour
  const drainRatePerHour = recommendedMode === 'precision' ? 0.10 : 0.03;
  const estimatedTrackingTime = charging
    ? Infinity
    : (level / drainRatePerHour) * 60;

  return {
    level,
    state,
    isCharging: charging,
    recommendedMode,
    estimatedTrackingTime: Math.round(estimatedTrackingTime),
  };
}

// Get human-readable battery status
export async function getBatteryStatusText(): Promise<string> {
  const status = await getBatteryStatus();
  const percent = Math.round(status.level * 100);

  if (status.isCharging) {
    return `${percent}% (Charging)`;
  }

  if (status.level <= CRITICAL_BATTERY_THRESHOLD) {
    return `${percent}% (Critical)`;
  }

  if (status.level <= LOW_BATTERY_THRESHOLD) {
    return `${percent}% (Low)`;
  }

  return `${percent}%`;
}
