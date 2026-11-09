import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { OPENED_ON_DESKTOP } from '../theme/desktop';
import { desk } from '../theme/desk';
import { Text } from './Text';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={OPENED_ON_DESKTOP ? styles.deskRow : styles.row} style={OPENED_ON_DESKTOP ? styles.deskStrip : undefined}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          OPENED_ON_DESKTOP ? (
            // The dashboard's tabs: teal text with a 2px underline for the chosen one
            <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.deskTab}>
              <Text variant="body" color={active ? desk.teal : desk.muted} fixedColor style={{ fontSize: 15, fontFamily: active ? fonts.medium : fonts.regular }}>
                {o.label}
              </Text>
              {active ? <View style={styles.deskLine} /> : null}
            </Pressable>
          ) : (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.chip, active && styles.active]}>
              <Text variant="label" color={active ? colors.onHighlight : colors.textMuted}>
                {o.label}
              </Text>
            </Pressable>
          )
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  chip: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  active: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  deskStrip: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: desk.border },
  deskRow: { gap: 30, height: 48, alignItems: 'stretch' },
  deskTab: { justifyContent: 'center' },
  deskLine: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: desk.teal },
});
