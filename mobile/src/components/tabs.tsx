import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { colors, fonts } from '../theme';

/** Floating, rounded dark tab bar with a lime active state. */
export const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textDim,
  tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, marginBottom: 4 },
  tabBarStyle: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    marginHorizontal: 16,
    height: 68,
    paddingTop: 8,
    borderRadius: 24,
    borderTopWidth: 0,
    backgroundColor: colors.surface,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  sceneStyle: { backgroundColor: colors.bg },
};

export const tabIcon =
  (name: keyof typeof Ionicons.glyphMap, active: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={22} color={color as string} />
  );
