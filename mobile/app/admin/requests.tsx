import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { RequestStatus, ServiceRequest } from '../../src/api/types';
import { Badge, Button, EmptyState, Glass, Input, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { dateTime, humanize } from '../../src/utils/format';
import { toast } from '../../src/store/feedback';

/** Supervisor inbox of customer service requests → turn into jobs, or close with a note. */
export default function Requests() {
  const [status, setStatus] = useState<RequestStatus>('OPEN');
  const { data, refresh, refreshing, loading, reload } = useApi<{ requests: ServiceRequest[] }>(`/requests?status=${status}`);
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const close = async (r: ServiceRequest) => {
    try {
      await api(`/requests/${r.id}/close`, { body: { note } });
      toast.success('Request closed');
      setClosing(null);
      setNote('');
      await reload();
    } catch (e) {
      toast.error('Could not close', e instanceof ApiError ? e.message : 'Try again');
    }
  };

  const toJob = (r: ServiceRequest) =>
    router.push({
      pathname: '/admin/task-new',
      params: {
        requestId: r.id,
        type: r.type,
        title: `${humanize(r.type)} — ${r.customer?.name ?? 'customer'}`,
        description: r.description,
        customerName: r.customer?.name ?? '',
        customerPhone: r.phone ?? r.customer?.phone ?? '',
        customerAccount: r.customerAccount ?? r.customer?.customerAccount ?? '',
        address: r.address ?? r.customer?.address ?? '',
      },
    });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Customer requests" subtitle="Visits customers asked for" />
      <Segmented<RequestStatus>
        options={[
          { value: 'OPEN', label: 'New' },
          { value: 'SCHEDULED', label: 'Scheduled' },
          { value: 'CLOSED', label: 'Closed' },
        ]}
        value={status}
        onChange={setStatus}
      />
      {!loading && !data?.requests.length ? <EmptyState icon="chatbubbles-outline" title="Nothing here" message="New customer requests will appear here." /> : null}
      {data?.requests.map((r) => (
        <Glass key={r.id} strong style={{ gap: 10 }}>
          <View style={styles.row}>
            <Badge label={humanize(r.type)} tone="brand" dot={false} />
            <Text variant="label" color={colors.textDim}>
              {dateTime(r.createdAt)}
            </Text>
          </View>
          <Text variant="h2">{r.customer?.name}</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {[r.customerAccount, r.address ?? r.customer?.address].filter(Boolean).join(' · ')}
          </Text>
          <Text variant="body">{r.description}</Text>
          {r.task ? (
            <Text variant="bodySm">
              Job <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>{r.task.code}</Text> · {r.task.assignee?.name} · {humanize(r.task.status)}
            </Text>
          ) : null}
          {r.closedNote ? (
            <Text variant="bodySm" color={colors.textMuted}>
              Closed: “{r.closedNote}”
            </Text>
          ) : null}
          {r.status === 'OPEN' ? (
            closing === r.id ? (
              <View style={{ gap: 8 }}>
                <Input placeholder="Note for the customer (e.g. resolved remotely)" value={note} onChangeText={setNote} />
                <View style={styles.row}>
                  <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setClosing(null)} />
                  <Button label="Close request" variant="danger" style={{ flex: 1 }} disabled={note.trim().length < 3} onPress={() => close(r)} />
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                {r.phone ?? r.customer?.phone ? <Button label="Call" icon="call" variant="secondary" style={{ flex: 1 }} onPress={() => call(r.phone ?? r.customer?.phone)} /> : null}
                <Button label="Close" variant="secondary" style={{ flex: 1 }} onPress={() => setClosing(r.id)} />
                <Button label="Assign" icon="add" style={{ flex: 1.2 }} onPress={() => toJob(r)} />
              </View>
            )
          ) : null}
        </Glass>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 } });
