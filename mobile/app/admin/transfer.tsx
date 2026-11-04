import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import type { Item, SerialUnit } from '../../src/api/types';
import { Button, Input, Screen, ScreenHeader, SectionHeader, Segmented, TechPicker, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestScan } from '../../src/store/bridge';
import { colors, radius, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

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
  const [manualSerial, setManualSerial] = useState('');
  const bulkItems = items.data?.items.filter((i) => i.tracking === 'BULK') ?? [];

  const toggleSerial = (s: string) =>
    setSerials((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const addManualSerial = () => {
    const v = manualSerial.trim().toUpperCase();
    if (!v) return;
    setSerials((l) => (l.includes(v) ? l : [...l, v]));
    setManualSerial('');
  };

  const scan = async () => {
    const r = await requestScan({ multiple: true, title: issuing ? 'Scan devices to issue' : 'Scan returned devices' });
    if (r) setSerials((s) => [...new Set([...s, ...r])]);
  };

  const submit = async () => {
    if (!userId) return toast.warning('Choose a technician');
    const body =
      mode === 'devices'
        ? { userId, serials, note: note || undefined, condition }
        : { userId, itemId, quantity: Number(quantity), note: note || undefined };
    if (mode === 'devices' && !serials.length) return toast.warning('Scan or select at least one device');
    if (mode === 'materials' && (!itemId || !Number(quantity))) return toast.warning('Choose an item and quantity');
    setBusy(true);
    try {
      await api(issuing ? '/inventory/issue' : '/inventory/return', { body });
      toast.success(
        issuing ? 'Stock issued' : 'Return recorded',
        issuing ? 'The technician must confirm receipt in their app before devices can be installed.' : 'Stock is back in the store ledger.',
      );
      goBack();
    } catch (e) {
      toast.error('Failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label={issuing ? 'Issue to technician' : 'Record return'} icon={issuing ? 'arrow-up-circle' : 'arrow-down-circle'} size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title={issuing ? 'Issue stock' : 'Receive return'} subtitle={issuing ? 'Every device is tracked by serial number' : 'Devices go back to store or to faulty'} />
      <SectionHeader title="Technician" />
      <TechPicker value={userId} onChange={setUserId} />

      {mode === 'devices' ? (
        <>
          <SectionHeader title="Serial numbers" />
          <Text variant="bodySm" color={colors.textMuted}>
            {issuing ? 'Scan the serial number on each device you are issuing.' : 'Scan each device being returned.'}
          </Text>
          <View style={styles.scanRow}>
            <Button label={serials.length ? `Scan more · ${serials.length}` : 'Scan serial'} icon="barcode-outline" variant="secondary" onPress={scan} />
            <View style={{ flex: 1 }}>
              <Input label="Or type a serial" icon="keypad-outline" autoCapitalize="characters" autoCorrect={false} value={manualSerial} onChangeText={setManualSerial} onSubmitEditing={addManualSerial} />
            </View>
            <Button label="Add" icon="add" disabled={!manualSerial.trim()} onPress={addManualSerial} />
          </View>
          {serials.length ? (
            <View style={styles.chipList}>
              <Text variant="label" color={colors.textMuted} style={{ marginRight: space.sm }}>
                {issuing ? 'To issue:' : 'To return:'}
              </Text>
              {serials.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => setSerials((l) => l.filter((x) => x !== s))} accessibilityLabel={`Remove ${s}`}>
                  <Text variant="label">{s}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
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
          <SectionHeader title="Item" />
          <View style={styles.grid}>
            {bulkItems.map((i) => (
              <Pressable key={i.id} onPress={() => setItemId(i.id)} style={[styles.item, itemId === i.id && styles.itemOn]}>
                <Text variant="title" numberOfLines={2}>{i.name}</Text>
                <Text variant="label" color={colors.textMuted}>{i.stock?.inStore ?? 0} {i.unit} in store</Text>
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
  scanRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
});
