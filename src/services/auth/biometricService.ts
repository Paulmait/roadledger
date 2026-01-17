// Biometric Authentication Service
// Supports Face ID, Touch ID, and Android fingerprint

import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometricType: 'face' | 'fingerprint' | 'iris' | 'none';
  biometricTypeName: string;
}

class BiometricService {
  /**
   * Check if device supports biometric authentication
   */
  async checkCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();

      if (!hasHardware) {
        return {
          isAvailable: false,
          biometricType: 'none',
          biometricTypeName: 'Not available',
        };
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!isEnrolled) {
        return {
          isAvailable: false,
          biometricType: 'none',
          biometricTypeName: 'Not enrolled',
        };
      }

      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: 'face' | 'fingerprint' | 'iris' | 'none' = 'none';
      let biometricTypeName = 'Biometrics';

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'face';
        biometricTypeName = 'Face ID';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
        biometricTypeName = 'Touch ID / Fingerprint';
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
        biometricTypeName = 'Iris';
      }

      return {
        isAvailable: true,
        biometricType,
        biometricTypeName,
      };
    } catch (error) {
      console.error('Biometric check failed:', error);
      return {
        isAvailable: false,
        biometricType: 'none',
        biometricTypeName: 'Error',
      };
    }
  }

  /**
   * Check if user has enabled biometric login
   */
  async isEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable biometric login
   */
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('Failed to save biometric preference:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(promptMessage?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const capabilities = await this.checkCapabilities();

      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication not available',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to access RoadLedger',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      // Handle specific error types
      if (result.error === 'user_cancel') {
        return { success: false, error: 'Authentication cancelled' };
      } else if (result.error === 'user_fallback') {
        return { success: false, error: 'Fallback requested' };
      } else if (result.error === 'lockout') {
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }

      return { success: false, error: result.error || 'Authentication failed' };
    } catch (error) {
      console.error('Biometric auth error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }
}

export const biometricService = new BiometricService();
