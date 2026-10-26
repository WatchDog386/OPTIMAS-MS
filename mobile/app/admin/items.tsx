import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../../src/api/types';
import { Badge, EmptyState, ListRow, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { kes } from '../../src/utils/format';

/** Stock catalogue: every item the store tracks, with stock levels. */
export default function Items() {
  const { data, refresh, refreshing, loading } = useApi<{ items: Item[] }>('/inventory/items');
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <ScreenHeader title="Catalogue" subtitle="Items, prices and reorder levels" />
        {!loading && !data?.items.length ? <EmptyState icon="pricetags-outline" title="No items yet" message="Add routers, ONTs, cable and accessories." /> : null}
        {data?.items.map((i) => (
          <ListRow
            key={i.id}
            icon={i.tracking === 'SERIALIZED' ? 'wifi' : 'git-commit-outline'}
            iconTint={colors.text}
            title={i.name}
            subtitle={`${i.sku} · ${kes(i.unitPrice)} / ${i.unit} · reorder at ${i.reorderLevel}`}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text variant="title">{`${i.stock?.inStore ?? 0}`}</Text>
                {i.lowStock ? <Badge label="Low" tone="danger" /> : <Text variant="label" color={colors.textDim}>in store</Text>}
              </View>
            }
            onPress={() => router.push(`/admin/item/${i.id}`)}
          />
        ))}
      </Screen>
      <Pressable style={styles.fab} onPress={() => router.push('/admin/item-new')} accessibilityLabel="Add item">
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
