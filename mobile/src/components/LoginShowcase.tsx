import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { notchedPath } from './AdminHero';
import { PulseDot } from './Motion';
import { Text } from './Text';

/*
 * Sign-in hero: a floating stack of the app's own cards — the notched colour blocks from the dashboards
 * behind a frosted "live" preview that changes with each slide. Shows the product instead of decoration.
 */

const NATIVE = Platform.OS !== 'web';
const LAVENDER = '#C3A6FF';
const MINT = '#A8E6C4';

/** Slow vertical drift; each card gets its own phase so the stack breathes. */
function useFloat(delay: number, distance = 6) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2600, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
}

function Block({ w, h, fill, value, label, icon }: { w: number; h: number; fill: string; value: string; label: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ width: w, height: h, padding: 14 }}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Path d={notchedPath(w, h, 22, 38, 8)} fill={fill} />
      </Svg>
      <View style={styles.blockArrow}>
        <Ionicons name="arrow-up-outline" size={14} color={colors.text} style={{ transform: [{ rotate: '45deg' }] }} />
      </View>
      <Text style={styles.blockValue}>{value}</Text>
      <Text variant="label" style={{ fontFamily: fonts.semibold, color: colors.text }}>
        {label}
      </Text>
      <View style={styles.blockIcon}>
        <Ionicons name={icon} size={14} color={colors.white} />
      </View>
    </View>
  );
}

/** Frosted preview card in front of the stack. */
function Preview({ slide }: { slide: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 480, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: NATIVE }).start();
  }, [slide, fade]);
  const body: ReactNode[] = [
    // Technician: shift
    <View key="t" style={styles.row}>
      <Svg width={58} height={58}>
        <Circle cx={29} cy={29} r={24} stroke="rgba(28,29,31,0.08)" strokeWidth={7} fill="none" />
        <Circle cx={29} cy={29} r={24} stroke={colors.highlight} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 24}`} strokeDashoffset={2 * Math.PI * 24 * 0.28} transform="rotate(-90 29 29)" />
      </Svg>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.row}>
          <PulseDot color={colors.success} size={6} />
          <Text variant="title" style={styles.pTitle}>
            On duty · 5h 46m
          </Text>
        </View>
        <Text variant="label" color={colors.textMuted}>
          Checked in 08:02 · dress code ✓
        </Text>
        <View style={styles.chip}>
          <Text variant="label" style={styles.chipText}>
            On time
          </Text>
        </View>
      </View>
    </View>,
    // Supervisor: routers
    <View key="s" style={{ gap: 9 }}>
      <View style={styles.row}>
        <PulseDot color={colors.success} size={6} />
        <Text variant="title" style={styles.pTitle}>
          Routers accounted for
        </Text>
      </View>
      {[
        ['In store', 30, 0.62],
        ['With technicians', 12, 0.25],
        ['Installed today', 6, 0.13],
      ].map(([label, n, w]) => (
        <View key={label as string} style={styles.row}>
          <Text variant="label" color={colors.textMuted} style={{ width: 104 }}>
            {label}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(w as number) * 100}%` }]} />
          </View>
          <Text variant="label" style={{ fontFamily: fonts.bold, width: 22, textAlign: 'right' }}>
            {n}
          </Text>
        </View>
      ))}
    </View>,
    // Customer: visit tracker
    <View key="c" style={{ gap: 10 }}>
      <View style={styles.row}>
        <PulseDot color="#F59E0B" size={6} />
        <Text variant="title" style={styles.pTitle}>
          Technician on the way
        </Text>
      </View>
      <View style={styles.steps}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
            <View style={[styles.stepDot, i <= 1 && styles.stepDone, i === 2 && styles.stepNext]}>{i <= 1 ? <Ionicons name="checkmark" size={9} color={colors.onHighlight} /> : null}</View>
            {i < 3 ? <View style={[styles.stepLine, i < 1 && { backgroundColor: colors.highlight }]} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={12} color={colors.white} />
        </View>
        <Text variant="label" style={{ fontFamily: fonts.semibold, flex: 1 }}>
          Brian · arriving ~10:40
        </Text>
        <Ionicons name="call" size={14} color={colors.text} />
      </View>
    </View>,
  ];
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{body[slide % body.length]}</Animated.View>;
}

export function LoginShowcase({ width, height, slide }: { width: number; height: number; slide: number }) {
  const f1 = useFloat(0, 5);
  const f2 = useFloat(700, 7);
  const f3 = useFloat(1300, 4);
  const cardW = Math.min(width - 48, 330);
  const blockW = Math.round(Math.min(150, width * 0.38));
  const blockH = Math.round(blockW * 1.08);
  return (
    <View style={{ width, height }} pointerEvents="none">
      {/* Soft colour light behind the stack */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="lav" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={LAVENDER} stopOpacity={0.55} />
            <Stop offset="1" stopColor={LAVENDER} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="lime" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ECF23A" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#ECF23A" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={width * 0.22} cy={height * 0.42} r={width * 0.42} fill="url(#lav)" />
        <Circle cx={width * 0.85} cy={height * 0.62} r={width * 0.4} fill="url(#lime)" />
      </Svg>

      <Animated.View style={[styles.abs, { left: width * 0.5 - blockW - 18, top: height * 0.1, transform: [{ translateY: f1 }, { rotate: '-7deg' }] }]}>
        <Block w={blockW} h={blockH} fill={LAVENDER} value="30" label="Routers in store" icon="cube" />
      </Animated.View>
      <Animated.View style={[styles.abs, { left: width * 0.5 + 18, top: height * 0.05, transform: [{ translateY: f2 }, { rotate: '6deg' }] }]}>
        <Block w={blockW} h={blockH} fill={MINT} value="4.9" label="Customer rating" icon="star" />
      </Animated.View>

      <Animated.View style={[styles.preview, { width: cardW, left: (width - cardW) / 2, bottom: height * 0.04, transform: [{ translateY: f3 }] }]}>
        <Preview slide={slide} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  blockArrow: { position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  blockValue: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 40, letterSpacing: -1, color: colors.text },
  blockIcon: { position: 'absolute', right: 12, bottom: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center' },
  preview: {
    position: 'absolute',
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 9, height: 22, borderRadius: 11, backgroundColor: colors.successSoft, justifyContent: 'center' },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.success },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,29,31,0.07)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.highlight },
  steps: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(28,29,31,0.15)', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  stepNext: { borderColor: colors.text },
  stepLine: { flex: 1, height: 3, marginHorizontal: 3, borderRadius: 2, backgroundColor: 'rgba(28,29,31,0.1)' },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center' },
});
