import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Item } from '../../src/api/types';
import { Text } from '../../src/components';
import { TAB_BAR_CLEARANCE } from '../../src/components/Screen';
import { SME, SmeAppBar, SmeChips, useScrolledBar } from '../../src/components/SmeKit';
import { useApi } from '../../src/hooks/useApi';
import { requestScan } from '../../src/store/bridge';
import { fonts, isDark } from '../../src/theme';
import { kes } from '../../src/utils/format';

/*
 * The Store, in the layout of Knoxville-SME's Products page: the green "stock on hand" card, category
 * chips, search with a sort button, three count tiles, the lime Add button, and each item as a
 * boarding-pass ticket whose tear-off strip holds its stock actions.
 */

const LIME = '#B8F28B';
/** Tiles: soft grey on white, charcoal on black (Knoxville-SME). */
const TILE = isDark ? '#1E1E1E' : '#F2F2F4';

type Scope = 'ALL' | 'DEVICES' | 'MATERIALS';
type StockFilter = '' | 'LOW' | 'OUT';
const STOCK_CYCLE: StockFilter[] = ['', 'LOW', 'OUT'];
const STOCK_LABEL: Record<StockFilter, string> = { '': 'All', LOW: 'Low', OUT: 'Out' };

const categoryIcon: Record<Item['category'], keyof typeof Ionicons.glyphMap> = {
  ROUTER: 'wifi',
  ONT: 'hardware-chip-outline',
  CABLE: 'git-commit-outline',
  CONNECTOR: 'link-outline',
  ACCESSORY: 'pricetag-outline',
  TOOL: 'hammer-outline',
};

