import { StyleSheet, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { Text } from './Text';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const tones: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.surfaceHigh, fg: colors.textMuted },
  brand: { bg: colors.primarySoft, fg: colors.primary },
};

export function Badge({ label, tone = 'neutral', dot = true }: { label: string; tone?: Tone; dot?: boolean }) {
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      <Text variant="label" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: space.md - 2, paddingVertical: 5, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
