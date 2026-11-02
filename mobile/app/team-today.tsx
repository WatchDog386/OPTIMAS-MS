import { useState } from 'react';
import { View } from 'react-native';
import type { Attendance, Role } from '../src/api/types';
import { Avatar, Badge, EmptyState, ListRow, Reveal, Screen, ScreenHeader, SectionHeader, Segmented, Text } from '../src/components';
import { useApi } from '../src/hooks/useApi';
import { colors } from '../src/theme';
import { humanize, time } from '../src/utils/format';

type Who = { id: string; name: string; staffNo: string; role: Role };
type Show = 'TECHNICIAN' | 'ALL';

/**
 * Who is in today and who is not: for giving out jobs (customer care, supervisors). Names, times and
 * late / checked-out only; the check-in and check-out photos stay with supervisors and admins.
 */
export default function TeamToday() {
  const { data, refresh, refreshing, loading } = useApi<{ workDate: string; records: (Attendance & { user: Who })[]; absent: Who[] }>('/attendance', { poll: 60_000 });
  const [show, setShow] = useState<Show>('TECHNICIAN');
  const keep = (role: Role) => show === 'ALL' || role === show;
  const inNow = (data?.records ?? []).filter((r) => r.user && keep(r.user.role) && !r.checkOutAt);
  const left = (data?.records ?? []).filter((r) => r.user && keep(r.user.role) && r.checkOutAt);
  const absent = (data?.absent ?? []).filter((p) => keep(p.role));

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Who is in today" subtitle={`${inNow.length} in · ${absent.length} not in`} />
      <Segmented
        options={[
          { value: 'TECHNICIAN', label: 'Technicians' },
          { value: 'ALL', label: 'Everyone' },
        ]}
        value={show}
        onChange={setShow}
      />

      <SectionHeader title={`Present · ${inNow.length}`} />
      {inNow.length ? (
        <View>
          {inNow.map((r, i) => (
            <Reveal key={r.id} index={Math.min(i, 8)}>
              <ListRow
                flat
                left={<Avatar name={r.user.name} tint={colors.success} />}
                title={r.user.name}
                subtitle={`${humanize(r.user.role)} · in at ${time(r.checkInAt)}`}
                right={<Badge label={r.status === 'LATE' ? 'Late' : 'On time'} tone={r.status === 'LATE' ? 'warning' : 'success'} />}
              />
            </Reveal>
          ))}
        </View>
      ) : !loading ? (
        <Text variant="bodySm" color={colors.textMuted}>
          Nobody has checked in yet.
        </Text>
      ) : null}

      {left.length ? (
        <>
          <SectionHeader title={`Checked out · ${left.length}`} />
          <View>
            {left.map((r) => (
              <ListRow key={r.id} flat left={<Avatar name={r.user.name} tint={colors.info} />} title={r.user.name} subtitle={`${humanize(r.user.role)} · ${time(r.checkInAt)} – ${time(r.checkOutAt)}`} right={<Badge label="Out" tone="info" />} />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title={`Not in · ${absent.length}`} />
      {absent.length ? (
        <View>
          {absent.map((p) => (
            <ListRow key={p.id} flat left={<Avatar name={p.name} tint={colors.textDim} />} title={p.name} subtitle={`${humanize(p.role)} · ${p.staffNo}`} right={<Badge label="Not in" tone="neutral" />} />
          ))}
        </View>
      ) : !loading ? (
        <EmptyState icon="happy-outline" title="Everyone is in" message="All staff have checked in today." />
      ) : null}
    </Screen>
  );
}
