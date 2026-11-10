import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Task, TaskPriority, TaskType } from '../../src/api/types';
import { AssignPicker, Button, Input, NO_ASSIGNMENT, Screen, ScreenHeader, SectionHeader, Segmented, Text, assignmentBody, assignmentProblem, type Assignment } from '../../src/components';
import { colors, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';
import { isCare, useAuth } from '../../src/store/auth';

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
  const care = isCare(useAuth((s) => s.user?.role));
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
  const [busy, setBusy] = useState<'later' | 'now' | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** `later`: save the job now and give it to a technician or team later (e.g. in the morning). */
  const submit = async (later = false) => {
    if (care) {
      // Customer care takes the call: these are what the technician needs to find and fix it
      const need = !form.customerName.trim() ? 'the customer\'s name' : !form.title.trim() ? 'the issue' : !form.customerPhone.trim() ? 'a phone number' : !form.address.trim() ? 'the location' : null;
      if (need) return toast.warning(`Add ${need}`);
    }
    const missing = later ? null : assignmentProblem(assign);
    if (missing) return toast.warning(missing);
    setBusy(later ? 'later' : 'now');
    try {
      const { task } = await api<{ task: Task }>('/tasks', {
        body: {
          ...Object.fromEntries(Object.entries(form).filter(([k, v]) => v.trim() !== '' && !(k === 'customerAccount' && type === 'INSTALLATION'))),
          type,
          priority,
          ...(later ? { assignLater: true } : assignmentBody(assign)),
          requestId: p.requestId || undefined,
          dueAt: dueDate(due),
        },
      });
      toast.success(
        later ? 'Job saved' : 'Job created',
        later ? 'Assign it from Jobs → To assign when the technicians are in.' : assign.mode === 'team' ? 'Everyone in the team has been notified.' : 'The technician has been notified.',
      );
      router.replace(`/task/${task.id}`);
    } catch (e) {
      toast.error('Could not create job', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const customer = (
    <>
      <SectionHeader title="Customer" />
      <View style={{ gap: space.md }}>
        <Input label="Customer / premises" icon="person-outline" value={form.customerName} onChangeText={set('customerName')} />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" value={form.customerPhone} onChangeText={set('customerPhone')} />
        {/* A new installation has no account number yet: it is given once the customer is connected */}
        {type === 'INSTALLATION' ? null : <Input label="Account no." icon="document-text-outline" autoCapitalize="characters" value={form.customerAccount} onChangeText={set('customerAccount')} />}
        <Input label={care ? 'Location' : 'Address / directions'} icon="location-outline" multiline value={form.address} onChangeText={set('address')} placeholder={care ? 'Estate, road, building, house no.' : undefined} />
      </View>
    </>
  );
  const assignTo = (
    <>
      <SectionHeader title="Assign to" />
      <Text variant="bodySm" color={colors.textMuted}>
        Not sure who yet? Tap Create job to save it and assign it later.
      </Text>
      <AssignPicker value={assign} onChange={setAssign} allowNewTeam={!care} />
    </>
  );

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Create job" icon="save-outline" variant="outline" size="lg" loading={busy === 'later'} disabled={!!busy} onPress={() => submit(true)} style={{ flex: 1 }} />
          <Button label="Create & assign" icon="send" size="lg" loading={busy === 'now'} disabled={!!busy} onPress={() => submit(false)} style={{ flex: 1.3 }} />
        </View>
      }
    >
      <ScreenHeader
        title="New job"
        subtitle={p.requestId ? 'From a customer request · the customer is notified too' : care ? 'From a customer call · the technician is notified in their app' : 'The technician is notified in their app'}
      />
      {care ? customer : assignTo}
      <SectionHeader title={care ? 'Issue' : 'Job'} />
      <Segmented options={TYPES} value={type} onChange={setType} />
      <Input label={care ? 'Issue' : 'Title'} value={form.title} onChangeText={set('title')} placeholder={care ? 'e.g. No internet since morning, red LOS light' : 'e.g. New fibre installation — 20 Mbps'} />
      <Input label="Details (optional)" multiline value={form.description} onChangeText={set('description')} />
      <Text variant="label" color={colors.textMuted}>
        {care ? 'Level of urgency' : 'Priority'}
      </Text>
      <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
      <Text variant="label" color={colors.textMuted}>
        Due
      </Text>
      <Segmented options={DUE} value={due} onChange={setDue} />
      {care ? assignTo : customer}
    </Screen>
  );
}
