import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { Movement, SerialUnit } from '../../src/api/types';
import { Badge, Button, Card, Input, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { requestScan } from '../../src/store/bridge';
import { colors, space } from '../../src/theme';
import { dateTime, humanize, unitStatusTone } from '../../src/utils/format';
import { toast } from '../../src/store/feedback';

type UnitHistory = SerialUnit & { movements: Movement[]; task: { id: string; code: string; customerName: string } | null };

/** Trace any device: who held it, when, and where it ended up. */
export default function UnitTrace() {
  const [serial, setSerial] = useState('');
  const [unit, setUnit] = useState<UnitHistory | null>(null);
  const [busy, setBusy] = useState(false);
  const [lostNote, setLostNote] = useState('');
  const params = useLocalSearchParams<{ serial?: string }>();

  const lookup = async (s = serial) => {
    if (!s.trim()) return;
    setBusy(true);
    try {
      setUnit((await api<{ unit: UnitHistory }>(`/inventory/units/${encodeURIComponent(s.trim().toUpperCase())}/history`)).unit);
    } catch (e) {
      setUnit(null);
      toast.error('Not found', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (params.serial) {
      setSerial(params.serial);
      void lookup(params.serial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.serial]);

  const reportLost = async () => {
    if (!unit) return;
    try {
      await api('/inventory/report-lost', { body: { serialNumber: unit.serialNumber, note: lostNote } });
      await lookup(unit.serialNumber);
    } catch (e) {
      toast.error('Failed', e instanceof ApiError ? e.message : 'Try again');
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Trace a device" subtitle="Chain of custody by serial number" />
      <Input icon="search" placeholder="Serial number" autoCapitalize="characters" value={serial} onChangeText={setSerial} onSubmitEditing={() => lookup()} returnKeyType="search" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Scan" icon="barcode-outline" variant="secondary" style={{ flex: 1 }} onPress={async () => {
          const r = await requestScan({ title: 'Scan device' });
          if (r?.[0]) {
            setSerial(r[0]);
            await lookup(r[0]);
          }
        }} />
        <Button label="Search" icon="search" style={{ flex: 1 }} loading={busy} onPress={() => lookup()} />
      </View>

      {unit ? (
        <>
          <Card variant="hero" style={{ gap: space.sm }}>
            <Text variant="overline" color={colors.textMuted}>
              {unit.item.name}
            </Text>
            <Text variant="h1">{unit.serialNumber}</Text>
            <Badge label={humanize(unit.status)} tone={unitStatusTone[unit.status]} />
            {unit.holder ? (
              <Text variant="bodySm" color={colors.textMuted}>
                Held by {unit.holder.name} ({unit.holder.staffNo}) since {dateTime(unit.heldSince)}
              </Text>
            ) : null}
            {unit.task ? (
              <Text variant="bodySm" color={colors.textMuted}>
                Installed on {unit.task.code} · {unit.task.customerName} · acct {unit.customerAccount ?? '—'}
              </Text>
            ) : null}
          </Card>

          <SectionHeader title="History" />
          {unit.movements.map((m, i) => (
            <View key={m.id} style={styles.step}>
              <View style={styles.rail}>
                <View style={styles.dot} />
                {i < unit.movements.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space.lg }}>
                <Text variant="title">{humanize(m.type)}</Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  {[m.fromUser && `from ${m.fromUser.name}`, m.toUser && `to ${m.toUser.name}`, m.task && `job ${m.task.code}`].filter(Boolean).join(' · ') || `by ${m.actor.name}`}
                </Text>
                {m.note ? (
                  <Text variant="bodySm" color={colors.textDim}>
                    “{m.note}”
                  </Text>
                ) : null}
                <Text variant="label" color={colors.textDim}>
                  {dateTime(m.createdAt)} · {m.actor.name}
                </Text>
              </View>
            </View>
          ))}

          {unit.status === 'WITH_TECHNICIAN' || unit.status === 'IN_TRANSIT' ? (
            <Card style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <Ionicons name="warning" size={18} color={colors.danger} />
                <Text variant="title">Report as lost</Text>
              </View>
              <Input placeholder="What happened? (required)" value={lostNote} onChangeText={setLostNote} />
              <Button label="Report lost" variant="danger" disabled={lostNote.trim().length < 5} onPress={reportLost} />
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
});