const statusOf = (i: Item) =>
  (i.stock?.inStore ?? 0) <= 0
    ? { label: 'Out of stock', bg: '#FEE2E2', fg: '#B91C1C', key: 'OUT' as const }
    : i.lowStock
      ? { label: 'Low stock', bg: '#FEF3C7', fg: '#B45309', key: 'LOW' as const }
      : { label: 'In stock', bg: '#D1FAE5', fg: '#047857', key: 'IN' as const };

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K` : String(n));

export default function Store() {
  const { data, refresh, refreshing } = useApi<{ items: Item[] }>('/inventory/items');
  const bar = useScrolledBar();
  const [scope, setScope] = useState<Scope>('ALL');
  const [stock, setStock] = useState<StockFilter>('');
  const [q, setQ] = useState('');
  const [desc, setDesc] = useState(false);

  const all = data?.items ?? [];
  const devices = all.filter((i) => i.tracking === 'SERIALIZED');
  const materials = all.filter((i) => i.tracking === 'BULK');
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (scope === 'DEVICES' ? devices : scope === 'MATERIALS' ? materials : all)
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term))
      .filter((i) => !stock || statusOf(i).key === stock)
      .sort((a, b) => (desc ? b.unitPrice - a.unitPrice : 0));
  }, [all, devices, materials, scope, q, stock, desc]);

  const units = all.reduce((n, i) => n + (i.stock?.inStore ?? 0), 0);
  const out = all.filter((i) => statusOf(i).key === 'OUT').length;
  const low = all.filter((i) => statusOf(i).key === 'LOW').length;
  const status = out ? { label: `${out} out of stock`, tone: 'bad' as const } : low ? { label: `${low} low`, tone: 'warn' as const } : { label: 'All in stock', tone: 'ok' as const };

  const scan = async () => {
    const r = await requestScan({ title: 'Scan a device' });
    if (r?.[0]) router.push(`/admin/unit?serial=${encodeURIComponent(r[0])}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: SME.page }}>
      <SmeAppBar
        title="Store"
        scrolled={bar.scrolled}
        right={
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color={SME.fg2} />
          </Pressable>
        }
      />
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={32} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* The green card: stock on hand */}
        <StockHero
          headline={String(units)}
          sub={units === 1 ? 'unit in store' : 'units in store'}
          footer={`${devices.length} devices · ${materials.length} materials`}
          status={status}
          actions={[
            { label: 'Receive', icon: 'download-outline', onPress: () => router.push('/admin/receive') },
            { label: 'Issue', icon: 'arrow-up-circle-outline', onPress: () => router.push('/admin/transfer?direction=issue') },
          ]}
        />

        <SmeChips
          items={[
            { id: 'ALL', label: 'All' },
            { id: 'DEVICES', label: 'Routers & ONTs' },
            { id: 'MATERIALS', label: 'Materials' },
          ]}
          value={scope}
          onChange={(v) => setScope(v as Scope)}
        />

        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={SME.fg4} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search items by name or SKU…" placeholderTextColor={SME.fg4} style={styles.searchInput} autoCorrect={false} />
          </View>
          <Pressable onPress={() => setDesc((d) => !d)} style={styles.round} accessibilityLabel={desc ? 'Sort by price, low to high' : 'Sort by price, high to low'}>
            <Ionicons name="swap-vertical" size={18} color={SME.fg} />
          </Pressable>
          <Pressable onPress={scan} style={styles.round} accessibilityLabel="Scan a device">
            <Ionicons name="scan-outline" size={18} color={SME.fg} />
          </Pressable>
        </View>

        {/* Three equal tiles: the stock filter and the counts */}
        <View style={styles.tiles}>
          <Pressable onPress={() => setStock((s) => STOCK_CYCLE[(STOCK_CYCLE.indexOf(s) + 1) % STOCK_CYCLE.length])} style={styles.tile} accessibilityLabel={`Stock filter: ${STOCK_LABEL[stock]}`}>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 11 }}>
              Stock ▾
            </Text>
            <Text variant="body" color={SME.fg} fixedColor style={{ fontSize: 14, marginTop: 2 }}>
              {STOCK_LABEL[stock]}
            </Text>
          </Pressable>
          <View style={styles.tile}>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 11 }}>
              Devices
            </Text>
            <Text variant="body" color={SME.fg} fixedColor style={{ fontSize: 14, marginTop: 2 }}>
              {devices.length}
            </Text>
          </View>
          <View style={styles.tile}>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 11 }}>
              Materials
            </Text>
            <Text variant="body" color={SME.fg} fixedColor style={{ fontSize: 14, marginTop: 2 }}>
              {materials.length}
            </Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/admin/item-new')} style={({ pressed }) => [styles.add, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <Text variant="title" color="#000000" fixedColor style={{ fontFamily: fonts.medium, fontSize: 16 }}>
            Add
          </Text>
        </Pressable>

        {/* The store's other tools */}
        <View style={styles.tools}>
          {(
            [
              ['Return', 'arrow-down-circle-outline', '/admin/transfer?direction=return'],
              ['Check', 'shield-checkmark-outline', '/verify'],
              ['Trace', 'search-outline', '/admin/unit'],
              ['Ledger', 'list-outline', '/admin/movements'],
              ['Catalogue', 'pricetags-outline', '/admin/items'],
            ] as const
          ).map(([label, icon, href]) => (
            <Pressable key={label} onPress={() => router.push(href)} style={styles.tool} accessibilityRole="button">
              <View style={styles.toolIcon}>
                <Ionicons name={icon} size={18} color={SME.fg} />
              </View>
              <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 11 }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text variant="title" color={SME.fg} fixedColor style={{ fontSize: 17, fontFamily: fonts.regular }}>
          {scope === 'DEVICES' ? 'Routers & ONTs' : scope === 'MATERIALS' ? 'Materials' : 'Items'}
        </Text>
        {data && !shown.length ? (
          <View style={[styles.tile, { height: undefined, paddingVertical: 36, borderRadius: 28 }]}>
            <Text variant="bodySm" color={SME.fg4} fixedColor style={{ textAlign: 'center' }}>
              {q || stock ? 'No items match.' : 'No items yet. Tap “Add” to add one.'}
            </Text>
          </View>
        ) : null}
        {shown.map((i) => (
          <Pass key={i.id} item={i} />
        ))}
      </ScrollView>
    </View>
  );
}

