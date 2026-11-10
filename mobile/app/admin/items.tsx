import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Item } from '../../src/api/types';
import { Button, EmptyState, Screen, ScreenHeader, Text } from '../../src/components';
import { SME } from '../../src/components/SmeKit';
import { useApi } from '../../src/hooks/useApi';
import { fonts, isDark, space } from '../../src/theme';
import { kes } from '../../src/utils/format';

/*
 * The catalogue, laid out like Knoxville-SME's Sale details page: a flat header (icon, title, count badge,
 * and the total on the right), the two actions as pills, then each section as plain rows (name, "quantity ×
 * price", value) with its totals underneath.
 */

const value = (i: Item) => (i.stock?.inStore ?? 0) * i.unitPrice;

export default function Items() {
  const { data, refresh, refreshing, loading } = useApi<{ items: Item[] }>('/inventory/items');
  const items = data?.items ?? [];
  const devices = items.filter((i) => i.tracking === 'SERIALIZED');
  const materials = items.filter((i) => i.tracking === 'BULK');
  const total = items.reduce((n, i) => n + value(i), 0);
  const low = items.filter((i) => i.lowStock).length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Catalogue" />

      {/* Header: flat, like the sale's */}
      <View style={{ gap: 12 }}>
        <View style={styles.head}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={styles.headIcon}>
              <Ionicons name="pricetags" size={20} color={isDark ? '#8FD14F' : '#2DA043'} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
                  Store catalogue
                </Text>
                <View style={[styles.badge, low ? styles.badgeWarn : styles.badgeOk]}>
                  <Text variant="label" color={low ? '#B45309' : '#047857'} fixedColor style={{ fontSize: 10, fontFamily: fonts.semibold }}>
                    {low ? `${low} low` : 'All stocked'}
                  </Text>
                </View>
              </View>
              <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
                {items.length} items · {devices.length} devices · {materials.length} materials
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 11, letterSpacing: 1, fontFamily: fonts.medium }}>
              VALUE
            </Text>
            <Text variant="h2" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 20 }}>
              {kes(total)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Add item" icon="add" onPress={() => router.push('/admin/item-new')} style={{ flex: 1 }} />
        <Button label="Receive stock" icon="download-outline" variant="secondary" onPress={() => router.push('/admin/receive')} style={{ flex: 1 }} />
      </View>

      {!loading && !items.length ? <EmptyState icon="pricetags-outline" title="No items yet" message="Add routers, ONTs, cable and accessories." /> : null}

      {devices.length ? <Section title="Routers & ONTs" items={devices} /> : null}
      {materials.length ? <Section title="Materials" items={materials} /> : null}

      {items.length ? (
        <View style={[styles.sumRow, styles.grand]}>
          <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 14 }}>
            Total in store
          </Text>
          <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
            {kes(total)}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** One section: plain rows ("in store × price", value), then its totals. */
function Section({ title, items }: { title: string; items: Item[] }) {
  const inStore = items.reduce((n, i) => n + (i.stock?.inStore ?? 0), 0);
  const withTechs = items.reduce((n, i) => n + (i.stock?.withTechnicians ?? 0), 0);
  return (
    <View style={{ gap: 4 }}>
      <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 13, paddingHorizontal: 4 }}>
        {title} — {items.length}
      </Text>
      {items.map((i) => (
        <Pressable key={i.id} onPress={() => router.push(`/admin/item/${i.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button" accessibilityLabel={i.name}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text variant="body" color={SME.fg} fixedColor numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14, flexShrink: 1 }}>
                {i.name}
              </Text>
              {i.lowStock ? (
                <View style={[styles.badge, styles.badgeWarn]}>
                  <Text variant="label" color="#B45309" fixedColor style={{ fontSize: 10, fontFamily: fonts.semibold }}>
                    Low
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
              {i.stock?.inStore ?? 0} {i.unit} × {kes(i.unitPrice)} · {i.sku}
            </Text>
          </View>
          <Text variant="body" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 14 }}>
            {kes(value(i))}
          </Text>
        </Pressable>
      ))}
      <View style={{ gap: 6, paddingHorizontal: 4, paddingTop: 8 }}>
        <View style={styles.sumRow}>
          <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
            In store
          </Text>
          <Text variant="label" color={SME.fg} fixedColor style={{ fontSize: 12, fontFamily: fonts.medium }}>
            {inStore}
          </Text>
        </View>
        <View style={styles.sumRow}>
          <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
            With technicians
          </Text>
          <Text variant="label" color={SME.fg} fixedColor style={{ fontSize: 12, fontFamily: fonts.medium }}>
            {withTechs}
          </Text>
        </View>
        <View style={styles.sumRow}>
          <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
            Value in store
          </Text>
          <Text variant="label" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontSize: 12, fontFamily: fonts.medium }}>
            {kes(items.reduce((n, i) => n + value(i), 0))}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingHorizontal: 4 },
  headIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(143,209,79,0.15)' : '#E3F4EA' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeOk: { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#D1FAE5' },
  badgeWarn: { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grand: { paddingHorizontal: 4, paddingTop: 10 },
});
