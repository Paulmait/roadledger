import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { US_STATES } from '@/constants/jurisdictions';

export default function OnboardingScreen() {
  const profile = useAuthStore((state) => state.profile);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [mcNumber, setMcNumber] = useState(profile?.mc_number || '');
  const [dotNumber, setDotNumber] = useState(profile?.dot_number || '');
  const [homeState, setHomeState] = useState(profile?.home_state || '');

  const handleContinue = async () => {
    try {
      await updateProfile({
        company_name: companyName.trim() || null,
        mc_number: mcNumber.trim() || null,
        dot_number: dotNumber.trim() || null,
        home_state: homeState || null,
      });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              This information helps with IFTA reporting and compliance
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your trucking company name"
                placeholderTextColor="#666"
                value={companyName}
                onChangeText={setCompanyName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>MC Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="MC-123456"
                placeholderTextColor="#666"
                value={mcNumber}
                onChangeText={setMcNumber}
                autoCapitalize="characters"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>DOT Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="1234567"
                placeholderTextColor="#666"
                value={dotNumber}
                onChangeText={setDotNumber}
                keyboardType="number-pad"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>IFTA Base State</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={homeState}
                  onValueChange={setHomeState}
                  style={styles.picker}
                  enabled={!isLoading}
                >
                  <Picker.Item label="Select your base state..." value="" />
                  {US_STATES.map((state) => (
                    <Picker.Item
                      key={state.code}
                      label={state.name}
                      value={state.code}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={isLoading}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
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
  pickerContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3d5c',
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
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
  skipButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    color: '#888',
    fontSize: 14,
  },
});
