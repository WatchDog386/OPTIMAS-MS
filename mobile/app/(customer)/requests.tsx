import { router } from 'expo-router';
import type { ServiceRequest } from '../../src/api/types';
import { Badge, Button, EmptyState, Glass, Screen, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts } from '../../src/theme';
import { dateTime, humanize } from '../../src/utils/format';

const STATUS = {
  OPEN: { label: 'Received', tone: 'warning' as const },
  SCHEDULED: { label: 'Technician assigned', tone: 'success' as const },
  CLOSED: { label: 'Closed', tone: 'neutral' as const },
};

export default function Requests() {
  const { data, refresh, refreshing, loading } = useApi<{ requests: ServiceRequest[] }>('/customer/requests');
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="display" style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 }}>
        My requests
      </Text>
      <Button label="Request service" icon="add" onPress={() => router.push('/request-new')} />
      {!loading && !data?.requests.length ? <EmptyState icon="chatbubbles-outline" title="No requests yet" message="Report a fault or ask us to move your router." /> : null}
      {data?.requests.map((r) => (
        <Glass key={r.id} strong onPress={r.task ? () => router.push(`/visit/${r.task!.id}`) : undefined} style={{ gap: 8 }}>
          <Badge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
          <Text variant="h2">{humanize(r.type)}</Text>
          <Text variant="body" color={colors.textMuted}>
            {r.description}
          </Text>
          {r.task?.assignee ? (
            <Text variant="bodySm">
              Technician: <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>{r.task.assignee.name}</Text> · job {r.task.code}
            </Text>
          ) : null}
          {r.closedNote ? (
            <Text variant="bodySm" color={colors.textMuted}>
              “{r.closedNote}”
            </Text>
          ) : null}
          <Text variant="label" color={colors.textDim}>
            {dateTime(r.createdAt)}
          </Text>
        </Glass>
      ))}
    </Screen>
  );
}
