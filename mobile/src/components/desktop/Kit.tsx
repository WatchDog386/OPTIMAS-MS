import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../../theme';
import { Text } from '../Text';
import { desk } from './DesktopShell';

type Icon = keyof typeof Ionicons.glyphMap;

/** The four KPI colours of the Business-SME Command Center. */
export const KPI = {
  blue: { bg: '#1A73E8', foot: '#1563C9', fg: '#FFFFFF', faint: 'rgba(255,255,255,0.28)' },
  green: { bg: '#2DA043', foot: '#248A38', fg: '#FFFFFF', faint: 'rgba(255,255,255,0.28)' },
  amber: { bg: '#FBBC04', foot: '#E3A900', fg: '#1F1A0A', faint: 'rgba(31,26,10,0.22)' },
  red: { bg: '#DC3545', foot: '#C22B3A', fg: '#FFFFFF', faint: 'rgba(255,255,255,0.28)' },
} as const;

/** A coloured KPI card: big value, title, a sub-line, a faint icon, and a "More info" strip. */
export function KpiCard({ tone, value, title, sub, icon, onPress }: { tone: keyof typeof KPI; value: string | number; title: string; sub: string; icon: Icon; onPress: () => void }) {
  const c = KPI[tone];
  return (
    <Pressable onPress={onPress} style={(s) => [styles.kpi, { backgroundColor: c.bg }, (s as { hovered?: boolean }).hovered && { opacity: 0.94 }]} accessibilityRole="button" accessibilityLabel={`${title}: ${value}`}>
      <View style={styles.kpiBody}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="display" color={c.fg} fixedColor style={styles.kpiValue} numberOfLines={1}>
            {value}
          </Text>
          <Text variant="title" color={c.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 14.5 }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="label" color={c.fg} fixedColor style={{ opacity: 0.85 }} numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <Ionicons name={icon} size={46} color={c.faint} />
      </View>
      <View style={[styles.kpiFoot, { backgroundColor: c.foot }]}>
        <Text variant="bodySm" color={c.fg} fixedColor style={{ fontFamily: fonts.medium }}>
          More info
        </Text>
        <Ionicons name="link-outline" size={15} color={c.fg} />
      </View>
    </Pressable>
  );
}

/** A white, bordered panel with a title and a green "See all" link. */
export function Panel({ title, link, onLink, children, style }: { title: string; link?: string; onLink?: () => void; children: ReactNode; style?: object }) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.panelHead}>
        <Text variant="title" color={desk.ink} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15, flex: 1 }}>
          {title}
        </Text>
        {link ? (
          <Pressable onPress={onLink} accessibilityRole="link" hitSlop={6}>
            <Text variant="body" color={desk.green} fixedColor style={{ fontFamily: fonts.medium }}>
              {link}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A small stat square inside a panel (Active / Expiring / Expired in the Business-SME app). */
export function MiniStat({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <View style={styles.mini}>
      <Text variant="h1" color={color} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26 }}>
        {value}
      </Text>
      <Text variant="label" color={desk.muted} fixedColor>
        {label}
      </Text>
    </View>
  );
}

/** "Label ……… value" line inside a panel. */
export function PanelRow({ label, value, onPress }: { label: string; value: string | number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <Text variant="body" color={desk.muted} fixedColor style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="body" color={desk.ink} fixedColor style={{ fontFamily: fonts.medium }}>
        {value}
      </Text>
    </Pressable>
  );
}

/** The Business-SME buttons: outlined grey and filled green, with an icon. */
export function DeskButton({ label, icon, onPress, filled }: { label: string; icon: Icon; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable onPress={onPress} style={(s) => [styles.btn, filled ? styles.btnFilled : styles.btnOutline, (s as { hovered?: boolean }).hovered && { opacity: 0.9 }]} accessibilityRole="button">
      <Ionicons name={icon} size={17} color={filled ? '#FFFFFF' : desk.ink} />
      <Text variant="body" color={filled ? '#FFFFFF' : desk.ink} fixedColor style={{ fontFamily: fonts.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kpi: { flex: 1, minWidth: 210, borderRadius: 6, overflow: 'hidden' },
  kpiBody: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 10 },
  kpiValue: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  kpiFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 31 },
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: desk.border, borderRadius: 8, padding: 20, gap: 16 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mini: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 6, backgroundColor: '#F3F4F6' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1 },
  btnOutline: { backgroundColor: '#FFFFFF', borderColor: desk.border },
  btnFilled: { backgroundColor: desk.green, borderColor: desk.green },
});
