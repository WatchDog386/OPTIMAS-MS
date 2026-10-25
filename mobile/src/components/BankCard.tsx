import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { cardThemes, colors, fonts, type CardTheme } from '../theme';
import { Text } from './Text';

/**
 * Bank-card style hero card (ported from the Optimas Business-SME dashboard):
 * gradient body with ribbon loops and a diagonal sheen, a silver EMV chip and
 * contactless mark, a big figure, a masked number line, and an action pill
 * cut into the top-right corner.
 */
const R = 26; // card corner radius
const NOTCH_R = 16;
const NOTCH_GAP = 8;

function cardPath(w: number, h: number, nw: number, nh: number) {
  if (nw <= 0) {
    return `M ${R} 0 H ${w - R} A ${R} ${R} 0 0 1 ${w} ${R} V ${h - R} A ${R} ${R} 0 0 1 ${w - R} ${h} H ${R} A ${R} ${R} 0 0 1 0 ${h - R} V ${R} A ${R} ${R} 0 0 1 ${R} 0 Z`;
  }
  const r = NOTCH_R;
  return [
    `M ${R} 0`,
    `H ${w - nw - r}`,
    `A ${r} ${r} 0 0 1 ${w - nw} ${r}`,
    `V ${nh - r}`,
    `A ${r} ${r} 0 0 0 ${w - nw + r} ${nh}`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${nh + r}`,
    `V ${h - R}`,
    `A ${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H ${R}`,
    `A ${R} ${R} 0 0 1 0 ${h - R}`,
    `V ${R}`,
    `A ${R} ${R} 0 0 1 ${R} 0`,
    'Z',
  ].join(' ');
}

interface Props {
  label: string;
  value: ReactNode;
  note?: string;
  /** Last digits shown on the masked number line. */
  masked?: string | number;
  footerLeft?: string;
  footerRight?: string;
  icon: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
  theme?: CardTheme;
  onPress?: () => void;
}

export function BankCard({ label, value, note, masked, footerLeft, footerRight, icon, action, theme = cardThemes.teal, onPress }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pill, setPill] = useState({ w: 0, h: 0 });
  const nw = action && pill.w ? pill.w + NOTCH_GAP : 0;
  const nh = action && pill.h ? pill.h + NOTCH_GAP : 0;
  const { w, h } = size;

  const chipX = w * 0.6;
  const chipY = h * 0.36;
  const cw = 42;
  const ch = 32;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      {w > 0 ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id="body" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.colors[0]} />
              <Stop offset="0.55" stopColor={theme.colors[1]} />
              <Stop offset="1" stopColor={theme.colors[2]} />
            </SvgGradient>
            <SvgGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0} />
              <Stop offset="0.48" stopColor="#fff" stopOpacity={0.1} />
              <Stop offset="0.52" stopColor="#fff" stopOpacity={0.16} />
              <Stop offset="0.58" stopColor="#fff" stopOpacity={0} />
            </SvgGradient>
            <SvgGradient id="chip" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#F4F6F9" />
              <Stop offset="0.45" stopColor="#BFC6D1" />
              <Stop offset="1" stopColor="#8A93A1" />
            </SvgGradient>
          </Defs>
          <Path d={cardPath(w, h, nw, nh)} fill="url(#body)" />
          {/* Ribbon loops, clipped visually by staying inside the card body */}
          <G opacity={1}>
            <Path
              d={`M ${w * 1.1} ${h * 0.06} H ${w * 0.8} A ${h * 0.2} ${h * 0.2} 0 0 0 ${w * 0.8} ${h * 0.46} H ${w * 0.86} A ${h * 0.2} ${h * 0.2} 0 0 1 ${w * 0.86} ${h * 0.86} H ${w * 0.62}`}
              fill="none"
              stroke={theme.glow}
              strokeOpacity={0.22}
              strokeWidth={h * 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={w * 0.93} cy={h * 1.02} r={h * 0.34} fill={theme.glow} fillOpacity={0.16} />
            <Circle cx={w * 0.72} cy={h * -0.12} r={h * 0.24} fill={theme.glow} fillOpacity={0.1} />
          </G>
          <Rect x={0} y={0} width={w} height={h} rx={R} fill="url(#sheen)" opacity={0.5} />
          {/* EMV chip */}
          <Rect x={chipX} y={chipY} width={cw} height={ch} rx={6} fill="url(#chip)" />
          <G stroke="#5B6370" strokeOpacity={0.55} strokeWidth={1} fill="none">
            <Path d={`M ${chipX} ${chipY + ch / 3} H ${chipX + cw * 0.36} M ${chipX} ${chipY + (2 * ch) / 3} H ${chipX + cw * 0.36}`} />
            <Path d={`M ${chipX + cw} ${chipY + ch / 3} H ${chipX + cw * 0.64} M ${chipX + cw} ${chipY + (2 * ch) / 3} H ${chipX + cw * 0.64}`} />
            <Rect x={chipX + cw * 0.36} y={chipY + ch * 0.22} width={cw * 0.28} height={ch * 0.56} rx={3} />
          </G>
          {/* Contactless mark */}
          <G fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={2} strokeLinecap="round">
            {[0, 1, 2, 3].map((i) => (
              <Path key={i} d={`M ${chipX + cw + 16 + i * 6} ${chipY + 6 - i * 2} q ${5 + i * 1.5} ${ch / 2 - 6 + i * 2} 0 ${ch - 12 + i * 4}`} />
            ))}
          </G>
        </Svg>
      ) : null}

      <View style={styles.body}>
        <View>
          <Text variant="label" color={colors.white} fixedColor style={{ opacity: 0.65 }}>
            {label}
          </Text>
          <View style={styles.valueRow}>
            <Text variant="display" color={colors.white} fixedColor style={styles.value}>
              {value}
            </Text>
            {note ? (
              <Text variant="title" color={colors.white} fixedColor style={{ opacity: 0.65, marginLeft: 8, marginBottom: 3 }}>
                {note}
              </Text>
            ) : null}
          </View>
        </View>
        <Text variant="title" color={colors.white} fixedColor style={styles.masked}>
          ••••  ••••  ••••  {String(masked ?? '0000').padStart(4, '0').slice(-4)}
        </Text>
        <View style={styles.footer}>
          <Text variant="label" color={colors.white} fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, flex: 1 }}>
            {footerLeft}
          </Text>
          {footerRight ? (
            <Text variant="label" color={colors.white} fixedColor style={{ opacity: 0.65 }}>
              {footerRight}
            </Text>
          ) : null}
        </View>
      </View>

      <Ionicons name={icon} size={34} color={colors.white} style={styles.icon} />

      {action ? (
        <Pressable
          onPress={action.onPress}
          onLayout={(e) => setPill({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <View style={[styles.pillDot, { backgroundColor: theme.pillInk }]}>
            <Ionicons name="add" size={15} color={colors.white} />
          </View>
          <Text variant="label" color={theme.pillInk} fixedColor style={{ fontFamily: fonts.semibold }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 200, borderRadius: R },
  body: { minHeight: 200, padding: 20, paddingRight: 80, justifyContent: 'space-between' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 2 },
  value: { fontFamily: fonts.semibold, fontSize: 32, lineHeight: 36 },
  masked: { opacity: 0.5, letterSpacing: 3, marginTop: 20 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  icon: { position: 'absolute', right: 20, bottom: 20, opacity: 0.95 },
  pill: { position: 'absolute', top: 0, right: 0, height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 18, backgroundColor: colors.white },
  pillDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
