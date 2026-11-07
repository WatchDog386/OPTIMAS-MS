import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, isDark, space } from '../theme';
import { Text } from './Text';

export interface QuickAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tint?: string;
  badge?: number;
}

/** Optional small button on the right of the title (e.g. "Manage"); `active` shows it pressed in. */
export interface QuickActionsButton {
  label: string;
  onPress: () => void;
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** Four-column grid of round grey icon buttons (Business-SME "Quick Actions"). */
export function QuickActions({ items, title = 'Quick Actions', action }: { items: QuickAction[]; title?: string; action?: QuickActionsButton }) {
  return (
    <View style={isDark ? styles.panel : undefined}>
      <View style={styles.head}>
        <Text variant="title" style={{ marginLeft: 4, fontFamily: fonts.semibold, fontSize: 17 }}>
          {title}
        </Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            style={({ pressed }) => [styles.manage, action.active && styles.manageOn, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: !!action.active }}
            accessibilityLabel={action.label}
            hitSlop={8}
          >
            {isDark ? null : <Ionicons name={action.icon ?? (action.active ? 'chevron-up' : 'options-outline')} size={15} color={action.active ? colors.white : colors.text} />}
            <Text variant="bodySm" color={action.active ? colors.white : isDark ? colors.brand : colors.text} fixedColor={action.active || isDark} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.grid}>
        {items.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.94 }], opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={a.label}>
            <View style={styles.circle}>
              <Ionicons name={a.icon} size={20} color={a.tint ?? (isDark ? colors.white : colors.brand)} />
              {a.badge ? (
                <View style={styles.badge}>
                  <Text variant="label" color={colors.white} fixedColor style={{ fontSize: 10, lineHeight: 12, fontFamily: fonts.bold }}>
                    {a.badge > 9 ? '9+' : a.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="bodySm" align="center" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17 }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The Co-op "Quick Actions" panel: smoky glass over the photo
  panel: { padding: 18, paddingBottom: 20, borderRadius: 12, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  manage: isDark
    ? { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 20, borderRadius: 19, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.38)' }
    : { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  manageOn: isDark ? { backgroundColor: colors.highlight, borderColor: colors.highlight } : { backgroundColor: colors.text, borderColor: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  item: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  // Co-op icon circles: deep green with a lighter rim
  circle: { width: 46, height: 46, borderRadius: 23, backgroundColor: isDark ? '#0F5A3C' : colors.glassStrong, borderWidth: 1, borderColor: isDark ? 'rgba(141,198,63,0.35)' : colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});
