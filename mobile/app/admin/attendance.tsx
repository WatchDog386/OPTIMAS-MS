import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Attendance, Person } from '../../src/api/types';
import { Avatar, Badge, Button, Card, GlassCircle, ListRow, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { Ionicons } from '@expo/vector-icons';
import { useApi } from '../../src/hooks/useApi';
import { colors, space } from '../../src/theme';
import { date, duration, flagLabel, time } from '../../src/utils/format';

export default function AttendanceRegister() {
  const [offset, setOffset] = useState(0); // days back from today
  const day = new Date();
  day.setDate(day.getDate() - offset);
  const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const { data, refresh, refreshing } = useApi<{ workDate: string; records: Attendance[]; absent: Person[] }>(`/attendance?date=${iso}`);
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Attendance register" subtitle={offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : date(day.toISOString())} />
      <View style={styles.dayNav}>
        <GlassCircle onPress={() => setOffset((o) => o + 1)} label="Previous day">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </GlassCircle>
        <Text variant="title">{date(day.toISOString())}</Text>
        <GlassCircle onPress={offset ? () => setOffset((o) => Math.max(0, o - 1)) : undefined} label="Next day">
          <Ionicons name="chevron-forward" size={20} color={offset ? colors.text : colors.textDim} />
        </GlassCircle>
      </View>
      {offset ? <Button label="Back to today" variant="ghost" onPress={() => setOffset(0)} /> : null}
      <SectionHeader title={`Present (${data?.records.length ?? 0})`} />
      {data?.records.map((r) => {
        const flags = [...(r.checkInPhoto?.flags ?? []), ...(r.checkOutPhoto?.flags ?? [])];
        return (
          <Card key={r.id} style={{ gap: space.md }} onPress={() => router.push(`/admin/user/${r.userId}`)}>
            <View style={styles.row}>
              <Avatar name={r.user?.name ?? '?'} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{r.user?.name}</Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  {r.user?.staffNo}
                </Text>
              </View>
              <Badge label={r.status === 'LATE' ? 'Late' : 'On time'} tone={r.status === 'LATE' ? 'warning' : 'success'} />
            </View>
            <View style={styles.times}>
              <Cell label="In" value={time(r.checkInAt)} />
              <Cell label="Out" value={time(r.checkOutAt)} />
              <Cell label="Worked" value={duration(r.workedMinutes)} />
              <Cell label="Dress" value={r.dressReview === 'PENDING' ? 'Pending' : r.dressReview === 'APPROVED' ? 'OK' : 'Rejected'} />
            </View>
            {flags.length ? (
              <View style={styles.flags}>
                {[...new Set(flags)].map((f) => (
                  <Badge key={f} label={flagLabel[f] ?? f} tone="warning" />
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
      <SectionHeader title={`Not checked in (${data?.absent.length ?? 0})`} />
      {data?.absent.map((p) => (
        <ListRow key={p.id} left={<Avatar name={p.name} tint={colors.danger} />} title={p.name} subtitle={p.staffNo} right={<Badge label="Absent" tone="danger" />} onPress={() => router.push(`/admin/user/${p.id}`)} />
      ))}
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="title">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  times: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: space.md },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
