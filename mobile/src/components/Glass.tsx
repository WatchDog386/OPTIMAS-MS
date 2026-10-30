import { useId, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Line, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

/* ─────────────────────────── Backdrop ─────────────────────────── */

/** Soft grey "frosted glass" page backdrop with diffused light blobs (white top-right, yellow bottom-left). */
export function GlassBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.bgTop, '#E9E9E9', colors.bgBottom]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="gb-white" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gb-yellow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F1F27A" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#F1F27A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gb-grey" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#CFCFCF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#CFCFCF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="88%" cy="10%" r="300" fill="url(#gb-white)" />
        <Circle cx="5%" cy="95%" r="340" fill="url(#gb-yellow)" />
        <Circle cx="0%" cy="45%" r="220" fill="url(#gb-grey)" />
      </Svg>
      {/* The top edge is exactly the status-bar colour, so the bar and the page read as one surface */}
      <LinearGradient colors={[colors.bgTop, 'rgba(243,243,243,0)']} style={styles.topBlend} pointerEvents="none" />
    </View>
  );
}

/* ─────────────────────────── Surfaces ─────────────────────────── */

interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** More opaque white, for content-heavy cards (like the wallet card in the reference). */
  strong?: boolean;
  radius?: number;
  padded?: boolean;
  onPress?: () => void;
}

/** Frosted translucent white surface with a bright hairline edge. */
export function Glass({ children, style, strong, radius = 28, padded = true, onPress }: GlassProps) {
  const body = (
    <View style={[styles.glass, { borderRadius: radius }, padded && styles.padded, style]}>
      {/* A live blur per card is costly on phones' browsers (it redraws while scrolling); the cards are
          nearly opaque, so the web app and Android go without it */}
      {Platform.OS === 'ios' ? <BlurView intensity={30} tint="light" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: strong ? colors.glassStrong : colors.glass }]} />
      {children}
    </View>
  );
  if (!onPress) return <View style={[styles.shadow, { borderRadius: radius }]}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shadow, { borderRadius: radius }, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}>
      {body}
    </Pressable>
  );
}

/** Round frosted icon button (back, calendar, wallet… in the reference). */
export function GlassCircle({ children, size = 46, onPress, label, highlight }: { children: ReactNode; size?: number; onPress?: () => void; label?: string; highlight?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: highlight ? colors.highlight : colors.glassStrong, borderColor: highlight ? colors.highlight : colors.glassBorder },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ─────────────────────────── Hatching ─────────────────────────── */

/** Diagonal hatched fill, clipped to a rounded rectangle. Place inside a sized, relatively positioned parent. */
export function Hatch({ radius = 999, color = colors.hatch, gap = 7 }: { radius?: number; color?: string; gap?: number }) {
  const id = `hatch${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform="rotate(45)">
          <Line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeWidth={1.6} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill="rgba(255,255,255,0.35)" />
      <Rect x="0" y="0" width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glass: { overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder },
  padded: { padding: 20 },
  topBlend: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  shadow: { shadowColor: '#1C1D1F', shadowOpacity: 0.08, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
});
