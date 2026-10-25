import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api/client';
import type { Attendance } from '../../src/api/types';
import { AuthImage, Badge, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, space } from '../../src/theme';
import { date, flagLabel, time } from '../../src/utils/format';

/** Dress-compliance queue: supervisors approve or reject each check-in selfie. */
export default function Reviews() {
  const { data, setData, refresh, refreshing, loading } = useApi<{ records: Attendance[] }>('/attendance/reviews/pending');
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (r: Attendance, decision: 'APPROVED' | 'REJECTED') => {
    setBusy(r.id + decision);
    try {
      await api(`/attendance/${r.id}/review`, { body: { decision, note: decision === 'REJECTED' ? 'Not in proper uniform' : undefined } });
      setData((d) => (d ? { records: d.records.filter((x) => x.id !== r.id) } : d));
    } catch (e) {
      Alert.alert('Failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Dress-code reviews" subtitle={`${data?.records.length ?? 0} pending`} />
      {!loading && !data?.records.length ? <EmptyState icon="shirt-outline" title="All caught up" message="No check-in photos waiting for review." /> : null}
      {data?.records.map((r) => (
        <Card key={r.id} style={{ gap: space.md }}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text variant="title">{r.user?.name}</Text>
              <Text variant="bodySm" color={colors.textMuted}>
                {r.user?.staffNo} · {date(r.workDate)} · in {time(r.checkInAt)}
              </Text>
            </View>
            <Badge label={r.status === 'LATE' ? 'Late' : 'On time'} tone={r.status === 'LATE' ? 'warning' : 'success'} />
          </View>
          {r.checkInPhoto ? <AuthImage photoId={r.checkInPhoto.id} /> : null}
          <View style={styles.flags}>
            {r.checkInPhoto?.flags.map((f) => <Badge key={f} label={flagLabel[f] ?? f} tone="warning" />)}
          </View>
          <View style={styles.row}>
            <Button label="Reject" variant="danger" icon="close" style={{ flex: 1 }} loading={busy === r.id + 'REJECTED'} onPress={() => decide(r, 'REJECTED')} />
            <Button label="Approve" icon="checkmark" style={{ flex: 1.4 }} loading={busy === r.id + 'APPROVED'} onPress={() => decide(r, 'APPROVED')} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
