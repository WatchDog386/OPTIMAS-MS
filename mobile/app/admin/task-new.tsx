import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Task, TaskPriority, TaskType } from '../../src/api/types';
import { AssignPicker, Button, Input, NO_ASSIGNMENT, Screen, ScreenHeader, SectionHeader, Segmented, Text, assignmentBody, assignmentProblem, type Assignment } from '../../src/components';
import { colors, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

const TYPES: { value: TaskType; label: string }[] = [
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'REPAIR', label: 'Repair' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'RELOCATION', label: 'Relocation' },
  { value: 'SURVEY', label: 'Survey' },
];
const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];
const DUE = [
  { value: '2', label: 'In 2 hrs' },
  { value: '4', label: 'In 4 hrs' },
  { value: 'eod', label: 'End of day' },
  { value: 'tomorrow', label: 'Tomorrow' },
];

const dueDate = (v: string) => {
  const d = new Date();
  if (v === 'eod') d.setHours(17, 0, 0, 0);
  else if (v === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
  } else d.setHours(d.getHours() + Number(v));
  return d.toISOString();
};

export default function NewTask() {
  // Optional pre-fill when turning a customer request into a job.
  const p = useLocalSearchParams<{ requestId?: string; type?: TaskType; title?: string; description?: string; customerName?: string; customerPhone?: string; customerAccount?: string; address?: string }>();
  const [assign, setAssign] = useState<Assignment>(NO_ASSIGNMENT);
  const [type, setType] = useState<TaskType>(p.type ?? 'INSTALLATION');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [due, setDue] = useState('eod');
  const [form, setForm] = useState({
    title: p.title ?? '',
    description: p.description ?? '',
    customerName: p.customerName ?? '',
    customerPhone: p.customerPhone ?? '',
    customerAccount: p.customerAccount ?? '',
    address: p.address ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const missing = assignmentProblem(assign);
    if (missing) return toast.warning(missing);
    setBusy(true);
    try {
      const { task } = await api<{ task: Task }>('/tasks', {
        body: {
          ...Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== '')),
          type,
          priority,
          ...assignmentBody(assign),
          requestId: p.requestId || undefined,
          dueAt: dueDate(due),
        },
      });
      toast.success('Job created', assign.mode === 'team' ? 'Everyone in the team has been notified.' : 'The technician has been notified.');
      router.replace(`/task/${task.id}`);
    } catch (e) {
      toast.error('Could not create job', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Create & assign job" icon="send" size="lg" loading={busy} onPress={submit} />}>
      <ScreenHeader title="New job" subtitle={p.requestId ? 'From a customer request · the customer is notified too' : 'The technician is notified in their app'} />
      <SectionHeader title="Assign to" />
      <AssignPicker value={assign} onChange={setAssign} />
      <SectionHeader title="Job" />
      <Segmented options={TYPES} value={type} onChange={setType} />
      <Input label="Title" value={form.title} onChangeText={set('title')} placeholder="e.g. New fibre installation — 20 Mbps" />
      <Input label="Details (optional)" multiline value={form.description} onChangeText={set('description')} />
      <Text variant="label" color={colors.textMuted}>
        Priority
      </Text>
      <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
      <Text variant="label" color={colors.textMuted}>
        Due
      </Text>
      <Segmented options={DUE} value={due} onChange={setDue} />
      <SectionHeader title="Customer" />
      <View style={{ gap: space.md }}>
        <Input label="Customer / premises" icon="person-outline" value={form.customerName} onChangeText={set('customerName')} />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" value={form.customerPhone} onChangeText={set('customerPhone')} />
        <Input label="Account no." icon="document-text-outline" autoCapitalize="characters" value={form.customerAccount} onChangeText={set('customerAccount')} />
        <Input label="Address / directions" icon="location-outline" multiline value={form.address} onChangeText={set('address')} />
      </View>
    </Screen>
  );
}
