import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../src/api/client';
import { Button, Glass, Input, PageHeader, Screen, Text } from '../src/components';
import { isManager, useAuth } from '../src/store/auth';
import { requestScan } from '../src/store/bridge';
import { toast } from '../src/store/feedback';
import { colors, fonts } from '../src/theme';
import { dateTime, humanize } from '../src/utils/format';

type Tone = 'success' | 'info' | 'warning' | 'danger';
interface Check {
  label: 'genuine' | 'none' | 'fake';
  verdict: { tone: Tone; title: string; detail: string };
  unit: {
    serial: string;
    mac: string | null;
    item: { name: string; sku: string };
    status: string;
    holder: { name: string; staffNo: string } | null;
    heldSince: string | null;
    customerAccount: string | null;
    installedAt: string | null;
    task: { id: string; code: string } | null;
    issued: { by: string; to: string | null; at: string } | null;
  } | null;
}

const TONE: Record<Tone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: '#E7F7EC', fg: colors.success, icon: 'checkmark-circle' },
  info: { bg: '#E8F0FB', fg: colors.info, icon: 'information-circle' },
  warning: { bg: '#FFF4E0', fg: '#B26A00', icon: 'alert-circle' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle' },
};

/** "Is this the one we issued?" Scan a device's label (or type its serial or MAC) for a plain answer. */
export default function Verify() {
  const role = useAuth((s) => s.user?.role);
  // Opened from a label scanned with the phone's own camera / QR scanner: check it straight away
  const { c } = useLocalSearchParams<{ c?: string }>();
  const [code, setCode] = useState(c ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Check | null>(null);

  const check = async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      setResult(await api<Check>('/inventory/verify', { body: { code: value.trim() } }));
    } catch (e) {
      toast.error('Could not check', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => {
    const r = await requestScan({ title: 'Scan the device label' });
    if (r?.[0]) {
      setCode(r[0]);
      await check(r[0]);
    }
  };

  const opened = useRef(false);
  useEffect(() => {
    if (c && !opened.current) {
      opened.current = true;
      void check(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);

  const t = result ? TONE[result.verdict.tone] : null;
  const u = result?.unit;
  return (
    <Screen>
      <PageHeader title="Check a device" right={null} />
      <Text variant="bodySm" color={colors.textMuted}>
        Scan the Optimas label on a router or ONT to see if it is genuine, who it was issued to and where it is now.
      </Text>
      <Button label="Scan label" icon="qr-code-outline" size="lg" loading={busy} onPress={scan} />
      <Input label="Or type the serial or MAC" icon="barcode-outline" autoCapitalize="characters" value={code} onChangeText={setCode} onSubmitEditing={() => check(code)} returnKeyType="search" />
      {code.trim() ? <Button label="Check" icon="search" variant="secondary" loading={busy} onPress={() => check(code)} /> : null}

      {result && t ? (
        <View style={{ gap: 12 }}>
          <View style={[styles.verdict, { backgroundColor: t.bg }]} accessibilityLiveRegion="polite">
            <Ionicons name={t.icon} size={44} color={t.fg} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="title" color={t.fg} style={{ fontFamily: fonts.bold, fontSize: 18 }}>
                {result.verdict.title}
              </Text>
              <Text variant="bodySm" color={colors.text}>
                {result.verdict.detail}
              </Text>
            </View>
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: result.label === 'genuine' ? '#E7F7EC' : result.label === 'fake' ? colors.dangerSoft : colors.surfaceAlt }]}>
              <Ionicons name={result.label === 'genuine' ? 'shield-checkmark' : result.label === 'fake' ? 'warning' : 'pricetag-outline'} size={14} color={result.label === 'genuine' ? colors.success : result.label === 'fake' ? colors.danger : colors.textMuted} />
              <Text variant="label" style={{ fontFamily: fonts.semibold }}>
                {result.label === 'genuine' ? 'Genuine Optimas label' : result.label === 'fake' ? 'Fake label' : 'No label scanned · print one'}
              </Text>
            </View>
          </View>
          {u ? (
            <Glass strong style={{ gap: 8 }}>
              <Row label="Device" value={u.item.name} />
              <Row label="Serial" value={u.serial} />
              {u.mac ? <Row label="MAC" value={u.mac} /> : null}
              <Row label="Status" value={humanize(u.status)} />
              {u.holder ? <Row label="Held by" value={`${u.holder.name} · ${u.holder.staffNo}`} /> : null}
              {u.issued ? <Row label="Issued" value={`by ${u.issued.by} · ${dateTime(u.issued.at)}`} /> : null}
              {u.customerAccount ? <Row label="Customer" value={u.customerAccount} /> : null}
              {u.installedAt ? <Row label="Installed" value={dateTime(u.installedAt)} /> : null}
              {u.task ? <Button label={`Open job ${u.task.code}`} icon="briefcase-outline" variant="secondary" onPress={() => router.push(`/task/${u.task!.id}`)} /> : null}
              {isManager(role) ? <Button label="Full history" icon="time-outline" variant="secondary" onPress={() => router.push(`/admin/unit?serial=${encodeURIComponent(u.serial)}`)} /> : null}
            </Glass>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySm" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="bodySm" style={{ fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' }} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
