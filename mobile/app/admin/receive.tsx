import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Item } from '../../src/api/types';
import { Badge, Button, Input, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestScan } from '../../src/store/bridge';
import { colors, radius, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

/** Goods received from a supplier into the store. */
export default function Receive() {
  const { data } = useApi<{ items: Item[] }>('/inventory/items');
  const [itemId, setItemId] = useState<string | null>(null);
  const [serials, setSerials] = useState<string[]>([]);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const item = data?.items.find((i) => i.id === itemId);

  const submit = async () => {
    if (!item) return toast.warning('Choose an item');
    setBusy(true);
    try {
      const body =
        item.tracking === 'SERIALIZED'
          ? { itemId: item.id, serials: serials.map((serialNumber) => ({ serialNumber })), note: note || undefined }
          : { itemId: item.id, quantity: Number(quantity), note: note || undefined };
      const r = await api<{ received: number }>('/inventory/receive', { body });
      toast.success('Stock received', `${r.received} ${item.unit} of ${item.name} added to the store.`);
      router.back();
    } catch (e) {
      toast.error('Failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Receive into store" icon="add-circle" size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title="Receive stock" subtitle="Supplier deliveries" />
      <SectionHeader title="Item" />
      <View style={styles.grid}>
        {data?.items.map((i) => (
          <Pressable key={i.id} onPress={() => setItemId(i.id)} style={[styles.item, itemId === i.id && styles.itemOn]}>
            <Text variant="title" numberOfLines={2}>
              {i.name}
            </Text>
            <Badge label={i.tracking === 'SERIALIZED' ? 'Serialised' : 'Bulk'} tone={i.tracking === 'SERIALIZED' ? 'brand' : 'neutral'} dot={false} />
          </Pressable>
        ))}
      </View>
      {item?.tracking === 'SERIALIZED' ? (
        <>
          <Text variant="bodySm" color={colors.textMuted}>
            Scan every unit. Each serial number becomes a tracked asset.
          </Text>
          <Button
            label={serials.length ? `${serials.length} scanned · scan more` : 'Scan serial numbers'}
            icon="barcode-outline"
            variant="secondary"
            onPress={async () => {
              const r = await requestScan({ multiple: true, title: 'Scan received units' });
              if (r) setSerials((s) => [...new Set([...s, ...r])]);
            }}
          />
          <Text variant="label" color={colors.textMuted}>
            {serials.join(' · ')}
          </Text>
        </>
      ) : item ? (
        <Input label={`Quantity (${item.unit})`} keyboardType="decimal-pad" value={quantity} onChangeText={(v) => setQuantity(v.replace(/[^0-9.]/g, ''))} />
      ) : null}
      <Input label="Supplier / delivery note" value={note} onChangeText={setNote} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { flexBasis: '48%', flexGrow: 1, gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  itemOn: { borderColor: colors.primary },
});
