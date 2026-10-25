import { StyleSheet, View } from 'react-native';
import type { Attendance, Person } from '../../src/api/types';
import { Avatar, Badge, Card, ListRow, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, space } from '../../src/theme';
import { date, duration, flagLabel, time } from '../../src/utils/format';

export default function AttendanceRegister() {
  const { data, refresh, refreshing } = useApi<{ workDate: string; records: Attendance[]; absent: Person[] }>('/attendance');
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Attendance register" subtitle={data ? date(data.workDate) : undefined} />
      <SectionHeader title={`Present (${data?.records.length ?? 0})`} />
      {data?.records.map((r) => {
        const flags = [...(r.checkInPhoto?.flags ?? []), ...(r.checkOutPhoto?.flags ?? [])];
        return (
          <Card key={r.id} style={{ gap: space.md }}>
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
        <ListRow key={p.id} left={<Avatar name={p.name} tint={colors.danger} />} title={p.name} subtitle={p.staffNo} right={<Badge label="Absent" tone="danger" />} />
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
  times: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: space.md },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
