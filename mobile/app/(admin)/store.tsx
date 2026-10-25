import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../src/api/types';
import { Badge, Card, Screen, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';

const ACTIONS = [
  { icon: 'arrow-up-circle', label: 'Issue', href: '/admin/transfer?direction=issue', tint: colors.primary },
  { icon: 'arrow-down-circle', label: 'Return', href: '/admin/transfer?direction=return', tint: colors.accent },
  { icon: 'add-circle', label: 'Receive', href: '/admin/receive', tint: colors.info },
  { icon: 'search', label: 'Find unit', href: '/admin/unit', tint: colors.warning },
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
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="h1">Store</Text>
      <View style={styles.actions}>
        {ACTIONS.map((a) => (
          <View key={a.label} style={{ flex: 1 }}>
            <Card onPress={() => router.push(a.href)} style={styles.action}>
              <Ionicons name={a.icon} size={28} color={a.tint} />
              <Text variant="label">{a.label}</Text>
            </Card>
          </View>
        ))}
      </View>

      <SectionHeader title="Inventory" action="Ledger" onAction={() => router.push('/admin/movements')} />
      {data?.items.map((item) => (
        <Card key={item.id} style={styles.item}>
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
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  action: { alignItems: 'center', gap: 6, paddingVertical: space.lg, paddingHorizontal: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
