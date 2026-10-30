import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import { api, ApiError } from '../../src/api/client';
import type { Task, TaskPriority } from '../../src/api/types';
import { AssignPicker, Button, Glass, Input, Loading, NO_ASSIGNMENT, Screen, ScreenHeader, SectionHeader, Segmented, Text, assignmentBody, assignmentProblem, type Assignment } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { toast } from '../../src/store/feedback';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

/** Edit or reassign a job that has not started yet (to one technician or a team). Everyone affected is notified. */
export default function TaskEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApi<{ task: Task }>(`/tasks/${id}`);
  const [assign, setAssign] = useState<Assignment>(NO_ASSIGNMENT);
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [form, setForm] = useState({ title: '', description: '', customerName: '', customerPhone: '', customerAccount: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const t = data.task;
    setAssign(t.teamId ? { mode: 'team', teamId: t.teamId, newTeam: null } : { mode: 'individual', assigneeId: t.assignee.id });
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

  const moved =
    assign.mode === 'individual' ? assign.assigneeId !== t.assignee.id || !!t.teamId : !!assign.newTeam || assign.teamId !== (t.teamId ?? null);

  const save = async () => {
    const missing = assignmentProblem(assign);
    if (missing) return setError(missing);
    setBusy(true);
    setError(null);
    try {
      const body = { ...Object.fromEntries(Object.entries({ ...form, priority }).filter(([, v]) => v !== '')), ...(moved ? assignmentBody(assign) : {}) };
      await api(`/tasks/${t.id}`, { method: 'PATCH', body });
      toast.success('Job updated', moved ? 'Everyone affected has been notified.' : undefined);
      goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save job" icon="checkmark" size="lg" loading={busy} onPress={save} />}>
      <ScreenHeader title={`Edit ${t.code}`} subtitle="Change details or reassign" />
      <SectionHeader title="Assign to" />
      <AssignPicker value={assign} onChange={setAssign} />
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
