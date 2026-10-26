import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { CustomerJob } from '../../src/api/types';
import { Badge, Button, Glass, HatchedProgress, ListRow, Loading, Screen, ScreenHeader, Section, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { dateTime, duration, humanize, taskStatusTone } from '../../src/utils/format';

const STAGE: Record<string, number> = { ASSIGNED: 0.34, IN_PROGRESS: 0.67, COMPLETED: 1, VERIFIED: 1, CANCELLED: 0, REJECTED: 0.67 };

/** Customer view of one visit: progress, technician and what was installed. */
export default function Visit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, refresh, refreshing } = useApi<{ job: CustomerJob }>(`/customer/jobs/${id}`);
  const job = data?.job;
  if (!job) return <Loading />;
  const done = job.status === 'COMPLETED' || job.status === 'VERIFIED';
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={job.code} subtitle={humanize(job.type)} right={<Badge label={done ? 'Completed' : humanize(job.status)} tone={taskStatusTone[job.status]} />} />
      <Glass strong style={{ gap: 14 }}>
        <Text variant="h1" style={{ fontFamily: fonts.medium, fontSize: 24, lineHeight: 29 }}>
          {job.title}
        </Text>
        <HatchedProgress value={STAGE[job.status] ?? 0} label={done ? 'Done' : job.status === 'IN_PROGRESS' ? 'Working now' : 'Assigned'} />
        <View style={styles.times}>
          <Cell label="Assigned" value={dateTime(job.createdAt)} />
          <Cell label="Started" value={dateTime(job.startedAt)} />
          <Cell label="Finished" value={dateTime(job.endedAt)} />
        </View>
        {job.durationMinutes ? (
          <Text variant="bodySm" color={colors.textMuted}>
            Time on site: {duration(job.durationMinutes)}
          </Text>
        ) : null}
      </Glass>
      <Section title="Your technician">
        <ListRow icon="person" iconTint={colors.text} title={job.assignee.name} subtitle={job.assignee.phone ?? undefined} />
        {job.assignee.phone && !done ? <Button label={`Call ${job.assignee.name.split(' ')[0]}`} icon="call" onPress={() => call(job.assignee.phone)} /> : null}
      </Section>
      {job.materials?.length ? (
        <Section title="What was installed">
          {job.materials.map((m, i) => (
            <ListRow key={i} icon={m.unit ? 'wifi' : 'git-commit-outline'} iconTint={colors.text} title={m.item.name} subtitle={m.unit ? `S/N ${m.unit.serialNumber}` : `${m.quantity} ${m.item.unit}`} />
          ))}
        </Section>
      ) : null}
      {job.completionNotes ? (
        <Section title="Technician’s notes">
          <Text variant="body">{job.completionNotes}</Text>
          {job.signedByName ? (
            <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 8 }}>
              Signed off by {job.signedByName}
            </Text>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ times: { flexDirection: 'row', gap: 8 } });
