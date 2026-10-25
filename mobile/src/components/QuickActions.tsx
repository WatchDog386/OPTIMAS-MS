import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../theme';
import { Text } from './Text';

export interface QuickAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tint?: string;
  badge?: number;
}

/** Four-column grid of round grey icon buttons (Business-SME "Quick Actions"). */
export function QuickActions({ items, title = 'Quick Actions' }: { items: QuickAction[]; title?: string }) {
  return (
    <View>
      <Text variant="h2" style={{ marginBottom: space.lg, marginLeft: 4 }}>
        {title}
      </Text>
      <View style={styles.grid}>
        {items.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.item, pressed && { transform: [{ scale: 0.94 }], opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={a.label}>
            <View style={styles.circle}>
              <Ionicons name={a.icon} size={24} color={a.tint ?? colors.text} />
              {a.badge ? (
                <View style={styles.badge}>
                  <Text variant="label" color={colors.white} fixedColor style={{ fontSize: 10, lineHeight: 12, fontFamily: fonts.bold }}>
                    {a.badge > 9 ? '9+' : a.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="bodySm" align="center" numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 16 }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  item: { width: '25%', alignItems: 'center', gap: space.sm, paddingHorizontal: 2 },
  circle: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});
