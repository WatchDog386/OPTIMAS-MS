import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../src/api/types';
import { ActionCardRow, Badge, HeaderButton, PageHeader, Reveal, Screen, SectionHeader, Text } from '../../src/components';
import { requestScan } from '../../src/store/bridge';
import { useApi } from '../../src/hooks/useApi';
import { colors, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';

const ACTIONS = [
  { icon: 'arrow-up-circle-outline', label: 'Issue', status: 'Give devices to a technician', action: 'Issue', href: '/admin/transfer?direction=issue', color: '#0D5C3E' },
  { icon: 'arrow-down-circle-outline', label: 'Return', status: 'Take devices back to store', action: 'Return', href: '/admin/transfer?direction=return', color: '#2E3A5C' },
  { icon: 'add-circle-outline', label: 'Receive', status: 'Add new stock', action: 'Receive', href: '/admin/receive', color: '#0D5C3E' },
  { icon: 'shield-checkmark-outline', label: 'Check device', status: 'Is this the one we issued?', action: 'Scan', href: '/verify', color: '#0D5C3E' },
  { icon: 'search-outline', label: 'Find unit', status: 'Trace a serial number', action: 'Search', href: '/admin/unit', color: '#2E3A5C' },
  { icon: 'list-outline', label: 'Ledger', status: 'Every stock movement', action: 'Open', href: '/admin/movements', color: '#0D5C3E' },
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
      <ActionCardRow items={ACTIONS.map((a) => ({ key: a.label, title: a.label, status: a.status, icon: a.icon, color: a.color, action: a.action, onPress: () => router.push(a.href) }))} />

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
  // Plain rows on the page (no card behind each item, no dividing lines)
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: 2 },
  itemIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
