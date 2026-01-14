import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { TRACKING_MODES, type TrackingMode } from '@/constants';

const LOCATION_TASK_NAME = 'ROADLEDGER_BACKGROUND_LOCATION';

// Location tracking configuration
interface LocationConfig {
  accuracy: Location.Accuracy;
  distanceInterval: number;
  timeInterval: number;
  showsBackgroundLocationIndicator: boolean;
  foregroundService?: {
    notificationTitle: string;
    notificationBody: string;
    notificationColor: string;
  };
}

// Callback type for location updates
type LocationCallback = (location: Location.LocationObject) => void;

// Store the callback globally for the background task
let locationCallback: LocationCallback | null = null;

// Track if we're currently tracking
let isTracking = false;

// Get location config based on tracking mode
function getLocationConfig(mode: TrackingMode): LocationConfig {
  const modeConfig = TRACKING_MODES[mode];

  return {
    accuracy:
      mode === 'precision'
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.Balanced,
    distanceInterval: modeConfig.distanceInterval,
    timeInterval: modeConfig.timeInterval,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'RoadLedger',
      notificationBody:
        mode === 'precision'
          ? 'Tracking trip - Precision mode'
          : 'Tracking trip - Battery saver mode',
      notificationColor: '#4f46e5',
    },
  };
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }

  if (data && locationCallback) {
    const { locations } = data as { locations: Location.LocationObject[] };

    for (const location of locations) {
      try {
        locationCallback(location);
      } catch (err) {
        console.error('Error processing location:', err);
      }
    }
  }
});

// Request location permissions
export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  // Request foreground permission first
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    return { foreground: false, background: false };
  }

  // Request background permission
  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return {
    foreground: foregroundStatus === 'granted',
    background: backgroundStatus === 'granted',
  };
}

// Check current permission status
export async function checkLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status === 'granted',
    background: background.status === 'granted',
  };
}

// Start location tracking
export async function startLocationTracking(
  mode: TrackingMode,
  callback: LocationCallback
): Promise<boolean> {
  try {
    // Check permissions
    const permissions = await checkLocationPermissions();

    if (!permissions.foreground) {
      console.error('Foreground location permission not granted');
      return false;
    }

    // Store callback
    locationCallback = callback;
    isTracking = true;

    // Get config for mode
    const config = getLocationConfig(mode);

    // Check if we have background permission
    if (permissions.background) {
      // Start background location updates
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: config.accuracy,
        distanceInterval: config.distanceInterval,
        timeInterval: config.timeInterval,
        showsBackgroundLocationIndicator: config.showsBackgroundLocationIndicator,
        foregroundService: Platform.OS === 'android' ? config.foregroundService : undefined,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
      });
    } else {
      // Foreground only - use watchPositionAsync
      console.warn('Background permission not granted, using foreground only');

      await Location.watchPositionAsync(
        {
          accuracy: config.accuracy,
          distanceInterval: config.distanceInterval,
          timeInterval: config.timeInterval,
        },
        (location) => {
          if (locationCallback) {
            locationCallback(location);
          }
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Failed to start location tracking:', error);
    isTracking = false;
    return false;
  }
}

// Stop location tracking
export async function stopLocationTracking(): Promise<void> {
  try {
    isTracking = false;
    locationCallback = null;

    // Check if background task is running
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      LOCATION_TASK_NAME
    );

    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.error('Failed to stop location tracking:', error);
  }
}

// Update tracking mode (stop and restart with new config)
export async function updateTrackingMode(
  mode: TrackingMode,
  callback: LocationCallback
): Promise<boolean> {
  await stopLocationTracking();
  return startLocationTracking(mode, callback);
}

// Get current location (one-time)
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  try {
    const permissions = await checkLocationPermissions();

    if (!permissions.foreground) {
      return null;
    }

    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
}

// Check if tracking is active
export function isLocationTracking(): boolean {
  return isTracking;
}

// Get the distance between two points in miles
export function getDistanceBetweenPoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
