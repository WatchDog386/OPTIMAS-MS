import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, ApiError } from '../../src/api/client';
import type { BulkHolding, SerialUnit, Task } from '../../src/api/types';
import { Button, Card, Input, ListRow, Loading, Screen, ScreenHeader, SectionHeader, Segmented, SignaturePad, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestCapture } from '../../src/store/bridge';
import { colors, fonts, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';
import { confirmDialog, toast, celebrate } from '../../src/store/feedback';

export default function CompleteTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useApi<{ task: Task }>(`/tasks/${id}`);
  const stock = useApi<{ units: SerialUnit[]; pending?: SerialUnit[]; bulk: BulkHolding[] }>('/inventory/my');
  const [serials, setSerials] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [collected, setCollected] = useState('');
  const [signal, setSignal] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [cable, setCable] = useState<string | null>(null);
  // The length marks printed on the drop cable where the run starts and ends
  const [markStart, setMarkStart] = useState('');
  const [markEnd, setMarkEnd] = useState('');
  const [fat, setFat] = useState<'yes' | 'no' | null>(null);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [typed, setTyped] = useState('');
  const [checking, setChecking] = useState(false);

  // Devices accepted and devices still waiting to be accepted: both can be installed
  const units = [...(stock.data?.units ?? []), ...(stock.data?.pending ?? [])];
  const bulk = stock.data?.bulk ?? [];
  const materials = useMemo(
    () =>
      bulk
        .map((b) => ({ holding: b, quantity: Number(qty[b.item.id] || 0) }))
        .filter((m) => m.quantity > 0),
    [bulk, qty],
  );
  const total = materials.reduce((n, m) => n + Math.round(m.quantity * m.holding.item.unitPrice), 0);
  // Drop cable: filled in from the cable taken from stock above (metres), and can be changed
  const cableFromStock = materials.filter((m) => /cable/i.test(m.holding.item.name) && /^m(etres?)?$/i.test(m.holding.item.unit)).reduce((n, m) => n + m.quantity, 0);
  const marked = markStart !== '' && markEnd !== '';
  const fromMarks = marked ? Math.round(Math.abs(Number(markStart) - Number(markEnd)) * 10) / 10 : null;
  const cableM = fromMarks != null ? String(fromMarks) : (cable ?? (cableFromStock ? String(cableFromStock) : ''));

  if (!task.data || !stock.data) return <Loading />;
  const t = task.data.task;
  const needsSerial = t.type === 'INSTALLATION';

  const addSerials = (list: string[]) => setSerials((s) => [...new Set([...s, ...list.map((x) => x.toUpperCase())])]);
  // The technician TYPES the SN from the sticker (scanning often picked up the MAC address by mistake);
  // it is checked against their devices straight away
  const addTyped = async () => {
    const code = typed.trim().toUpperCase();
    if (code.length < 4) return toast.warning('Enter the SN', 'Type the serial number exactly as printed next to "SN" on the sticker.');
    setChecking(true);
    try {
      const { unit } = await api<{ unit: { serialNumber: string; item: { name: string } } }>(`/inventory/my/find?code=${encodeURIComponent(code)}`);
      addSerials([unit.serialNumber]);
      setTyped('');
      toast.success(unit.item.name, `S/N ${unit.serialNumber} added`);
    } catch (e) {
      toast.error('Not one of your devices', e instanceof ApiError ? e.message : 'Check the SN and try again');
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    if (needsSerial && !serials.length) return toast.warning('Device required', 'Type the serial number (SN) of the router/ONT you installed.');
    if (needsSerial && !signature) return toast.warning('Customer signature required', 'Ask the customer to sign to confirm the installation.');
    if (signature && signedBy.trim().length < 2) return toast.warning('Who signed?', 'Enter the name of the person who signed.');
    if (needsSerial && !signal.trim()) return toast.warning('Add the signal', 'Enter the router signal reading, e.g. -27 dBm.');
    if (needsSerial && !fat) return toast.warning('FAT pre-installed?', 'Say whether the FAT was already installed.');
    if (notes.trim().length < 5) return toast.warning('Add notes', 'Briefly describe the work done.');
    const over = materials.find((m) => m.quantity > m.holding.quantity);
    if (over) return toast.warning('Not enough stock', `You only hold ${over.holding.quantity} ${over.holding.item.unit} of ${over.holding.item.name}.`);

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
          signal: signal.trim() || undefined,
          houseNo: houseNo.trim() || undefined,
          dropCableM: cableM ? Number(cableM) : undefined,
          ...(marked ? { dropStartM: Number(markStart), dropEndM: Number(markEnd) } : {}),
          fatPreinstalled: fat ? fat === 'yes' : undefined,
          serials,
          materials: materials.map((m) => ({ itemId: m.holding.item.id, quantity: m.quantity })),
          signature: signature ? { path: signature, signedBy: signedBy.trim() } : undefined,
        },
      });
      celebrate('Task completed', serials.length ? 'Your task report has been sent for verification, and the device for admin approval.' : 'Your task report has been sent for verification.');
      // Last task of the day? The daily report goes to the office (on team tasks, from the leader)
      const now = await confirmDialog({
        title: 'Daily report',
        message: 'When today’s tasks are done, send the office your daily report. It is put together from your task reports.',
        emoji: '📝',
        confirmLabel: 'Open daily report',
        cancelLabel: 'Later',
      });
      if (now) router.replace('/day-report');
      else goBack();
    } catch (e) {
      toast.error('Could not complete task', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scrollEnabled={!drawing} footer={<Button label="Take completion photo & submit" icon="camera" size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title="Complete task" subtitle={`${t.code} · ${t.customerName}`} />

      <SectionHeader title={needsSerial ? 'Installed device (required)' : 'Devices installed'} />
      <Text variant="bodySm" color={colors.textMuted}>
        Type the serial number (SN) printed on the router/ONT left at the customer — not the MAC address — or tap it in your list below. After you submit, an admin approves it and it moves from In hand to Installed.
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
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input
            icon="keypad-outline"
            placeholder="Type the SN, e.g. HWTC1A2B3C4D"
            autoCapitalize="characters"
            autoCorrect={false}
            value={typed}
            onChangeText={setTyped}
            onSubmitEditing={() => void addTyped()}
            returnKeyType="done"
          />
        </View>
        <Button label="Add" icon="add" variant="secondary" loading={checking} onPress={() => void addTyped()} />
      </View>
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

      <SectionHeader title="Task report" />
      <Text variant="bodySm" color={colors.textMuted}>
        Location: {t.address}
      </Text>
      <Input label="House / unit no." icon="home-outline" value={houseNo} onChangeText={setHouseNo} placeholder="e.g. D3" autoCapitalize="characters" />
      {t.type === 'INSTALLATION' ? null : <Input label="Customer account no." icon="person-outline" value={account ?? t.customerAccount ?? ''} onChangeText={setAccount} autoCapitalize="characters" />}
      <Input label={needsSerial ? 'Router signal (required)' : 'Router signal'} icon="cellular-outline" value={signal} onChangeText={setSignal} placeholder="As read on site, e.g. -27 dBm" />
      <Text variant="label" color={colors.textMuted}>
        Drop cable · the length marks printed on the cable
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Input label="Mark at start (m)" keyboardType="decimal-pad" value={markStart} onChangeText={(v) => setMarkStart(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 1240" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Mark at end (m)" keyboardType="decimal-pad" value={markEnd} onChangeText={(v) => setMarkEnd(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 1210" />
        </View>
      </View>
      {marked ? (
        <View style={styles.used}>
          <Ionicons name="git-commit-outline" size={16} color={colors.primary} />
          <Text variant="title" style={{ flex: 1 }}>
            {fromMarks} m used
          </Text>
          <Text variant="label" color={colors.textMuted}>
            {markStart} → {markEnd}
          </Text>
        </View>
      ) : (
        <Input label="No marks? Metres used" icon="git-commit-outline" keyboardType="decimal-pad" value={cableM} onChangeText={(v) => setCable(v.replace(/[^0-9.]/g, ''))} placeholder="0" />
      )}
      <Text variant="label" color={colors.textMuted}>
        {needsSerial ? 'FAT pre-installed? (required)' : 'FAT pre-installed?'}
      </Text>
      <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={fat ?? ('' as 'yes')} onChange={(v) => setFat(v)} />
      <Input label="Client paid (KES)" icon="cash-outline" keyboardType="number-pad" value={collected} onChangeText={(v) => setCollected(v.replace(/\D/g, ''))} placeholder="0" />
      <Input label="Work done" multiline value={notes} onChangeText={setNotes} placeholder="e.g. Ran 45m drop cable from FAT, terminated SC/APC, configured Wi-Fi, speed test 21 Mbps" />

      <SectionHeader title={needsSerial ? 'Customer sign-off (required)' : 'Customer sign-off'} />
      <Text variant="bodySm" color={colors.textMuted}>
        Hand the phone to the customer to confirm the work was done to their satisfaction.
      </Text>
      <Input label="Signed by" icon="person-circle-outline" value={signedBy} onChangeText={setSignedBy} placeholder={t.customerName} />
      <SignaturePad onChange={setSignature} onDrawingChange={setDrawing} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md, height: 44, minWidth: 96 },
  used: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  qtyInput: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
});
