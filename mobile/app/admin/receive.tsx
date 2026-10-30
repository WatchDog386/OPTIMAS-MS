import { useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
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
  const params = useLocalSearchParams<{ itemId?: string }>();
  const [itemId, setItemId] = useState<string | null>(null);
  const [serials, setSerials] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [unitsExpected, setUnitsExpected] = useState('');
  const [generating, setGenerating] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const item = data?.items.find((i) => i.id === itemId);

  useEffect(() => {
    if (params.itemId && !itemId) setItemId(params.itemId);
  }, [params.itemId, itemId]);

  const addSerials = (more: string[]) => {
    if (!more.length) return;
    setSerials((s) => {
      const known = new Set(s);
      const added = more.map((v) => v.trim().toUpperCase()).filter((v) => v && !known.has(v));
      return [...s, ...added];
    });
  };

  const removeSerial = (s: string) => setSerials((l) => l.filter((x) => x !== s));

  /** Unlabelled stock: the store asks the server for the next free numbers of that product's series. */
  const generate = async () => {
    if (!item) return;
    const count = Number(unitsExpected);
    if (!Number.isInteger(count) || count < 1 || count > 200) return toast.warning('Choose a count', 'Enter how many units arrived (1 – 200).');
    setGenerating(true);
    try {
      const r = await api<{ serials: string[] }>('/inventory/serials/generate', { body: { itemId: item.id, count } });
      addSerials(r.serials);
      setUnitsExpected('');
      toast.success('Numbers generated', `${r.serials.length} serial number(s) added. Give stickers with these below.`);
    } catch (e) {
      toast.error('Failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setGenerating(false);
    }
  };

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
      goBack();
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
            Scan the serial number of every unit, type one in by hand, or generate numbers for units that arrive without labels.
          </Text>
          <Button
            label={serials.length ? `${serials.length} serials · scan more` : 'Scan serial numbers'}
            icon="barcode-outline"
            variant="secondary"
            onPress={async () => {
              const r = await requestScan({ multiple: true, title: 'Scan received units' });
              if (r) addSerials(r);
            }}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="Or type a serial number" icon="keypad-outline" autoCapitalize="characters" autoCorrect={false} value={manual} onChangeText={setManual} />
            </View>
            <Button
              label="Add"
              icon="add"
              disabled={!manual.trim()}
              onPress={() => {
                addSerials([manual]);
                setManual('');
              }}
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="No labels on these units?" icon="sparkles-outline" keyboardType="number-pad" value={unitsExpected} onChangeText={(v) => setUnitsExpected(v.replace(/\D/g, ''))} placeholder="How many arrived" />
            </View>
            <Button label="Generate" icon="sparkles" variant="secondary" loading={generating} onPress={generate} />
          </View>
          {serials.length ? (
            <View style={styles.chips}>
              {serials.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => removeSerial(s)} accessibilityLabel={`Remove ${s}`}>
                  <Text variant="label">{s}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
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
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
});
