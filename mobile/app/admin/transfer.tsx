import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { Item } from '../../src/api/types';
import { Button, Input, ListRow, Screen, ScreenHeader, SectionHeader, Segmented, TechPicker, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestScan } from '../../src/store/bridge';
import { colors, radius, space } from '../../src/theme';

/** Issue stock to a technician, or receive a return from one. */
export default function Transfer() {
  const { direction } = useLocalSearchParams<{ direction: 'issue' | 'return' }>();
  const issuing = direction !== 'return';
  const items = useApi<{ items: Item[] }>('/inventory/items');
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'devices' | 'materials'>('devices');
  const [serials, setSerials] = useState<string[]>([]);
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [condition, setCondition] = useState<'GOOD' | 'FAULTY'>('GOOD');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const bulkItems = items.data?.items.filter((i) => i.tracking === 'BULK') ?? [];

  const scan = async () => {
    const r = await requestScan({ multiple: true, title: issuing ? 'Scan devices to issue' : 'Scan returned devices' });
    if (r) setSerials((s) => [...new Set([...s, ...r])]);
  };

  const submit = async () => {
    if (!userId) return Alert.alert('Choose a technician');
    const body =
      mode === 'devices'
        ? { userId, serials, note: note || undefined, condition }
        : { userId, itemId, quantity: Number(quantity), note: note || undefined };
    if (mode === 'devices' && !serials.length) return Alert.alert('Scan at least one device');
    if (mode === 'materials' && (!itemId || !Number(quantity))) return Alert.alert('Choose an item and quantity');
    setBusy(true);
    try {
      await api(issuing ? '/inventory/issue' : '/inventory/return', { body });
      Alert.alert(
        issuing ? 'Stock issued' : 'Return recorded',
        issuing ? 'The technician must confirm receipt in their app before devices can be installed.' : 'Stock is back in the store ledger.',
      );
      router.back();
    } catch (e) {
      Alert.alert('Failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label={issuing ? 'Issue to technician' : 'Record return'} icon={issuing ? 'arrow-up-circle' : 'arrow-down-circle'} size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title={issuing ? 'Issue stock' : 'Receive return'} subtitle={issuing ? 'Every device is tracked by serial number' : 'Devices go back to store or to faulty'} />
      <SectionHeader title="Technician" />
      <TechPicker value={userId} onChange={setUserId} />
      <Segmented
        options={[
          { value: 'devices', label: 'Routers & ONTs' },
          { value: 'materials', label: 'Cable & materials' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'devices' ? (
        <>
          {serials.map((s) => (
            <ListRow
              key={s}
              icon="wifi"
              title={s}
              right={
                <Pressable onPress={() => setSerials((l) => l.filter((x) => x !== s))} hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              }
            />
          ))}
          <Button label={serials.length ? `Scan more (${serials.length})` : 'Scan serial numbers'} icon="barcode-outline" variant="secondary" onPress={scan} />
          {!issuing ? (
            <Segmented
              options={[
                { value: 'GOOD', label: 'Good condition' },
                { value: 'FAULTY', label: 'Faulty' },
              ]}
              value={condition}
              onChange={setCondition}
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.grid}>
            {bulkItems.map((i) => (
              <Pressable key={i.id} onPress={() => setItemId(i.id)} style={[styles.item, itemId === i.id && styles.itemOn]}>
                <Text variant="title" numberOfLines={2}>
                  {i.name}
                </Text>
                <Text variant="label" color={colors.textMuted}>
                  {i.stock?.inStore ?? 0} {i.unit} in store
                </Text>
              </Pressable>
            ))}
          </View>
          <Input label="Quantity" keyboardType="decimal-pad" value={quantity} onChangeText={(v) => setQuantity(v.replace(/[^0-9.]/g, ''))} placeholder="0" />
        </>
      )}
      <Input label="Note (optional)" value={note} onChangeText={setNote} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { flexBasis: '48%', flexGrow: 1, gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  itemOn: { borderColor: colors.primary },
});
