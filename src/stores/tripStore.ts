import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip, TripPoint, JurisdictionMiles, TripStatus } from '@/types/database.types';
import type { TrackingMode } from '@/constants';
import {
  createTrip,
  updateTrip,
  getTripById,
  getActiveTrip,
  getUserTrips,
  addTripPoint,
  getTripPoints,
  getJurisdictionMiles,
  upsertJurisdictionMiles,
} from '@/lib/database';

interface TripState {
  // Current trip state
  activeTrip: Trip | null;
  activeTripPoints: TripPoint[];
  activeTripJurisdictionMiles: JurisdictionMiles[];

  // Trip history
  trips: Trip[];
  tripsLoading: boolean;

  // Tracking state
  isTracking: boolean;
  trackingMode: TrackingMode;
  lastLocation: { lat: number; lng: number; ts: string } | null;
  currentJurisdiction: string | null;

  // Actions
  loadActiveTrip: (userId: string) => Promise<void>;
  startTrip: (userId: string, loaded?: boolean) => Promise<Trip>;
  endTrip: () => Promise<void>;
  pauseTrip: () => Promise<void>;
  resumeTrip: () => Promise<void>;
  addPoint: (point: Omit<TripPoint, 'id'>) => Promise<void>;
  updateJurisdictionMiles: (jurisdiction: string, miles: number, confidence?: number) => Promise<void>;
  setTrackingMode: (mode: TrackingMode) => void;
  setCurrentJurisdiction: (jurisdiction: string | null) => void;
  loadTrips: (userId: string, options?: { limit?: number; status?: TripStatus }) => Promise<void>;
  refreshActiveTrip: () => Promise<void>;
  clearActiveTrip: () => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeTrip: null,
      activeTripPoints: [],
      activeTripJurisdictionMiles: [],
      trips: [],
      tripsLoading: false,
      isTracking: false,
      trackingMode: 'precision',
      lastLocation: null,
      currentJurisdiction: null,

      // Load active trip for user
      loadActiveTrip: async (userId: string) => {
        try {
          const trip = await getActiveTrip(userId);

          if (trip) {
            const points = await getTripPoints(trip.id);
            const jurisdictionMiles = await getJurisdictionMiles(trip.id);

            set({
              activeTrip: trip,
              activeTripPoints: points,
              activeTripJurisdictionMiles: jurisdictionMiles,
              isTracking: trip.status === 'in_progress',
            });
          } else {
            set({
              activeTrip: null,
              activeTripPoints: [],
              activeTripJurisdictionMiles: [],
              isTracking: false,
            });
          }
        } catch (error) {
          console.error('Failed to load active trip:', error);
        }
      },

      // Start a new trip
      startTrip: async (userId: string, loaded: boolean = false) => {
        try {
          const trip = await createTrip(userId, {
            status: 'in_progress',
            loaded,
            source: 'gps',
            started_at: new Date().toISOString(),
          });

          set({
            activeTrip: trip,
            activeTripPoints: [],
            activeTripJurisdictionMiles: [],
            isTracking: true,
            lastLocation: null,
            currentJurisdiction: null,
          });

          return trip;
        } catch (error) {
          console.error('Failed to start trip:', error);
          throw error;
        }
      },

      // End the current trip
      endTrip: async () => {
        const { activeTrip } = get();
        if (!activeTrip) return;

        try {
          await updateTrip(activeTrip.id, {
            status: 'finalized',
            ended_at: new Date().toISOString(),
          });

          // Refresh the trip data
          const updatedTrip = await getTripById(activeTrip.id);
          const jurisdictionMiles = await getJurisdictionMiles(activeTrip.id);

          set({
            activeTrip: updatedTrip,
            activeTripJurisdictionMiles: jurisdictionMiles,
            isTracking: false,
          });
        } catch (error) {
          console.error('Failed to end trip:', error);
          throw error;
        }
      },

      // Pause the current trip
      pauseTrip: async () => {
        const { activeTrip } = get();
        if (!activeTrip) return;

        try {
          await updateTrip(activeTrip.id, {
            status: 'draft',
          });

          set({
            activeTrip: { ...activeTrip, status: 'draft' },
            isTracking: false,
          });
        } catch (error) {
          console.error('Failed to pause trip:', error);
          throw error;
        }
      },

