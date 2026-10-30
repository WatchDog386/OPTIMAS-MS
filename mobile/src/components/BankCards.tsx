import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';

import { Text } from './Text';

type Icon = keyof typeof Ionicons.glyphMap;

/** Gradient colour sets for the large feature cards (teal, graphite, green, navy). */
export const CARD_TONES = {
  teal: ['#22B3C4', '#0E6F80'],
  graphite: ['#5B5F66', '#1C1D20'],
  green: ['#57C21C', '#1F7A12'],
  navy: ['#2C4A9A', '#0E2266'],
} as const;
export type CardTone = keyof typeof CARD_TONES;

/**
 * Large gradient card with a title, a line of text and a layered icon "illustration" on the right
 * (the Save & Invest style). The whole card is the button.
 */
export function FeatureCard({ title, subtitle, icon, tone = 'teal', onPress, busy, footer }: { title: string; subtitle: string; icon: Icon; tone?: CardTone; onPress?: () => void; busy?: boolean; footer?: ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress || busy} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`} style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}>
      <LinearGradient colors={CARD_TONES[tone] as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.feature}>
        <View style={{ flex: 1, gap: 12, paddingRight: 8 }}>
          <Text variant="h2" color="#FFFFFF" fixedColor style={styles.featureTitle}>
            {title}
          </Text>
          <Text variant="bodySm" color="rgba(255,255,255,0.88)" fixedColor style={{ lineHeight: 20 }}>
            {subtitle}
          </Text>
          {footer}
        </View>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no">
          <View style={[styles.ring, { width: 112, height: 112, borderRadius: 56 }]} />
          <View style={[styles.ring, { width: 82, height: 82, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.16)' }]} />
          <View style={styles.artCore}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={icon} size={34} color="#FFFFFF" />}</View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export interface ActionCardItem {
  key: string;
  title: string;
  /** Short status line, e.g. "3 waiting" or "Not set up". */
  status: string;
  icon: Icon;
  /** Solid card colour. */
  color: string;
  /** The link at the bottom, e.g. "Review" (an arrow is added). */
  action: string;
  onPress: () => void;
  selected?: boolean;
  badge?: number;
}

/** Sideways-scrolling row of solid cards with an icon, title, status and a "Review ›" link (the E-Loans style). */
export function ActionCardRow({ items }: { items: ActionCardItem[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={{ marginHorizontal: -16 }}>
      {items.map((c) => (
        <Pressable
          key={c.key}
          onPress={c.onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: !!c.selected }}
          accessibilityLabel={`${c.title}. ${c.status}. ${c.action}`}
          style={({ pressed }) => [styles.action, { backgroundColor: c.color }, c.selected && styles.selected, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <View style={styles.actionTop}>
            <Ionicons name={c.icon} size={30} color="#FFFFFF" />
            {c.badge ? (
              <View style={styles.badge}>
                <Text variant="label" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
                  {c.badge > 99 ? '99+' : c.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="h2" color="#FFFFFF" fixedColor numberOfLines={1} style={{ fontSize: 19 }}>
            {c.title}
          </Text>
          <Text variant="bodySm" color="rgba(255,255,255,0.8)" fixedColor numberOfLines={1}>
            {c.status}
          </Text>
          <View style={styles.link}>
            <Text variant="bodySm" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, textDecorationLine: 'underline' }}>
              {c.action}
            </Text>
            <View style={styles.linkArrow}>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Centered heading between sections ("Below are your …" in the E-Loans style), with an accent word. */
export function SectionLead({ text, accent }: { text: string; accent?: string }) {
  return (
    <View style={styles.lead}>
      <View style={styles.leadLine} />
      <Text variant="bodySm" align="center" color={colors.textMuted}>
        {text}
        {accent ? (
          <Text variant="bodySm" color={colors.brand} style={{ fontFamily: fonts.semibold }}>
            {' '}
            {accent}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  feature: { minHeight: 176, borderRadius: 22, paddingVertical: 26, paddingLeft: 24, paddingRight: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  featureTitle: { fontFamily: fonts.bold, fontSize: 21 },
  art: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  artCore: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  row: { gap: 14, paddingHorizontal: 16, paddingVertical: 4 },
  action: { width: 228, borderRadius: 18, padding: 18, gap: 6, borderWidth: 3, borderColor: 'transparent' },
  selected: { borderColor: colors.highlight },
  actionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  linkArrow: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  lead: { gap: 14, alignItems: 'center', paddingTop: 4 },
  leadLine: { width: '80%', height: 2, borderRadius: 1, backgroundColor: colors.border },
});
