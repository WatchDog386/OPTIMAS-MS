import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow, space } from '../theme';
import { Text } from './Text';

/** Titled white block with an optional "See all" link (Business-SME DashSection). */
export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ fontSize: 15 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySm" color={colors.textDim} style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10}>
            <Text variant="title" color={colors.primary} style={{ fontSize: 13.5 }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Row inside a Section: round tinted icon, title + subtitle, optional trailing element. */
export function SectionRow({
  icon,
  tint = colors.accent,
  tintBg = colors.accentSoft,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  tintBg?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.icon, { backgroundColor: tintBg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color={colors.textDim} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textDim} /> : null}
    </Pressable>
  );
}

/** Small soft pill, e.g. an amount owed. */
export function Pill({ label, tone = 'danger' }: { label: string; tone?: 'danger' | 'success' | 'warning' | 'neutral' }) {
  const t = { danger: [colors.dangerSoft, '#B91C1C'], success: [colors.successSoft, '#047857'], warning: [colors.warningSoft, '#B45309'], neutral: [colors.surfaceAlt, colors.textMuted] }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t[0] }]}>
      <Text variant="label" color={t[1]} style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginBottom: space.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: radius.md },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
