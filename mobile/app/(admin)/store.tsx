import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../src/api/types';
import { Badge, HeaderButton, PageHeader, Reveal, Screen, SectionHeader, Text } from '../../src/components';
import { requestScan } from '../../src/store/bridge';
import { useApi } from '../../src/hooks/useApi';
import { colors, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';

const ACTIONS = [
  { icon: 'arrow-up-circle', label: 'Issue', href: '/admin/transfer?direction=issue', tint: colors.primary },
  { icon: 'arrow-down-circle', label: 'Return', href: '/admin/transfer?direction=return', tint: colors.accent },
  { icon: 'add-circle', label: 'Receive', href: '/admin/receive', tint: colors.info },
  { icon: 'search', label: 'Find unit', href: '/admin/unit', tint: colors.warning },
  { icon: 'list', label: 'Ledger', href: '/admin/movements', tint: colors.text },
] as const;

const categoryIcon: Record<Item['category'], keyof typeof Ionicons.glyphMap> = {
  ROUTER: 'wifi',
  ONT: 'hardware-chip-outline',
  CABLE: 'git-commit-outline',
  CONNECTOR: 'link-outline',
  ACCESSORY: 'pricetag-outline',
  TOOL: 'hammer-outline',
};

const categoryLabel: Record<Item['category'], string> = {
  ROUTER: 'Router',
  ONT: 'ONT',
  CABLE: 'Cable',
  CONNECTOR: 'Connector',
  ACCESSORY: 'Accessory',
  TOOL: 'Tool',
};

export default function Store() {
  const { data, refresh, refreshing } = useApi<{ items: Item[] }>('/inventory/items');
  const scan = async () => {
    const r = await requestScan({ title: 'Scan a device' });
    if (r?.[0]) router.push(`/admin/unit?serial=${encodeURIComponent(r[0])}`);
  };
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Store" right={<HeaderButton icon="scan-outline" label="Scan a device" onPress={scan} />} />
      <View style={styles.actions}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => router.push(a.href)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.94 }], opacity: 0.8 }]}
          >
            <View style={styles.circle}>
              <Ionicons name={a.icon} size={24} color={a.tint} />
            </View>
            <Text variant="label">{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader title="Inventory" action="Catalogue" onAction={() => router.push('/admin/items')} />
      <View>
        {data?.items.map((item, idx) => (
          <Reveal key={item.id} index={Math.min(idx, 8)}>
            <Pressable style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]} onPress={() => router.push(`/admin/item/${item.id}`)}>
              <View style={styles.itemIcon}>
                <Ionicons name={categoryIcon[item.category]} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  {item.sku} · {categoryLabel[item.category]} · {kes(item.unitPrice)}
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 4 }}>
                  <Badge label={`${item.stock?.withTechnicians ?? 0} ${item.unit} with techs`} tone="info" dot={false} />
                  {item.lowStock ? <Badge label="Low stock" tone="danger" /> : null}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="h2" color={item.lowStock ? colors.danger : colors.text}>
                  {item.stock?.inStore ?? 0}
                </Text>
                <Text variant="label" color={colors.textMuted}>
                  in store
                </Text>
              </View>
            </Pressable>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  circle: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' },
  // Plain rows on the page, split by a hairline (no card behind each item)
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
