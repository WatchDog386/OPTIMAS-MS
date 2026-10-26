import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { useAppUpdate } from '../utils/updates';
import { Text } from './Text';

/** Floating "New version ready" pill that drops in from the top when a release is deployed. */
export function UpdateBanner() {
  const { available, apply } = useAppUpdate();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-120)).current;
  useEffect(() => {
    if (available) Animated.timing(y, { toValue: 0, duration: 520, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [available, y]);
  if (!available) return null;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 10, transform: [{ translateY: y }] }]}>
      <Pressable onPress={apply} accessibilityRole="button" accessibilityLabel="Update to the new version" style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={styles.icon}>
          <Ionicons name="sparkles" size={16} color={colors.onHighlight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title" color={colors.white} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
            New version ready
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.65)" fixedColor>
            Tap to update — takes a second
          </Text>
        </View>
        <View style={styles.cta}>
          <Text variant="label" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
            Update
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, zIndex: 50, alignItems: 'center' },
  pill: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingLeft: 12,
    borderRadius: 22,
    backgroundColor: colors.charcoal,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  cta: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
});
