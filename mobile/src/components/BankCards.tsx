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
        <View style={{ flex: 1, gap: 7, paddingRight: 8 }}>
          <Text variant="title" color="#FFFFFF" fixedColor style={styles.featureTitle}>
            {title}
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.88)" fixedColor style={{ fontSize: 12.5, lineHeight: 17 }}>
            {subtitle}
          </Text>
          {footer}
        </View>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no">
          <View style={[styles.ring, { width: 84, height: 84, borderRadius: 42 }]} />
          <View style={[styles.ring, { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.16)' }]} />
          <View style={styles.artCore}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name={icon} size={24} color="#FFFFFF" />}</View>
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
            <Ionicons name={c.icon} size={24} color="#FFFFFF" />
            {c.badge ? (
              <View style={styles.badge}>
                <Text variant="label" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold }}>
                  {c.badge > 99 ? '99+' : c.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="h2" color="#FFFFFF" fixedColor numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
            {c.title}
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.8)" fixedColor numberOfLines={1} style={{ fontSize: 12 }}>
            {c.status}
          </Text>
          <View style={styles.link}>
            <Text variant="label" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13, textDecorationLine: 'underline' }}>
              {c.action}
            </Text>
            <View style={styles.linkArrow}>
              <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export interface TileItem {
  key: string;
  title: string;
  /** Short line under the title, e.g. "3 waiting". */
  status?: string;
  icon: Icon;
  onPress: () => void;
  selected?: boolean;
  badge?: number;
}

/**
 * Grid of plain tiles (the Safaricom "Quick Care" style): the icon sits straight in the tile's padding at
 * the top left, the title at the bottom. `columns` per row (2 or 3).
 */
export function TileGrid({ items, columns = 3 }: { items: TileItem[]; columns?: 2 | 3 }) {
  const width = columns === 3 ? '31.5%' : '48.5%';
  return (
    <View style={styles.tiles}>
      {items.map((t) => (
        <Pressable
          key={t.key}
          onPress={t.onPress}
          accessibilityRole="button"
          accessibilityState={{ selected: !!t.selected }}
          accessibilityLabel={`${t.title}${t.status ? `. ${t.status}` : ''}`}
          style={({ pressed }) => [styles.tile, { width }, t.selected && styles.tileOn, pressed && { transform: [{ scale: 0.97 }] }]}
        >
          <View style={styles.tileTop}>
            <Ionicons name={t.icon} size={26} color={colors.brand} />
            {t.badge ? (
              <View style={styles.tileBadge}>
                <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                  {t.badge > 99 ? '99+' : t.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 2 }}>
            <Text variant="bodySm" numberOfLines={2} style={{ fontFamily: fonts.semibold }}>
              {t.title}
            </Text>
            {t.status ? (
              <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                {t.status}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
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
  feature: { minHeight: 128, borderRadius: 18, paddingVertical: 18, paddingLeft: 18, paddingRight: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  featureTitle: { fontFamily: fonts.bold, fontSize: 16.5 },
  art: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  artCore: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  row: { gap: 14, paddingHorizontal: 16, paddingVertical: 4 },
  // Compact, like a banking app's loan cards
  action: { width: 172, borderRadius: 14, padding: 14, gap: 3, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: colors.highlight },
  actionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 6, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  linkArrow: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { minHeight: 118, borderRadius: 14, padding: 14, justifyContent: 'space-between', backgroundColor: colors.glassStrong, borderWidth: 1.5, borderColor: colors.glassBorder },
  tileOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  lead: { gap: 14, alignItems: 'center', paddingTop: 4 },
  leadLine: { width: '80%', height: 2, borderRadius: 1, backgroundColor: colors.border },
});
