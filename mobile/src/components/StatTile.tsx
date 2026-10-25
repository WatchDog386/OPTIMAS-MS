import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space } from '../theme';
import { Text } from './Text';

interface Props {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  hint?: string;
}

export function StatTile({ label, value, icon, tint = colors.primary, hint }: Props) {
  return (
    <View style={[styles.tile, shadow.card]}>
      <View style={[styles.icon, { backgroundColor: `${tint}14` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text variant="stat">{value}</Text>
      <Text variant="bodySm" color={colors.textMuted} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text variant="label" color={tint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: 2,
  },
  icon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
});
