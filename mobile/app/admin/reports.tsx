import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeader } from '../../src/api/client';
import { Button, Card, Screen, ScreenHeader, SectionHeader, Segmented, Text } from '../../src/components';
import { colors, radius, space } from '../../src/theme';

type Period = '7' | '30' | 'month' | 'last-month';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const REPORTS = [
  { key: 'attendance', icon: 'calendar', tint: colors.info, title: 'Attendance & hours', desc: 'Daily check-in/out, lateness, hours worked and dress-code results, with a per-person payroll summary.', dated: true },
  { key: 'jobs', icon: 'briefcase', tint: colors.primary, title: 'Jobs & materials', desc: 'Every job with durations, devices installed, materials value, cash collected and customer sign-off.', dated: true },
  { key: 'reconciliation', icon: 'git-compare', tint: colors.warning, title: 'Stock reconciliation', desc: 'Issued vs. installed vs. returned per technician, plus the location of every serialised device right now.', dated: false },
] as const;

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
          Alert.alert('Report saved', file.uri);
        }
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Reports & exports" subtitle="Excel workbooks for payroll and audits" />
      <SectionHeader title="Period" />
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
      {REPORTS.map((r) => (
        <Card key={r.key} style={{ gap: space.md }}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: `${r.tint}22` }]}>
              <Ionicons name={r.icon} size={22} color={r.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title">{r.title}</Text>
              <Text variant="label" color={colors.textDim}>
                {r.dated ? 'Uses selected period' : 'Current snapshot'}
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={colors.textMuted}>
            {r.desc}
          </Text>
          <Button label="Download .xlsx" icon="download-outline" variant="secondary" loading={busy === r.key} onPress={() => download(r.key, r.dated)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
