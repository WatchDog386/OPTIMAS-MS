import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { EmptyState, PageHeader, Screen, Text } from '../../src/components';
import { SME, SmeRow } from '../../src/components/SmeKit';
import { useApi } from '../../src/hooks/useApi';
import { fonts } from '../../src/theme';
import { kes } from '../../src/utils/format';

interface Row {
  id: string;
  tasksDone: number;
  collected: number;
  updatedAt: string;
  submittedBy: { id: string; name: string; staffNo: string };
  team: { id: string; name: string } | null;
}

const iso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

/** The office: the daily reports sent by technicians and team leaders, day by day. */
export default function DayReports() {
  const [day, setDay] = useState(() => iso(new Date()));
  const { data, refresh, refreshing, loading } = useApi<{ date: string; reports: Row[] }>(`/day-reports?date=${day}`, { poll: 60_000 });
  const move = (n: number) => setDay((d) => iso(new Date(new Date(`${d}T12:00:00+03:00`).getTime() + n * 86_400_000)));
  const today = day === iso(new Date());
  const label = new Date(`${day}T12:00:00+03:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
  const reports = data?.reports ?? [];
  const total = reports.reduce((n, r) => n + r.collected, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Daily reports" />
      <View style={styles.dayBar}>
        <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Previous day" style={styles.arrow}>
          <Ionicons name="chevron-back" size={18} color={SME.fg} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold }}>
            {today ? `Today · ${label}` : label}
          </Text>
          <Text variant="label" color={SME.fg3} fixedColor>
            {reports.length} report{reports.length === 1 ? '' : 's'} · {reports.reduce((n, r) => n + r.tasksDone, 0)} tasks · {kes(total)} paid
          </Text>
        </View>
        <Pressable onPress={() => move(1)} disabled={today} hitSlop={10} accessibilityLabel="Next day" style={[styles.arrow, today && { opacity: 0.3 }]}>
          <Ionicons name="chevron-forward" size={18} color={SME.fg} />
        </Pressable>
      </View>
      {!loading && !reports.length ? <EmptyState icon="document-text-outline" title="No reports" message={today ? 'Reports come in as technicians and team leaders finish their day.' : 'No reports were sent that day.'} /> : null}
      <View style={{ gap: 8 }}>
        {reports.map((r) => (
          <SmeRow
            key={r.id}
            icon={r.team ? 'people' : 'person'}
            title={r.team ? `${r.team.name} · ${r.submittedBy.name}` : r.submittedBy.name}
            sub={`${r.tasksDone} task${r.tasksDone === 1 ? '' : 's'} · ${kes(r.collected)} paid · sent ${new Date(r.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`}
            onPress={() => router.push(`/admin/day-report/${r.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: SME.surface },
  arrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: SME.surface3 },
});
