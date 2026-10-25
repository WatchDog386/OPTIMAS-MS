import { StyleSheet, View, type ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { colors, fonts } from '../theme';

/** Material 3 navigation bar: white surface, top hairline, pill indicator behind the active icon. */
export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.3, marginTop: 2 },
  tabBarStyle: {
    height: 76,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
  },
  sceneStyle: { backgroundColor: colors.bg },
};

export const tabIcon =
  (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={focused ? active : name} size={22} color={color as string} />
    </View>
  );

const styles = StyleSheet.create({
  pill: { width: 60, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.primarySoft },
});
