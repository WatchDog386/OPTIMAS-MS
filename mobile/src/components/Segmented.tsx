import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { colors, radius, space } from '../theme';
import { Text } from './Text';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.active]}>
            <Text variant="label" color={active ? colors.onPrimary : colors.textMuted}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
});
