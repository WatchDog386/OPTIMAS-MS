import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Task, TaskPriority } from '../../src/api/types';
import { Button, Glass, Input, Loading, Screen, ScreenHeader, SectionHeader, Segmented, TechPicker, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

/** Edit or reassign a job that has not started yet. Both technicians are notified of a reassignment. */
export default function TaskEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApi<{ task: Task }>(`/tasks/${id}`);
  const [assigneeId, setAssignee] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [form, setForm] = useState({ title: '', description: '', customerName: '', customerPhone: '', customerAccount: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const t = data.task;
    setAssignee(t.assignee.id);
    setPriority(t.priority);
    setForm({ title: t.title, description: t.description ?? '', customerName: t.customerName, customerPhone: t.customerPhone ?? '', customerAccount: t.customerAccount ?? '', address: t.address });
  }, [data]);

  if (!data) return <Loading />;
  const t = data.task;
  if (t.status !== 'ASSIGNED') {
    return (
      <Screen>
        <ScreenHeader title="Cannot edit" subtitle={`${t.code} has already started`} />
        <Text variant="body" color={colors.textMuted}>
          Only jobs that have not started can be edited or reassigned.
        </Text>
      </Screen>
    );
  }
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries({ ...form, priority, assigneeId }).filter(([, v]) => v !== '' && v !== null));
      await api(`/tasks/${t.id}`, { method: 'PATCH', body });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save job" icon="checkmark" size="lg" loading={busy} onPress={save} />}>
      <ScreenHeader title={`Edit ${t.code}`} subtitle="Change details or reassign" />
      <SectionHeader title="Technician" />
      <TechPicker value={assigneeId} onChange={setAssignee} />
      <Text variant="label" color={colors.textMuted}>
        Priority
      </Text>
      <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
      <Glass strong style={{ gap: 14 }}>
        <Input label="Title" value={form.title} onChangeText={set('title')} />
        <Input label="Details" multiline value={form.description} onChangeText={set('description')} />
        <Input label="Customer / premises" icon="person-outline" value={form.customerName} onChangeText={set('customerName')} />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" value={form.customerPhone} onChangeText={set('customerPhone')} />
        <Input label="Account no." icon="document-text-outline" autoCapitalize="characters" value={form.customerAccount} onChangeText={set('customerAccount')} />
        <Input label="Address / directions" icon="location-outline" multiline value={form.address} onChangeText={set('address')} />
        {error ? (
          <Text variant="bodySm" color={colors.danger}>
            {error}
          </Text>
        ) : null}
      </Glass>
    </Screen>
  );
}
