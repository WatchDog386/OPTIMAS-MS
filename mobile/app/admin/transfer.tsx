import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import type { Item, SerialUnit } from '../../src/api/types';
import { Button, Input, ListRow, Screen, ScreenHeader, SectionHeader, Segmented, TechPicker, Text } from '../../src/components';
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
  const bulkItems = items.data?.items.filter((i) => i.tracking === 'BULK') ?? [];
  const serialisedItems = items.data?.items.filter((i) => i.tracking === 'SERIALIZED') ?? [];

  const [available, setAvailable] = useState<SerialUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [manualSerial, setManualSerial] = useState('');

  const serialisedItem = items.data?.items.find((i) => i.id === itemId);

  const toggleSerial = (s: string) =>
    setSerials((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const addManualSerial = () => {
    const v = manualSerial.trim().toUpperCase();
    if (!v) return;
    setSerials((l) => (l.includes(v) ? l : [...l, v]));
    setManualSerial('');
  };

  const loadAvailable = async () => {
    if (!itemId) return;
    setLoadingUnits(true);
    try {
      const qs = new URLSearchParams({ itemId, status: 'IN_STORE' }).toString();
      const data = await api<{ units: SerialUnit[] }>(`/inventory/units?${qs}`);
      setAvailable((data.units ?? []).sort((a, b) => a.serialNumber.localeCompare(b.serialNumber)));
    } catch {
      setAvailable([]);
    } finally {
      setLoadingUnits(false);
    }
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
          <SectionHeader title="Device" />
          <View style={styles.grid}>
            {serialisedItems.map((i) => (
              <Pressable key={i.id} onPress={() => setItemId(i.id)} style={[styles.item, itemId === i.id && styles.itemOn]}>
                <Text variant="title" numberOfLines={2}>
                  {i.name}
                </Text>
                <Text variant="label" color={colors.textMuted}>
                  {i.sku} · {serialisedItem?.stock?.inStore ?? 0} in store
                </Text>
              </Pressable>
            ))}
          </View>

          {itemId ? (
            <>
              <Text variant="bodySm" color={colors.textMuted}>
                Pick the serial number(s) of the {serialisedItem?.name} router(s) to issue — or scan them.
              </Text>
              {loadingUnits ? (
                <Text variant="bodySm" color={colors.textMuted}>
                  Loading available units…
                </Text>
              ) : available.length ? (
                <>
                  <Text variant="label" color={colors.textMuted}>
                    Available in store ({available.length})
                  </Text>
                  <View style={styles.chips}>
                    {available.map((u) => (
                      <Pressable key={u.serialNumber} style={[styles.chip, serials.includes(u.serialNumber) && styles.chipOn]} onPress={() => toggleSerial(u.serialNumber)} accessibilityLabel={serials.includes(u.serialNumber) ? `Deselect ${u.serialNumber}` : `Select ${u.serialNumber}`}>
                        <Text variant="label">{u.serialNumber}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Text variant="bodySm" color={colors.textMuted}>
                  No {serialisedItem?.name} units in store. Receive stock first, or scan a serial that is already registered.
                </Text>
              )}
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Input label="Or type a serial number" icon="keypad-outline" autoCapitalize="characters" autoCorrect={false} value={manualSerial} onChangeText={setManualSerial} onSubmitEditing={addManualSerial} />
                </View>
                <Button label="Add" icon="add" disabled={!manualSerial.trim()} onPress={addManualSerial} />
              </View>
              <Button label={serials.length ? `Scan more (${serials.length})` : 'Scan serial numbers'} icon="barcode-outline" variant="secondary" onPress={scan} />
              {serials.length ? (
                <View style={styles.chips}>
                  <Text variant="label" color={colors.textMuted} style={{ marginRight: space.sm }}>
                    To issue:
                  </Text>
                  {serials.map((s) => (
                    <Pressable key={s} style={styles.chip} onPress={() => setSerials((l) => l.filter((x) => x !== s))} accessibilityLabel={`Remove ${s}`}>
                      <Text variant="label">{s}</Text>
                      <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
