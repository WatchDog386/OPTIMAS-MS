import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, ApiError } from '../../src/api/client';
import type { BulkHolding, SerialUnit, Task } from '../../src/api/types';
import { Button, Card, Input, ListRow, Loading, Screen, ScreenHeader, SectionHeader, Segmented, SignaturePad, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestCapture, requestScan, type CaptureResult } from '../../src/store/bridge';
import { colors, fonts, radius, space } from '../../src/theme';
import { kes } from '../../src/utils/format';
import { confirmDialog, toast, celebrate } from '../../src/store/feedback';

/** The task report, filed after the completion photo. Mirrors the server's check. */
type Report = { found: string; done: string; result: string };
const FILLER = /^(done|ok|okay|complete|completed|finished|fixed|sorted|resolved|success|successful|good|fine|na|n\/a|nil|none|no|yes|job|task|work|the|is|was|it|and|all|well|working|works)$/i;
const wordCount = (v: string) => v.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
function reportProblem(part: string, what: string, minWords: number): string | undefined {
  const words = part.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length < minWords || part.replace(/\s+/g, ' ').trim().length < minWords * 4) return `${what}: write at least ${minWords} words.`;
  if (words.every((w) => FILLER.test(w.replace(/[^a-z/]/gi, '')))) return `${what}: describe what actually happened.`;
  return undefined;
}

