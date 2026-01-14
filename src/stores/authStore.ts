import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';
import {
  supabase,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
  getProfile,
  updateProfile as supabaseUpdateProfile,
} from '@/lib/supabase';

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  clearError: () => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      // Initialize auth state
      initialize: async () => {
        try {
          set({ isLoading: true, error: null });

          // Get current session
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            // Fetch profile
            const profile = await getProfile(session.user.id);

            set({
              user: session.user,
              session,
              profile,
              isInitialized: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              session: null,
              profile: null,
              isInitialized: true,
              isLoading: false,
            });
          }

          // Set up auth state listener
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const profile = await getProfile(session.user.id);
              set({
                user: session.user,
                session,
                profile,
              });
            } else if (event === 'SIGNED_OUT') {
              set({
                user: null,
                session: null,
                profile: null,
              });
            } else if (event === 'TOKEN_REFRESHED' && session) {
              set({ session });
            }
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to initialize auth',
            isLoading: false,
            isInitialized: true,
          });
        }
      },

      // Sign in
      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const { user, session } = await supabaseSignIn({ email, password });

          if (user) {
            const profile = await getProfile(user.id);
            set({
              user,
              session,
              profile,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sign in failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Sign up
      signUp: async (email: string, password: string, fullName?: string) => {
        try {
          set({ isLoading: true, error: null });

          const { user, session } = await supabaseSignUp({
            email,
            password,
            fullName,
          });

          if (user) {
            // Profile is created via trigger, fetch it
            const profile = await getProfile(user.id);
            set({
              user,
              session,
              profile,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sign up failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Sign out
      signOut: async () => {
        try {
          set({ isLoading: true, error: null });

          await supabaseSignOut();

          set({
            user: null,
            session: null,
            profile: null,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Sign out failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Refresh profile from server
      refreshProfile: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const profile = await getProfile(user.id);
          set({ profile });
        } catch (error) {
          console.error('Failed to refresh profile:', error);
        }
      },

      // Update profile
      updateProfile: async (updates: Partial<Profile>) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        try {
          set({ isLoading: true, error: null });

          const profile = await supabaseUpdateProfile(user.id, updates);

          set({ profile, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false,
          });
          throw error;
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Set session (for external updates)
      setSession: (session: Session | null) => {
        set({
          session,
          user: session?.user ?? null,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist minimal auth state
        // Full session is handled by SecureStore via Supabase
        isInitialized: state.isInitialized,
      }),
    }
  )
);

// Selector hooks for convenience
export const useUser = () => useAuthStore((state) => state.user);
export const useProfile = () => useAuthStore((state) => state.profile);
export const useSession = () => useAuthStore((state) => state.session);
export const useIsAuthenticated = () => useAuthStore((state) => !!state.session);