/* ---------------- The green card ---------------- */

function StockHero({
  headline,
  sub,
  footer,
  status,
  actions,
}: {
  headline: string;
  sub: string;
  footer: string;
  status: { label: string; tone: 'ok' | 'warn' | 'bad' };
  actions: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }[];
}) {
  const tone = { ok: ['rgba(52,211,153,0.2)', '#A7F3D0'], warn: ['rgba(251,191,36,0.2)', '#FDE68A'], bad: ['rgba(248,113,113,0.2)', '#FECACA'] }[status.tone];
  return (
    <LinearGradient colors={['#12463A', '#0D5B3F', '#072A21']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      {/* Faint arcs on the right, like the client dashboard card */}
      <Svg style={styles.arcs} viewBox="0 0 200 200" pointerEvents="none">
        {[26, 44, 62, 80, 98].map((r) => (
          <Circle key={r} cx={200} cy={70} r={r} fill="none" stroke="#FFFFFF" strokeWidth={0.7} />
        ))}
      </Svg>
      <Text variant="bodySm" color="rgba(255,255,255,0.8)" fixedColor style={{ fontSize: 13 }}>
        Stock on hand
      </Text>
      <Text variant="label" color="rgba(255,255,255,0.9)" fixedColor style={{ fontFamily: fonts.semibold, letterSpacing: 0.6, marginTop: 4 }}>
        OPTIMAS STORE
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
        <Text variant="h2" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 22 }}>
          {headline}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.85)" fixedColor style={{ fontFamily: fonts.medium, fontSize: 15 }}>
          {sub}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={({ pressed }) => [styles.heroPill, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button">
            <Ionicons name={a.icon} size={16} color="#FFFFFF" />
            <Text variant="bodySm" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor style={{ fontSize: 12 }}>
          {footer}
        </Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: tone[0] }}>
          <Text variant="label" color={tone[1]} fixedColor style={{ fontSize: 11, fontFamily: fonts.semibold }}>
            {status.label}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ---------------- An item as a boarding pass ---------------- */

/** Height of the tear-off strip at the bottom of the pass. */
const STUB = 86;

/** Card outline with half-circle notches on both sides where the strip tears off (Knoxville-SME). */
function ticketPath(w: number, h: number) {
  const R = 28;
  const sr = 15;
  const sy = h - STUB;
  return [
    `M ${R} 0`,
    `H ${w - R}`,
    `A ${R} ${R} 0 0 1 ${w} ${R}`,
    `V ${sy - sr}`,
    `A ${sr} ${sr} 0 0 0 ${w} ${sy + sr}`,
    `V ${h - R}`,
    `A ${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H ${R}`,
    `A ${R} ${R} 0 0 1 0 ${h - R}`,
    `V ${sy + sr}`,
    `A ${sr} ${sr} 0 0 0 0 ${sy - sr}`,
    `V ${R}`,
    `A ${R} ${R} 0 0 1 ${R} 0`,
    'Z',
  ].join(' ');
}

