import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  AccessibilityInfo,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const COLORS = {
  background: '#0D1B2A',
  backgroundHighContrast: '#000000',
  surface: '#1B2838',
  surfaceHighContrast: '#1A1A1A',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  primary: '#2ECC71',
  border: '#243447',
};

interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  voiceControlEnabled: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontScale: number;
}

const COLOR_BLIND_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'protanopia', label: 'Protanopia (Red-blind)' },
  { value: 'deuteranopia', label: 'Deuteranopia (Green-blind)' },
  { value: 'tritanopia', label: 'Tritanopia (Blue-blind)' },
];

const FONT_SCALE_OPTIONS = [
  { value: 0.85, label: 'Small' },
  { value: 1.0, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Extra Large' },
];

export default function AccessibilityScreen() {
  const user = useAuthStore((state) => state.user);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReaderOptimized: false,
    voiceControlEnabled: false,
    colorBlindMode: 'none',
    fontScale: 1.0,
  });
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    checkScreenReader();
  }, []);

  const checkScreenReader = async () => {
    const enabled = await AccessibilityInfo.isScreenReaderEnabled();
    setIsScreenReaderEnabled(enabled);
    if (enabled) {
      setSettings((prev) => ({ ...prev, screenReaderOptimized: true }));
    }
  };

  const loadSettings = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('accessibility_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSettings({
          highContrast: data.high_contrast || false,
          largeText: data.large_text || false,
          reduceMotion: data.reduce_motion || false,
          screenReaderOptimized: data.screen_reader_optimized || false,
          voiceControlEnabled: data.voice_control_enabled || false,
          colorBlindMode: data.color_blind_mode || 'none',
          fontScale: data.font_scale || 1.0,
        });
      }
    } catch (error) {
      // No settings yet, use defaults
    }
  };

  const saveSettings = async (newSettings: AccessibilitySettings) => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('accessibility_preferences')
        .upsert({
          user_id: user.id,
          high_contrast: newSettings.highContrast,
          large_text: newSettings.largeText,
          reduce_motion: newSettings.reduceMotion,
          screen_reader_optimized: newSettings.screenReaderOptimized,
          voice_control_enabled: newSettings.voiceControlEnabled,
          color_blind_mode: newSettings.colorBlindMode,
          font_scale: newSettings.fontScale,
        });

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', 'Failed to save accessibility settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const containerStyle = settings.highContrast
    ? { ...styles.container, backgroundColor: COLORS.backgroundHighContrast }
    : styles.container;

  const surfaceStyle = settings.highContrast
    ? { ...styles.sectionContent, backgroundColor: COLORS.surfaceHighContrast }
    : styles.sectionContent;

  return (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={styles.content}
      accessibilityLabel="Accessibility Settings"
      accessibilityRole="scrollbar"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text
          style={[styles.title, settings.largeText && styles.largeTitle]}
          accessibilityRole="header"
        >
          Accessibility
        </Text>
        <Text style={styles.subtitle}>
          Customize the app to meet your accessibility needs
        </Text>
      </View>

      {/* Screen Reader Detection */}
      {isScreenReaderEnabled && (
        <View style={styles.infoBox} accessibilityRole="alert">
          <Text style={styles.infoText}>
            Screen reader detected. Some settings have been automatically optimized.
          </Text>
        </View>
      )}

      {/* Visual Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Visual
        </Text>
        <View style={surfaceStyle}>
          <View style={styles.item}>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                High Contrast Mode
              </Text>
              <Text style={styles.itemDescription}>
                Increase contrast for better visibility
              </Text>
            </View>
            <Switch
              value={settings.highContrast}
              onValueChange={(value) => updateSetting('highContrast', value)}
              accessibilityLabel="High contrast mode"
              accessibilityHint="Enables higher contrast colors throughout the app"
            />
          </View>

          <View style={[styles.item, styles.itemBorder]}>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                Large Text
              </Text>
              <Text style={styles.itemDescription}>
                Increase text size throughout the app
              </Text>
            </View>
            <Switch
              value={settings.largeText}
              onValueChange={(value) => updateSetting('largeText', value)}
              accessibilityLabel="Large text"
              accessibilityHint="Makes all text larger"
            />
          </View>

          <View style={[styles.item, styles.itemBorder]}>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                Reduce Motion
              </Text>
              <Text style={styles.itemDescription}>
                Minimize animations and transitions
              </Text>
            </View>
            <Switch
              value={settings.reduceMotion}
              onValueChange={(value) => updateSetting('reduceMotion', value)}
              accessibilityLabel="Reduce motion"
              accessibilityHint="Reduces animations throughout the app"
            />
          </View>
        </View>
      </View>

      {/* Color Blind Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Color Vision
        </Text>
        <View style={surfaceStyle}>
          {COLOR_BLIND_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radioItem,
                index < COLOR_BLIND_OPTIONS.length - 1 && styles.itemBorder,
              ]}
              onPress={() => updateSetting('colorBlindMode', option.value as any)}
              accessibilityRole="radio"
              accessibilityState={{ checked: settings.colorBlindMode === option.value }}
              accessibilityLabel={option.label}
            >
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                {option.label}
              </Text>
              <View
                style={[
                  styles.radio,
                  settings.colorBlindMode === option.value && styles.radioSelected,
                ]}
              >
                {settings.colorBlindMode === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Text Size */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Text Size
        </Text>
        <View style={surfaceStyle}>
          {FONT_SCALE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.radioItem,
                index < FONT_SCALE_OPTIONS.length - 1 && styles.itemBorder,
              ]}
              onPress={() => updateSetting('fontScale', option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: settings.fontScale === option.value }}
              accessibilityLabel={`${option.label} text size`}
            >
              <Text
                style={[
                  styles.itemLabel,
                  { fontSize: 16 * option.value },
                ]}
              >
                {option.label}
              </Text>
              <View
                style={[
                  styles.radio,
                  settings.fontScale === option.value && styles.radioSelected,
                ]}
              >
                {settings.fontScale === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Assistive Technology */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Assistive Technology
        </Text>
        <View style={surfaceStyle}>
          <View style={styles.item}>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                Screen Reader Optimized
              </Text>
              <Text style={styles.itemDescription}>
                Optimize content for VoiceOver/TalkBack
              </Text>
            </View>
            <Switch
              value={settings.screenReaderOptimized}
              onValueChange={(value) => updateSetting('screenReaderOptimized', value)}
              accessibilityLabel="Screen reader optimized"
              accessibilityHint="Optimizes the app for screen readers"
            />
          </View>

          <View style={[styles.item, styles.itemBorder]}>
            <View style={styles.itemContent}>
              <Text style={[styles.itemLabel, settings.largeText && styles.largeText]}>
                Voice Control Support
              </Text>
              <Text style={styles.itemDescription}>
                Enhanced support for voice commands
              </Text>
            </View>
            <Switch
              value={settings.voiceControlEnabled}
              onValueChange={(value) => updateSetting('voiceControlEnabled', value)}
              accessibilityLabel="Voice control support"
              accessibilityHint="Enables enhanced voice control features"
            />
          </View>
        </View>
      </View>

      {/* Accessibility Statement */}
      <View style={styles.statement}>
        <Text style={styles.statementTitle}>Accessibility Commitment</Text>
        <Text style={styles.statementText}>
          RoadLedger is committed to ensuring digital accessibility for people with
          disabilities. We are continually improving the user experience for everyone
          and applying the relevant accessibility standards (WCAG 2.1 Level AA).
        </Text>
        <Text style={styles.statementText}>
          If you encounter any accessibility barriers, please contact us at
          support@cienrios.com. We welcome your feedback and will work to address
          any issues promptly.
        </Text>
      </View>

      {saving && (
        <Text style={styles.savingText} accessibilityLiveRegion="polite">
          Saving...
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  largeTitle: {
    fontSize: 34,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  infoBox: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  itemContent: {
    flex: 1,
    marginRight: 16,
  },
  itemLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  largeText: {
    fontSize: 20,
  },
  itemDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  statement: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  statementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  statementText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  savingText: {
    textAlign: 'center',
    color: COLORS.primary,
    marginTop: 16,
  },
});
