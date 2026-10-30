import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeader } from '../../src/api/client';
import { FeatureCard, PageHeader, Screen, Segmented, Text, type CardTone } from '../../src/components';
import { colors } from '../../src/theme';
import { toast } from '../../src/store/feedback';

type Period = '7' | '30' | 'month' | 'last-month';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const REPORTS: { key: string; icon: keyof typeof Ionicons.glyphMap; tone: CardTone; title: string; desc: string; dated: boolean }[] = [
  { key: 'attendance', icon: 'calendar', tone: 'teal', title: 'Attendance & hours', desc: 'Check-in/out, lateness, hours worked and dress-code results, with a payroll summary per person.', dated: true },
  { key: 'jobs', icon: 'briefcase', tone: 'graphite', title: 'Jobs & materials', desc: 'Every job with durations, devices installed, materials, cash collected and customer sign-off.', dated: true },
  { key: 'reconciliation', icon: 'git-compare', tone: 'green', title: 'Stock reconciliation', desc: 'Issued vs installed vs returned per technician, and where every serialised device is now.', dated: false },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function range(p: Period) {
  const now = new Date();
  if (p === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (p === 'last-month') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  const from = new Date(now);
  from.setDate(from.getDate() - Number(p) + 1);
  return { from: iso(from), to: iso(now) };
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('30');
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (key: string, dated: boolean) => {
    const { from, to } = range(period);
    const query = dated ? `?from=${from}&to=${to}` : '';
    const name = dated ? `optimas-${key}_${from}_to_${to}.xlsx` : `optimas-${key}_${iso(new Date())}.xlsx`;
    const url = `${API_URL}/exports/${key}.xlsx${query}`;
    setBusy(key);
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(url, { headers: authHeader() });
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        const href = URL.createObjectURL(await res.blob());
        const a = document.createElement('a');
        a.href = href;
        a.download = name;
        a.click();
        URL.revokeObjectURL(href);
      } else {
        const file = await File.downloadFileAsync(url, new File(Paths.cache, name), { headers: authHeader(), idempotent: true });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType: XLSX, dialogTitle: 'Share report', UTI: 'org.openxmlformats.spreadsheetml.sheet' });
        } else {
          toast.success('Report saved', file.uri);
        }
      }
    } catch (e) {
      toast.error('Export failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <PageHeader title="Reports" right={null} />
      <View style={{ gap: 6 }}>
        <Text variant="h1" style={{ fontSize: 24 }}>
          Welcome to Reports
        </Text>
        <Text variant="bodySm" color={colors.textMuted}>
          Excel workbooks for payroll and audits, all in one place. Tap a report to download it.
        </Text>
      </View>
      <View style={styles.divider} />
      <Text variant="h2">Period</Text>
      <Segmented<Period>
        options={[
          { value: '7', label: 'Last 7 days' },
          { value: '30', label: 'Last 30 days' },
          { value: 'month', label: 'This month' },
          { value: 'last-month', label: 'Last month' },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <Text variant="label" color={colors.textDim}>
        {range(period).from} → {range(period).to}
      </Text>
      <Text variant="h2" style={{ marginTop: 4 }}>
        Workbooks
      </Text>
      {REPORTS.map((r) => (
        <FeatureCard
          key={r.key}
          title={r.title}
          subtitle={r.desc}
          icon={r.icon}
          tone={r.tone}
          busy={busy === r.key}
          onPress={() => download(r.key, r.dated)}
          footer={
            <Text variant="label" color="rgba(255,255,255,0.75)" fixedColor>
              {r.dated ? 'Uses the period above · .xlsx' : 'Current snapshot · .xlsx'}
            </Text>
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});
