import { StyleSheet, View } from 'react-native';
import { colors, isDark, useInverse } from '../theme';
import { initials } from '../utils/format';
import { Text } from './Text';

/**
 * `color` at `alpha` opacity. Works for '#RRGGBB' and 'rgba(…)' / 'rgb(…)' colours alike (adding "1F" to an
 * rgba colour made an invalid colour, which showed as a pale white circle in dark mode).
 */
function withAlpha(color: string, alpha: number) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  return color;
}

export function Avatar({ name, size = 44, tint: tintProp = colors.primary }: { name: string; size?: number; tint?: string }) {
  const inverse = useInverse();
  const tint = inverse && tintProp === colors.primary ? colors.onHero : tintProp;
  return (
    <View
      style={[
        styles.base,
        // In dark mode a deep, solid circle with the colour as a soft wash, never a pale disc
        { width: size, height: size, borderRadius: size / 2, backgroundColor: isDark ? '#1E2A30' : withAlpha(tint, 0.12), borderColor: withAlpha(tint, isDark ? 0.45 : 0.25) },
      ]}
    >
      <Text variant="title" color={tint} fixedColor style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 } });
