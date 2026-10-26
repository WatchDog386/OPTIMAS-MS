import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { PulseDot } from './Motion';
import { Text } from './Text';

type IconName = keyof typeof Ionicons.glyphMap;

/** Dark attention banner: something needs the person's action now. */
export function AttentionCard({ icon, title, body, action, onPress, tone = 'danger' }: { icon: IconName; title: string; body?: string; action: string; onPress: () => void; tone?: 'danger' | 'warning' }) {
  const dot = tone === 'danger' ? '#FF6B5E' : '#FFC24D';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.attention, pressed && { transform: [{ scale: 0.985 }] }]}>
      <View style={styles.attIcon}>
        <Ionicons name={icon} size={20} color={colors.white} />
        <View style={styles.attDot}>
          <PulseDot color={dot} size={7} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" color={colors.white} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
          {title}
        </Text>
        {body ? (
          <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor numberOfLines={2}>
            {body}
          </Text>
        ) : null}
      </View>
      <View style={styles.attCta}>
        <Text variant="label" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
          {action}
        </Text>
      </View>
    </Pressable>
  );
}

/** Round icon button with a caption underneath (Navigate · Call · Open). */
export function CircleAction({ icon, label, onPress, primary, disabled }: { icon: IconName; label: string; onPress?: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || !onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.ca, (disabled || !onPress) && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <View style={[styles.caCircle, primary && styles.caPrimary]}>
        <Ionicons name={icon} size={20} color={primary ? colors.white : colors.text} />
      </View>
      <Text variant="label" style={{ fontFamily: fonts.medium, fontSize: 11.5 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface TimelineItem {
  key: string;
  time: string;
  title: string;
  subtitle?: string;
  state: 'done' | 'active' | 'next' | 'todo';
  right?: ReactNode;
  onPress?: () => void;
}

const DOT: Record<TimelineItem['state'], string> = { done: colors.success, active: '#F59E0B', next: colors.text, todo: 'rgba(28,29,31,0.25)' };

/** Vertical day plan: time · dot on a rail · job. The active job pulses. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((it, i) => (
        <Pressable key={it.key} onPress={it.onPress} disabled={!it.onPress} style={({ pressed }) => [styles.tlRow, pressed && { opacity: 0.7 }]}>
          <Text variant="label" color={colors.textMuted} style={styles.tlTime}>
            {it.time}
          </Text>
          <View style={styles.tlRail}>
            <View style={[styles.tlLine, i === 0 && { top: 18 }, i === items.length - 1 && { bottom: undefined, height: 18 }]} />
            <View style={styles.tlDotWrap}>{it.state === 'active' ? <PulseDot color={DOT.active} size={10} /> : <View style={[styles.tlDot, { backgroundColor: DOT[it.state] }, it.state === 'next' && styles.tlDotNext]} />}</View>
          </View>
          <View style={styles.tlBody}>
            <Text variant="title" numberOfLines={1} style={{ fontSize: 14.5, fontFamily: fonts.semibold }}>
              {it.title}
            </Text>
            {it.subtitle ? (
              <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                {it.subtitle}
              </Text>
            ) : null}
          </View>
          {it.right}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  attention: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 12, borderRadius: 24, backgroundColor: colors.charcoal },
  attIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  attDot: { position: 'absolute', top: -6, right: -6 },
  attCta: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  ca: { alignItems: 'center', gap: 6, minWidth: 64 },
  caCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  caPrimary: { backgroundColor: colors.charcoal, borderColor: colors.charcoal },
  tlRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 10 },
  tlTime: { width: 44, textAlign: 'right', fontFamily: fonts.medium },
  tlRail: { width: 24, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  tlLine: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, backgroundColor: 'rgba(28,29,31,0.1)' },
  tlDotWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  tlDot: { width: 10, height: 10, borderRadius: 5 },
  tlDotNext: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: colors.highlight },
  tlBody: { flex: 1, gap: 2 },
});
