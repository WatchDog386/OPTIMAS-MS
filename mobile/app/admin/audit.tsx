import { useState } from 'react';
import { api } from '../../src/api/client';
import { Button, EmptyState, ListRow, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { dateTime, humanize } from '../../src/utils/format';

interface Entry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  actor: { name: string; staffNo: string; role: string };
}

const ICON: Record<string, 'person-outline' | 'pricetags-outline' | 'briefcase-outline' | 'chatbubbles-outline' | 'wifi-outline'> = {
  User: 'person-outline',
  InventoryItem: 'pricetags-outline',
  Task: 'briefcase-outline',
  ServiceRequest: 'chatbubbles-outline',
  SerialUnit: 'wifi-outline',
};

/** Admin audit trail with filters and paging. */
export default function Audit() {
  const [entity, setEntity] = useState<string>('');
  const { data, refresh, refreshing, loading } = useApi<{ entries: Entry[] }>(`/audit?limit=50${entity ? `&entity=${entity}` : ''}`);
  const [more, setMore] = useState<Entry[]>([]);
  const [paging, setPaging] = useState(false);
  const entries = [...(data?.entries ?? []), ...more];

  const loadMore = async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setPaging(true);
    try {
      const res = await api<{ entries: Entry[] }>(`/audit?limit=50&before=${encodeURIComponent(last.createdAt)}${entity ? `&entity=${entity}` : ''}`);
      setMore((m) => [...m, ...res.entries]);
    } finally {
      setPaging(false);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setMore([]);
        refresh();
      }}
    >
      <ScreenHeader title="Audit log" subtitle="Who changed what, and when" />
      <Segmented
        options={[
          { value: '', label: 'All' },
          { value: 'User', label: 'People' },
          { value: 'InventoryItem', label: 'Stock' },
          { value: 'Task', label: 'Jobs' },
          { value: 'ServiceRequest', label: 'Requests' },
        ]}
        value={entity}
        onChange={(v) => {
          setMore([]);
          setEntity(v);
        }}
      />
      {!loading && !entries.length ? <EmptyState icon="shield-outline" title="Nothing recorded yet" message="Administrative actions appear here." /> : null}
      {entries.map((e) => (
        <ListRow key={e.id} icon={ICON[e.entity] ?? 'ellipse-outline'} iconTint={colors.text} title={e.summary} subtitle={`${humanize(e.action)} · ${e.actor.name} · ${dateTime(e.createdAt)}`} />
      ))}
      {entries.length >= 50 ? <Button label="Load older" variant="secondary" loading={paging} onPress={loadMore} /> : null}
      <Text variant="label" color={colors.textDim} align="center">
        Entries cannot be edited or deleted.
      </Text>
    </Screen>
  );
}