      // Resume a paused trip
      resumeTrip: async () => {
        const { activeTrip } = get();
        if (!activeTrip) return;

        try {
          await updateTrip(activeTrip.id, {
            status: 'in_progress',
          });

          set({
            activeTrip: { ...activeTrip, status: 'in_progress' },
            isTracking: true,
          });
        } catch (error) {
          console.error('Failed to resume trip:', error);
          throw error;
        }
      },

      // Add a GPS point to the current trip
      addPoint: async (point: Omit<TripPoint, 'id'>) => {
        const { activeTrip, activeTripPoints } = get();
        if (!activeTrip) return;

        try {
          const id = await addTripPoint(activeTrip.id, point);
          const newPoint = { ...point, id } as TripPoint;

          set({
            activeTripPoints: [...activeTripPoints, newPoint],
            lastLocation: {
              lat: point.lat,
              lng: point.lng,
              ts: point.ts,
            },
            currentJurisdiction: point.jurisdiction || get().currentJurisdiction,
          });
        } catch (error) {
          console.error('Failed to add trip point:', error);
        }
      },

      // Update jurisdiction miles for the current trip
      updateJurisdictionMiles: async (
        jurisdiction: string,
        miles: number,
        confidence?: number
      ) => {
        const { activeTrip, activeTripJurisdictionMiles } = get();
        if (!activeTrip) return;

        try {
          await upsertJurisdictionMiles(activeTrip.id, jurisdiction, miles, confidence);

          // Update local state
          const existing = activeTripJurisdictionMiles.find(
            (jm) => jm.jurisdiction === jurisdiction
          );

          if (existing) {
            set({
              activeTripJurisdictionMiles: activeTripJurisdictionMiles.map((jm) =>
                jm.jurisdiction === jurisdiction
                  ? { ...jm, miles, confidence: confidence ?? jm.confidence }
                  : jm
              ),
            });
          } else {
            set({
              activeTripJurisdictionMiles: [
                ...activeTripJurisdictionMiles,
                {
                  id: Date.now(),
                  trip_id: activeTrip.id,
                  jurisdiction,
                  miles,
                  confidence: confidence ?? null,
                  method: 'gps',
                },
              ],
            });
          }
        } catch (error) {
          console.error('Failed to update jurisdiction miles:', error);
        }
      },

      // Set tracking mode
      setTrackingMode: (mode: TrackingMode) => {
        set({ trackingMode: mode });
      },

      // Set current jurisdiction
      setCurrentJurisdiction: (jurisdiction: string | null) => {
        set({ currentJurisdiction: jurisdiction });
      },

      // Load trip history
      loadTrips: async (userId: string, options) => {
        try {
          set({ tripsLoading: true });
          const trips = await getUserTrips(userId, options);
          set({ trips, tripsLoading: false });
        } catch (error) {
          console.error('Failed to load trips:', error);
          set({ tripsLoading: false });
        }
      },

      // Refresh active trip from database
      refreshActiveTrip: async () => {
        const { activeTrip } = get();
        if (!activeTrip) return;

        try {
          const trip = await getTripById(activeTrip.id);
          const points = await getTripPoints(activeTrip.id);
          const jurisdictionMiles = await getJurisdictionMiles(activeTrip.id);

          set({
            activeTrip: trip,
            activeTripPoints: points,
            activeTripJurisdictionMiles: jurisdictionMiles,
          });
        } catch (error) {
          console.error('Failed to refresh active trip:', error);
        }
      },

      // Clear active trip state
      clearActiveTrip: () => {
        set({
          activeTrip: null,
          activeTripPoints: [],
          activeTripJurisdictionMiles: [],
          isTracking: false,
          lastLocation: null,
          currentJurisdiction: null,
        });
      },
    }),
    {
      name: 'trip-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist essential tracking state
        trackingMode: state.trackingMode,
        // Don't persist active trip - load from database
      }),
    }
  )
);

// Selector hooks
export const useActiveTrip = () => useTripStore((state) => state.activeTrip);
export const useIsTracking = () => useTripStore((state) => state.isTracking);
export const useTrackingMode = () => useTripStore((state) => state.trackingMode);
export const useCurrentJurisdiction = () => useTripStore((state) => state.currentJurisdiction);
