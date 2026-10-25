import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { BulkHolding, SerialUnit, Task } from '../../src/api/types';
import { Button, Card, Input, ListRow, Loading, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestCapture, requestScan } from '../../src/store/bridge';
import { colors, fonts, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';

export default function CompleteTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useApi<{ task: Task }>(`/tasks/${id}`);
  const stock = useApi<{ units: SerialUnit[]; bulk: BulkHolding[] }>('/inventory/my');
  const [serials, setSerials] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [collected, setCollected] = useState('');
  const [busy, setBusy] = useState(false);

  const units = stock.data?.units ?? [];
  const bulk = stock.data?.bulk ?? [];
  const materials = useMemo(
    () =>
      bulk
        .map((b) => ({ holding: b, quantity: Number(qty[b.item.id] || 0) }))
        .filter((m) => m.quantity > 0),
    [bulk, qty],
  );
  const total = materials.reduce((n, m) => n + Math.round(m.quantity * m.holding.item.unitPrice), 0);

  if (!task.data || !stock.data) return <Loading />;
  const t = task.data.task;
  const needsSerial = t.type === 'INSTALLATION';

  const addSerials = (list: string[]) => setSerials((s) => [...new Set([...s, ...list.map((x) => x.toUpperCase())])]);
  const scan = async () => {
    const r = await requestScan({ title: 'Scan installed device' });
    if (r?.length) addSerials(r);
  };

  const submit = async () => {
    if (needsSerial && !serials.length) return Alert.alert('Device required', 'Scan the serial number of the router/ONT you installed.');
    if (notes.trim().length < 5) return Alert.alert('Add notes', 'Briefly describe the work done.');
    const over = materials.find((m) => m.quantity > m.holding.quantity);
    if (over) return Alert.alert('Not enough stock', `You only hold ${over.holding.quantity} ${over.holding.item.unit} of ${over.holding.item.name}.`);

    const photo = await requestCapture('TASK_END', { taskId: t.id });
    if (!photo) return;
    setBusy(true);
    try {
      await api(`/tasks/${t.id}/complete`, {
        body: {
          photoId: photo.photoId,
          notes: notes.trim(),
          customerAccount: (account ?? t.customerAccount) || undefined,
          amountCollected: collected ? Number(collected) : undefined,
          serials,
          materials: materials.map((m) => ({ itemId: m.holding.item.id, quantity: m.quantity })),
        },
      });
      Alert.alert('Job completed', 'Your report has been sent for verification.');
      router.back();
    } catch (e) {
      Alert.alert('Could not complete job', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Take completion photo & submit" icon="camera" size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title="Complete job" subtitle={`${t.code} · ${t.customerName}`} />

      <SectionHeader title={needsSerial ? 'Installed device (required)' : 'Devices installed'} />
      <Text variant="bodySm" color={colors.textMuted}>
        Scan the serial on the router/ONT left at the customer. It must be in your custody.
      </Text>
      {serials.map((s) => (
        <ListRow
          key={s}
          icon="wifi"
          title={units.find((u) => u.serialNumber === s)?.item.name ?? 'Device'}
          subtitle={`S/N ${s}`}
          right={
            <Pressable onPress={() => setSerials((l) => l.filter((x) => x !== s))} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          }
        />
      ))}
      <Button label="Scan device serial" icon="barcode-outline" variant="secondary" onPress={scan} />
      {units.filter((u) => !serials.includes(u.serialNumber)).length ? (
        <View style={styles.chips}>
          {units
            .filter((u) => !serials.includes(u.serialNumber))
            .map((u) => (
              <Pressable key={u.id} style={styles.chip} onPress={() => addSerials([u.serialNumber])}>
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text variant="label">{u.serialNumber}</Text>
              </Pressable>
            ))}
        </View>
      ) : null}

      <SectionHeader title="Materials used" />
      {bulk.length ? (
        <Card style={{ gap: space.md }}>
          {bulk.map((b) => (
            <View key={b.id} style={styles.matRow}>
              <View style={{ flex: 1 }}>
                <Text variant="title">{b.item.name}</Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  In hand: {b.quantity} {b.item.unit} · {kes(b.item.unitPrice)}/{b.item.unit}
                </Text>
              </View>
              <View style={styles.qtyBox}>
                <TextInput
                  value={qty[b.item.id] ?? ''}
                  onChangeText={(v) => setQty((q) => ({ ...q, [b.item.id]: v.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  style={styles.qtyInput}
                />
                <Text variant="label" color={colors.textMuted}>
                  {b.item.unit}
                </Text>
              </View>
            </View>
          ))}
          <View style={[styles.matRow, styles.total]}>
            <Text variant="title" color={colors.textMuted}>
              Materials value
            </Text>
            <Text variant="h2">{kes(total)}</Text>
          </View>
        </Card>
      ) : (
        <Text variant="bodySm" color={colors.textMuted}>
          You hold no materials. Ask the store to issue cable/connectors before using them.
        </Text>
      )}

      <SectionHeader title="Job report" />
      <Input label="Customer account no." icon="person-outline" value={account ?? t.customerAccount ?? ''} onChangeText={setAccount} autoCapitalize="characters" />
      <Input label="Amount collected (KES, if any)" icon="cash-outline" keyboardType="number-pad" value={collected} onChangeText={(v) => setCollected(v.replace(/\D/g, ''))} placeholder="0" />
      <Input label="Work done" multiline value={notes} onChangeText={setNotes} placeholder="e.g. Ran 45m drop cable from FAT, terminated SC/APC, configured Wi-Fi, speed test 21 Mbps" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md, height: 44, minWidth: 96 },
  qtyInput: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
});
