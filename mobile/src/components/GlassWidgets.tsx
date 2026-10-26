import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Glass, GlassCircle, Hatch } from './Glass';
import { Text } from './Text';

/** Yellow pill progress bar on a hatched track, with the percentage inside (reference "Wallet 74%"). */
export function HatchedProgress({ value, label, height = 56 }: { value: number; label?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, overflow: 'hidden' }}>
      <Hatch radius={height / 2} />
      {pct > 0 ? (
        <View style={[styles.fill, { width: `${Math.max(pct * 100, (height / 3.2))}%`, borderRadius: height / 2 }]}>
          <Text variant="title" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            {label ?? `${Math.round(pct * 100)}%`}
          </Text>
        </View>
      ) : (
        <View style={styles.zero}>
          <Text variant="title" color={colors.textMuted} style={{ fontSize: 15 }}>
            {label ?? '0%'}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Row of tall hatched pills with the active one in yellow and a value callout (reference "Payment Yearly"). */
export function PillChart({ data, activeIndex, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; activeIndex: number; format?: (n: number) => string }) {
  const [selected, setSelected] = useState(activeIndex);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.chart}>
      {data.map((d, i) => {
        const active = i === selected;
        const h = 52 + (d.value / max) * 78;
        return (
          <Pressable key={d.label} style={styles.col} onPress={() => setSelected(i)} accessibilityLabel={`${d.label}: ${format(d.value)}`}>
            {active ? (
              <View style={styles.callout}>
                <Text variant="label" style={{ fontFamily: fonts.semibold }}>
                  {format(d.value)}
                </Text>
                <View style={styles.calloutLine} />
              </View>
            ) : (
              <View style={{ height: 30 }} />
            )}
            <View style={[styles.pill, { height: h }, active && { backgroundColor: colors.highlight }]}>
              {!active ? <Hatch radius={28} /> : null}
              <Text variant="label" color={active ? colors.onHighlight : colors.textMuted} fixedColor style={styles.pillLabel}>
                {d.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Frosted stat card: big two-line title, figure top-right, yellow hatched progress, footer value and round actions. */
export function GlassStatCard({
  title,
  value,
  progress,
  progressLabel,
  caption,
  footer,
  icon = 'arrow-forward',
  onAction,
  secondaryIcon,
  onSecondary,
  onPress,
}: {
  title: string;
  value?: string | number;
  progress?: number;
  progressLabel?: string;
  caption?: string;
  footer?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  secondaryIcon?: keyof typeof Ionicons.glyphMap;
  onSecondary?: () => void;
  onPress?: () => void;
}) {
  return (
    <Glass strong onPress={onPress} style={{ gap: 16 }}>
      <View style={styles.top}>
        <Text variant="h1" style={styles.title}>
          {title}
        </Text>
        {value !== undefined ? (
          <Text variant="h1" style={{ fontFamily: fonts.semibold, fontSize: 24 }}>
            {value}
          </Text>
        ) : null}
      </View>
      {progress !== undefined ? <HatchedProgress value={progress} label={progressLabel} /> : null}
      {caption || footer || onAction ? (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            {caption ? (
              <Text variant="label" color={colors.textMuted}>
                {caption}
              </Text>
            ) : null}
            {footer ? (
              <Text variant="h1" numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 24, letterSpacing: -0.3 }}>
                {footer}
              </Text>
            ) : null}
          </View>
          {secondaryIcon ? (
            <GlassCircle onPress={onSecondary} size={44}>
              <Ionicons name={secondaryIcon} size={19} color={colors.text} />
            </GlassCircle>
          ) : null}
          {onAction ? (
            <GlassCircle onPress={onAction} size={44} highlight>
              <Ionicons name={icon} size={19} color={colors.onHighlight} />
            </GlassCircle>
          ) : null}
        </View>
      ) : null}
    </Glass>
  );
}

/** Big two-line name, yellow-check role chip and a key figure, with a portrait on the right (reference profile header). */
export function ProfileHero({
  name,
  role,
  stat,
  statLabel,
  portrait,
}: {
  name: string;
  role: string;
  stat: string | number;
  statLabel: string;
  portrait: React.ReactNode;
}) {
  const [first, ...rest] = name.split(' ');
  return (
    <View style={styles.hero}>
      <View style={{ flex: 1, gap: 14, paddingTop: 6 }}>
        <Text variant="display" style={styles.name}>
          {first}
          {rest.length ? `\n${rest.join(' ')}` : ''}
        </Text>
        <View style={styles.role}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={12} color={colors.onHighlight} />
          </View>
          <Text variant="title" style={{ fontFamily: fonts.medium }}>
            {role}
          </Text>
        </View>
        <View>
          <Text variant="h1" style={{ fontFamily: fonts.medium }}>
            {stat}
          </Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {statLabel}
          </Text>
        </View>
      </View>
      <View style={styles.portrait}>{portrait}</View>
    </View>
  );
}

/** Pressable text link used in glass card headers. */
export function GlassLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text variant="title" style={{ fontFamily: fonts.semibold, textDecorationLine: 'underline' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.highlight, justifyContent: 'center', paddingHorizontal: 20 },
  zero: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  callout: { alignItems: 'center', height: 30 },
  calloutLine: { width: 1, flex: 1, backgroundColor: colors.text, marginTop: 2 },
  pill: { width: '100%', borderRadius: 28, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 14 },
  pillLabel: { fontFamily: fonts.medium, fontSize: 13 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontFamily: fonts.medium, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  hero: { flexDirection: 'row', gap: 12, minHeight: 200 },
  name: { fontFamily: fonts.medium, fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  portrait: { width: 150, alignItems: 'center', justifyContent: 'flex-end' },
});

/**
 * Portrait for the profile hero, unmasked like a cut-out: today's check-in selfie if there is one,
 * otherwise a large free-standing user icon.
 */
export function Portrait({ photo }: { name?: string; photo?: React.ReactNode }) {
  if (photo) return <View style={portrait.photo}>{photo}</View>;
  return (
    <View style={portrait.wrap}>
      <Ionicons name="person" size={168} color={colors.charcoal} style={portrait.icon} />
    </View>
  );
}

/** Count items per day for the last `days` days (oldest first), labelled Mon/Tue… */
export function lastDays<T>(items: T[], at: (t: T) => string | null | undefined, days = 5) {
  const out: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const value = items.filter((t) => {
      const v = at(t);
      if (!v) return false;
      const time = new Date(v).getTime();
      return time >= d.getTime() && time < next.getTime();
    }).length;
    out.push({ label: d.toLocaleDateString('en-KE', { weekday: 'short' }), value });
  }
  return out;
}

const portrait = StyleSheet.create({
  photo: { width: 150, height: 200, overflow: 'hidden' },
  wrap: { width: 160, height: 200, alignItems: 'center', justifyContent: 'flex-end' },
  icon: { marginBottom: -12, textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 10 } },
});
