import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { biometricService, type BiometricCapabilities } from '@/services/auth/biometricService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logo } from '@/components/Logo';

const STORED_EMAIL_KEY = 'last_logged_in_email';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  // Check biometric availability and auto-prompt on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const capabilities = await biometricService.checkCapabilities();
      const enabled = await biometricService.isEnabled();
      const storedEmail = await AsyncStorage.getItem(STORED_EMAIL_KEY);

      if (capabilities.isAvailable && enabled && storedEmail) {
        setBiometricAvailable(true);
        setBiometricType(capabilities.biometricTypeName);
        setEmail(storedEmail);

        // Auto-prompt biometric on launch
        handleBiometricLogin();
      } else if (capabilities.isAvailable && enabled) {
        setBiometricAvailable(true);
        setBiometricType(capabilities.biometricTypeName);
      }
    };
    checkBiometric();
  }, []);

  const handleBiometricLogin = async () => {
    const storedEmail = await AsyncStorage.getItem(STORED_EMAIL_KEY);
    if (!storedEmail) {
      Alert.alert('Setup Required', 'Please sign in with your email and password first, then enable biometric login in Settings.');
      return;
    }

    const result = await biometricService.authenticate('Sign in to RoadLedger');
    if (result.success) {
      // Biometric verified - we trust the stored session
      // The auth store should have a persisted session
      router.replace('/(tabs)');
    } else if (result.error && result.error !== 'Authentication cancelled') {
      Alert.alert('Authentication Failed', result.error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      clearError();
      await signIn(email.trim(), password);

      // Save email for biometric login
      await AsyncStorage.setItem(STORED_EMAIL_KEY, email.trim());

      router.replace('/(tabs)');
    } catch (err) {
      // Error is handled by the store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Logo size="large" showText={true} showTagline={true} />
          <Text style={styles.subtitle}>Track miles. Capture receipts. Stay compliant.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              editable={!isLoading}
            />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login Button */}
          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              disabled={isLoading}
            >
              <Text style={styles.biometricIcon}>
                {biometricType.includes('Face') ? '👤' : '👆'}
              </Text>
              <Text style={styles.biometricText}>Sign in with {biometricType}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  forgotText: {
    fontSize: 14,
    color: '#4f46e5',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  button: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#888',
    fontSize: 14,
  },
  linkText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4f46e5',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    gap: 8,
  },
  biometricIcon: {
    fontSize: 20,
  },
  biometricText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
  },
});