function Pass({ item }: { item: Item }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const st = statusOf(item);
  const inStore = item.stock?.inStore ?? 0;
  const withTechs = item.stock?.withTechnicians ?? 0;
  const actions: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }[] = [
    { label: 'Receive', icon: 'add', onPress: () => router.push(`/admin/receive?itemId=${item.id}`) },
    { label: 'Issue', icon: 'arrow-up', onPress: () => router.push('/admin/transfer?direction=issue') },
    { label: 'Return', icon: 'arrow-down', onPress: () => router.push('/admin/transfer?direction=return') },
    item.tracking === 'SERIALIZED'
      ? { label: 'Labels', icon: 'qr-code-outline', onPress: () => router.push(`/admin/labels?itemId=${item.id}`) }
      : { label: 'Adjust', icon: 'options-outline', onPress: () => router.push(`/admin/item/${item.id}`) },
    { label: 'Details', icon: 'document-text-outline', onPress: () => router.push(`/admin/item/${item.id}`) },
  ];
  return (
    <View onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 ? (
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${size.w} ${size.h}`} pointerEvents="none">
          <Path d={ticketPath(size.w, size.h)} fill={isDark ? '#FFFFFF' : '#F2F2F4'} />
        </Svg>
      ) : null}
      <Pressable onPress={() => router.push(`/admin/item/${item.id}`)} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }} accessibilityRole="button" accessibilityLabel={item.name}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Ionicons name={categoryIcon[item.category]} size={16} color="#000000" />
            <Text variant="label" color="#000000" fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
              {item.sku}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: st.bg }}>
            <Text variant="label" color={st.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 10 }}>
              {st.label}
            </Text>
          </View>
        </View>
        <Text variant="title" color="#000000" fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, marginTop: 12 }}>
          {item.name}
        </Text>
        {/* In store → with technicians, like cost → selling price on the product pass */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
          <View>
            <Text variant="h2" color="#000000" fixedColor style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 24 }}>
              {short(inStore)}
            </Text>
            <Text variant="label" color="#737373" fixedColor style={{ fontSize: 10, marginTop: 4 }}>
              In store ({item.unit})
            </Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 }}>
            <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.7)' }} />
            <Ionicons name="chevron-forward" size={14} color="#000000" style={{ marginLeft: -4 }} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="h2" color="#000000" fixedColor style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 24 }}>
              {short(withTechs)}
            </Text>
            <Text variant="label" color="#737373" fixedColor style={{ fontSize: 10, marginTop: 4 }}>
              With technicians
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 16 }}>
          {[
            ['Unit price', kes(item.unitPrice)],
            ['Reorder at', String(item.reorderLevel)],
            ['Value in store', kes(inStore * item.unitPrice)],
          ].map(([label, value], k) => (
            <View key={label} style={{ flex: 1, alignItems: k === 0 ? 'flex-start' : k === 1 ? 'center' : 'flex-end' }}>
              <Text variant="label" color="#737373" fixedColor style={{ fontSize: 10 }}>
                {label}
              </Text>
              <Text variant="body" color="#000000" fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="label" color="#737373" fixedColor style={{ fontSize: 10, marginTop: 8 }}>
          {item.tracking === 'SERIALIZED' ? 'Tracked by serial number' : `Counted in ${item.unit}`}
        </Text>
      </Pressable>
      {/* Perforation, then the tear-off strip with the stock actions */}
      <View style={{ marginHorizontal: 20, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#D4D4D4' }} />
      <View style={{ height: STUB, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} style={{ width: 56, alignItems: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel={`${a.label} ${item.name}`}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#F5F5F5' : '#FFFFFF' }}>
              <Ionicons name={a.icon} size={16} color="#000000" />
            </View>
            <Text variant="label" color="#525252" fixedColor style={{ fontSize: 10, fontFamily: fonts.medium }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_CLEARANCE, gap: 20 },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: SME.surface },
  hero: { borderRadius: 8, padding: 20, overflow: 'hidden' },
  arcs: { position: 'absolute', right: -40, top: 0, width: '50%', height: '100%', opacity: 0.25 },
  heroPill: { flex: 1, height: 44, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: TILE },
  searchInput: { flex: 1, color: SME.fg, fontFamily: fonts.regular, fontSize: 14, height: 44, outlineStyle: 'none' } as never,
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: SME.surface3 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: TILE },
  add: { height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: LIME },
  tools: { flexDirection: 'row', justifyContent: 'space-between' },
  tool: { alignItems: 'center', gap: 4, width: 60 },
  toolIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: TILE },
});
