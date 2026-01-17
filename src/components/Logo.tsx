// RoadLedger Logo Component
// Reusable logo for consistent branding across the app

import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showTagline?: boolean;
  style?: ViewStyle;
}

const SIZES = {
  small: { logo: 48, title: 18, tagline: 10 },
  medium: { logo: 80, title: 28, tagline: 14 },
  large: { logo: 120, title: 36, tagline: 16 },
};

export function Logo({
  size = 'medium',
  showText = true,
  showTagline = false,
  style
}: LogoProps) {
  const dimensions = SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/icon.png')}
        style={[styles.logo, { width: dimensions.logo, height: dimensions.logo }]}
        resizeMode="contain"
      />
      {showText && (
        <Text style={[styles.title, { fontSize: dimensions.title }]}>
          RoadLedger
        </Text>
      )}
      {showTagline && (
        <Text style={[styles.tagline, { fontSize: dimensions.tagline }]}>
          Know Your Profit. Every Mile.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    marginBottom: 8,
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  tagline: {
    color: '#2ECC71',
    marginTop: 4,
    fontStyle: 'italic',
  },
});

export default Logo;