export default function CompleteTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const task = useApi<{ task: Task }>(`/tasks/${id}`);
  const stock = useApi<{ units: SerialUnit[]; pending?: SerialUnit[]; bulk: BulkHolding[] }>('/inventory/my');
  const [serials, setSerials] = useState<string[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [report, setReport] = useState<Report>({ found: '', done: '', result: '' });
  // Step 2: the completion photo is taken; the task is completed only when the report is filed.
  const [photo, setPhoto] = useState<CaptureResult | null>(null);
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
  // Installations: a router from the technician's stock, or the customer's own router (recorded with
  // its make/model, SN and a live photo of its label, as proof)
  const [routerFrom, setRouterFrom] = useState<'stock' | 'customer'>('stock');
  const [own, setOwn] = useState({ model: '', sn: '', mac: '' });
  const [label, setLabel] = useState<CaptureResult | null>(null);
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
      if (e instanceof ApiError && (e.code === 'NOT_ISSUED' || e.code === 'NOT_FOUND')) {
        // Not one issued to them: probably the customer's own router — switch, with the SN filled in
        const theirs = await confirmDialog({
          title: 'Not a router issued to you',
          message: `${code} is not among the devices the office issued to you. Is it the customer's own router?`,
          emoji: '🏠',
          confirmLabel: "Yes, customer's router",
          cancelLabel: 'No, retype',
        });
        if (theirs) {
          setRouterFrom('customer');
          setOwn((o) => ({ ...o, sn: code }));
          setTyped('');
        }
      } else toast.error('Not one of your devices', e instanceof ApiError ? e.message : 'Check the SN and try again');
    } finally {
      setChecking(false);
    }
  };

  /** Step 1: devices, materials and the customer's sign-off — then the completion photo. */
  const takePhoto = async () => {
    if (needsSerial && routerFrom === 'stock' && !serials.length) return toast.warning('Device required', "Type the serial number (SN) of the router/ONT you installed, or choose \"Customer's own router\".");
    if (routerFrom === 'customer') {
      if (own.model.trim().length < 2) return toast.warning("The customer's router", 'Enter its make and model, e.g. TP-Link Archer C6.');
      if (own.sn.trim().length < 4) return toast.warning("The customer's router", 'Type its serial number (SN) exactly as on the label.');
      if (!label) return toast.warning('Photo of the label', "Take a photo of the router's label so the office can confirm the installation.");
    }
    if (needsSerial && !signature) return toast.warning('Customer signature required', 'Ask the customer to sign to confirm the installation.');
    if (signature && signedBy.trim().length < 2) return toast.warning('Who signed?', 'Enter the name of the person who signed.');
    const over = materials.find((m) => m.quantity > m.holding.quantity);
    if (over) return toast.warning('Not enough stock', `You only hold ${over.holding.quantity} ${over.holding.item.unit} of ${over.holding.item.name}.`);
    const shot = await requestCapture('TASK_END', { taskId: t.id });
    if (!shot) return;
    setPhoto(shot);
    toast.info('Now write the task report', 'The task is completed only when you submit the report.');
  };

  /** Step 2: the task report — only then is the task completed. */
  const submit = async () => {
    if (!photo) return;
    if (needsSerial && !signal.trim()) return toast.warning('Add the signal', 'Enter the router signal reading, e.g. -27 dBm.');
    if (needsSerial && !fat) return toast.warning('FAT pre-installed?', 'Say whether the FAT was already installed.');
    const problem = reportProblem(report.found, 'What you found', 3) ?? reportProblem(report.done, 'Work done', 5) ?? reportProblem(report.result, 'Result', 3);
    if (problem) return toast.warning('Write the task report', problem);
    setBusy(true);
    try {
      await api(`/tasks/${t.id}/complete`, {
        body: {
          photoId: photo.photoId,
          report: { found: report.found.trim(), done: report.done.trim(), result: report.result.trim() },
          customerAccount: (account ?? t.customerAccount) || undefined,
          amountCollected: collected ? Number(collected) : undefined,
          signal: signal.trim() || undefined,
          houseNo: houseNo.trim() || undefined,
          dropCableM: cableM ? Number(cableM) : undefined,
          ...(marked ? { dropStartM: Number(markStart), dropEndM: Number(markEnd) } : {}),
          fatPreinstalled: fat ? fat === 'yes' : undefined,
          serials: routerFrom === 'customer' ? [] : serials,
          ...(routerFrom === 'customer' && label
            ? { ownRouter: { model: own.model.trim(), sn: own.sn.trim().toUpperCase(), mac: own.mac.trim() || undefined, photoId: label.photoId } }
            : {}),
          materials: materials.map((m) => ({ itemId: m.holding.item.id, quantity: m.quantity })),
          signature: signature ? { path: signature, signedBy: signedBy.trim() } : undefined,
        },
      });
      celebrate('Task completed', routerFrom === 'customer' ? "Your task report has been sent for verification, and the customer's router to the office to confirm." : serials.length ? 'Your task report has been sent for verification, and the device for admin approval.' : 'Your task report has been sent for verification.');
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

  if (photo) {
    return (
      <Screen footer={<Button label="Submit report & complete task" icon="checkmark-done" size="lg" loading={busy} onPress={submit} />}>
        <ScreenHeader title="Task report" subtitle={`${t.code} · ${t.customerName}`} />
        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <Image source={{ uri: photo.uri }} style={styles.thumb} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">Completion photo taken</Text>
            <Text variant="bodySm" color={colors.textMuted}>
              The task is not complete yet. Fill in the report — what you found, the work done and the result — then submit.
            </Text>
          </View>
        </Card>
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
        <Input
          label={`What you found (${wordCount(report.found)}/3+ words)`}
          multiline
          value={report.found}
          onChangeText={(v) => setReport((r) => ({ ...r, found: v }))}
          placeholder="e.g. No internet, red LOS light on the ONT, drop cable cut near the gate"
        />
        <Input
          label={`Work done (${wordCount(report.done)}/5+ words)`}
          multiline
          value={report.done}
          onChangeText={(v) => setReport((r) => ({ ...r, done: v }))}
          placeholder="e.g. Ran 45m drop cable from the FAT, terminated SC/APC, replaced the patch cord, configured Wi-Fi"
        />
        <Input
          label={`Result (${wordCount(report.result)}/3+ words)`}
          multiline
          value={report.result}
          onChangeText={(v) => setReport((r) => ({ ...r, result: v }))}
          placeholder="e.g. ONT online, speed test 21 Mbps, client browsing"
        />

        <Button label="Retake photo" icon="camera-outline" variant="secondary" onPress={() => void requestCapture('TASK_END', { taskId: t.id }).then((p) => p && setPhoto(p))} />
      </Screen>
    );
  }

  return (
    <Screen scrollEnabled={!drawing} footer={<Button label="Take completion photo" icon="camera" size="lg" onPress={() => void takePhoto()} />}>
      <ScreenHeader title="Complete task" subtitle={`${t.code} · ${t.customerName}`} />

      <SectionHeader title={needsSerial ? 'Installed device (required)' : 'Devices installed'} />
      {/* Which router: one issued to the technician by the office, or the customer's own */}
      <Segmented
        options={[
          { value: 'stock', label: 'Router issued to me' },
          { value: 'customer', label: "Customer's router" },
        ]}
        value={routerFrom}
        onChange={setRouterFrom}
      />
      {routerFrom === 'customer' ? (
        <Card style={{ gap: space.md }}>
          <Text variant="bodySm" color={colors.textMuted}>
            The customer already has a router, not one issued to you. Scan or type its SN, add the model and photograph its label: the office checks the photo and approves it, then it is kept on record as the customer's device.
          </Text>
          <Input label="Make and model" icon="hardware-chip-outline" value={own.model} onChangeText={(v) => setOwn((o) => ({ ...o, model: v }))} placeholder="e.g. TP-Link Archer C6" />
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input label="Serial number (SN)" icon="barcode-outline" autoCapitalize="characters" autoCorrect={false} value={own.sn} onChangeText={(v) => setOwn((o) => ({ ...o, sn: v }))} placeholder="As printed on the label, next to SN" />
            </View>
            <Button
              label="Scan"
              icon="scan-outline"
              variant="secondary"
              onPress={() =>
                void requestScan({ title: "Scan the customer's router SN" }).then((codes) => {
                  if (codes?.[0]) setOwn((o) => ({ ...o, sn: codes[0].toUpperCase() }));
                })
              }
            />
          </View>
          <Input label="MAC address (optional)" icon="git-network-outline" autoCapitalize="characters" autoCorrect={false} value={own.mac} onChangeText={(v) => setOwn((o) => ({ ...o, mac: v }))} placeholder="e.g. A4:2B:B0:12:34:56" />
          {label ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Image source={{ uri: label.uri }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text variant="title" style={{ fontSize: 14 }}>
                  Label photo taken
                </Text>
                <Text variant="label" color={colors.textMuted}>
                  With the time and place it was taken.
                </Text>
              </View>
              <Button label="Retake" variant="ghost" onPress={() => void requestCapture('ROUTER_LABEL', { taskId: t.id }).then((p) => p && setLabel(p))} />
            </View>
          ) : (
            <Button label="Photograph the router's label" icon="camera-outline" variant="secondary" onPress={() => void requestCapture('ROUTER_LABEL', { taskId: t.id }).then((p) => p && setLabel(p))} />
          )}
        </Card>
      ) : (
        <>
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
        </>
      )}

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
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: space.md, height: 44, minWidth: 96 },
  used: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  qtyInput: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
});
