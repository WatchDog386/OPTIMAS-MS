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
];
/** On a later day: by when on that day. */
const DUE_LATER = [
  { value: '10', label: 'Morning' },
  { value: '13', label: 'Midday' },
  { value: '17', label: 'End of day' },
];

/** Today, tomorrow and the next two weeks (Nairobi dates), for "When". */
function nextDays() {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const value = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'Africa/Nairobi' });
    out.push({ value, label });
  }
  return out;
}

/** When it is due: hours from now (today), or a time on the chosen later day (Nairobi time). */
const dueDate = (v: string, day: string, today: string) => {
  if (day !== today) return new Date(`${day}T${v.padStart(2, '0')}:00:00+03:00`).toISOString();
  const d = new Date();
  if (v === 'eod') return new Date(`${day}T17:00:00+03:00`).toISOString();
  d.setHours(d.getHours() + Number(v));
  return d.toISOString();
};

export default function NewTask() {
  // Optional pre-fill when turning a customer request into a job.
  const care = isCare(useAuth((s) => s.user?.role));
  const p = useLocalSearchParams<{ requestId?: string; type?: TaskType; title?: string; description?: string; customerName?: string; customerPhone?: string; customerAccount?: string; address?: string }>();
  const [assign, setAssign] = useState<Assignment>(NO_ASSIGNMENT);
  const [type, setType] = useState<TaskType>(p.type ?? 'INSTALLATION');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const days = nextDays();
  const today = days[0].value;
  const [day, setDay] = useState(today);
  const [due, setDue] = useState('eod');
  const laterDay = day !== today;
  const pickDay = (v: string) => {
    setDay(v);
    // Due options differ for today and for a later day
    setDue(v === today ? 'eod' : '10');
  };
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
          dueAt: dueDate(due, day, today),
          ...(laterDay ? { scheduledFor: day } : {}),
        },
      });
      const forDay = days.find((d) => d.value === day)?.label;
      toast.success(
        later ? 'Task saved' : laterDay ? `Task for ${forDay}` : 'Task created',
        later
          ? `Assign it from Tasks → To assign${laterDay ? ` (it shows there from ${forDay})` : ' when the technicians are in'}.`
          : laterDay
            ? `${assign.mode === 'team' ? 'The team is' : 'The technician is'} told on the morning of ${forDay}.`
            : assign.mode === 'team'
              ? 'Everyone in the team has been notified.'
              : 'The technician has been notified.',
      );
      router.replace(`/task/${task.id}`);
    } catch (e) {
      toast.error('Could not create task', e instanceof ApiError ? e.message : 'Try again');
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
        Not sure who yet? Tap Create task to save it and assign it later.
      </Text>
      <AssignPicker value={assign} onChange={setAssign} allowNewTeam={!care} />
    </>
  );

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Create task" icon="save-outline" variant="outline" size="lg" loading={busy === 'later'} disabled={!!busy} onPress={() => submit(true)} style={{ flex: 1 }} />
          <Button label="Create & assign" icon="send" size="lg" loading={busy === 'now'} disabled={!!busy} onPress={() => submit(false)} style={{ flex: 1.3 }} />
        </View>
      }
    >
      <ScreenHeader
        title="New task"
        subtitle={p.requestId ? 'From a customer request · the customer is notified too' : care ? 'From a customer call · the technician is notified in their app' : 'The technician is notified in their app'}
      />
      {care ? customer : assignTo}
      <SectionHeader title={care ? 'Issue' : 'Task'} />
      <Segmented options={TYPES} value={type} onChange={setType} />
      <Input label={care ? 'Issue' : 'Title'} value={form.title} onChangeText={set('title')} placeholder={care ? 'e.g. No internet since morning, red LOS light' : 'e.g. New fibre installation — 20 Mbps'} />
      <Input label="Details (optional)" multiline value={form.description} onChangeText={set('description')} />
      <Text variant="label" color={colors.textMuted}>
        {care ? 'Level of urgency' : 'Priority'}
      </Text>
      <Segmented options={PRIORITIES} value={priority} onChange={setPriority} />
      <Text variant="label" color={colors.textMuted}>
        When
      </Text>
      <Segmented options={days} value={day} onChange={pickDay} />
      {laterDay ? (
        <Text variant="bodySm" color={colors.textMuted}>
          The technician sees this task, and is told about it, on the morning of {days.find((d) => d.value === day)?.label}.
        </Text>
      ) : null}
      <Text variant="label" color={colors.textMuted}>
        Due
      </Text>
      <Segmented options={laterDay ? DUE_LATER : DUE} value={due} onChange={setDue} />
      {care ? assignTo : customer}
    </Screen>
  );
}
