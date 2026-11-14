import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import { Button, EmptyState, Input, Loading, Screen, ScreenHeader, Segmented, Text } from '../src/components';
import { SME } from '../src/components/SmeKit';
import { WA_GREEN } from '../src/components/TempPasswordCard';
import { useApi } from '../src/hooks/useApi';
import { celebrate, toast } from '../src/store/feedback';
import { fonts, isDark, space } from '../src/theme';
import { whatsapp } from '../src/utils/contact';
import { phoneOffline, submit as outboxSend, useOutbox } from '../src/offline/outbox';
import { apiCache } from '../src/api/cache';
import { useAuth } from '../src/store/auth';
import { CareDayReport } from '../src/components/CareDayReport';
import type { Task } from '../src/api/types';
import { humanize, kes, time } from '../src/utils/format';

interface DayTask {
  id: string;
  code: string;
  type: string;
  title: string;
  customerName: string;
  customerPhone: string | null;
  address: string;
  houseNo: string | null;
  signal: string | null;
  amountCollected: number | null;
  dropCableM: number | null;
  dropStartM: number | null;
  dropEndM: number | null;
  fatPreinstalled: boolean | null;
  completionNotes: string | null;
  status: string;
  endedAt: string | null;
  materials: string[];
}
interface Report {
  canSubmit: boolean;
  reason: string | null;
  team: { id: string; name: string } | null;
  members: { id: string; name: string; leader: boolean }[];
  text: string;
  tasksDone: number;
  collected: number;
  cable: number;
  routers: number;
  tasks: DayTask[];
}
/** A task added on the form that is not in the app. */
interface Extra {
  type: string;
  customer?: string;
  location: string;
  houseNo?: string;
  status?: string;
  signal?: string;
  paid?: number;
  materials: string[];
  cableM?: number;
  cableStart?: number;
  cableEnd?: number;
  fat?: boolean;
  notes?: string;
}
/** The form's copy of one task's report fields (strings while typing). */
type Fields = { houseNo: string; signal: string; paid: string; cable: string; markStart: string; markEnd: string; fat: 'yes' | 'no' | ''; notes: string };
/** Cable used: from the two length marks when both are filled, otherwise as typed. */
const usedFrom = (f: Fields) => (f.markStart !== '' && f.markEnd !== '' ? String(Math.round(Math.abs(Number(f.markStart) - Number(f.markEnd)) * 10) / 10) : f.cable);
type ExtraForm = Fields & { type: string; customer: string; location: string; materials: string };

const fieldsOf = (t: DayTask): Fields => ({
  houseNo: t.houseNo ?? '',
  signal: t.signal ?? '',
  paid: t.amountCollected ? String(t.amountCollected) : '',
  cable: t.dropCableM != null ? String(t.dropCableM) : '',
  markStart: t.dropStartM != null ? String(t.dropStartM) : '',
  markEnd: t.dropEndM != null ? String(t.dropEndM) : '',
  fat: t.fatPreinstalled == null ? '' : t.fatPreinstalled ? 'yes' : 'no',
  notes: t.completionNotes ?? '',
});
const emptyExtra = (): ExtraForm => ({ type: 'Installation', customer: '', location: '', houseNo: '', signal: '', paid: '', cable: '', markStart: '', markEnd: '', fat: '', notes: '', materials: '' });
const extraOf = (e: Extra): ExtraForm => ({
  type: e.type,
  customer: e.customer ?? '',
  location: e.location,
  houseNo: e.houseNo ?? '',
  signal: e.signal ?? '',
  paid: e.paid ? String(e.paid) : '',
  cable: e.cableM != null ? String(e.cableM) : '',
  markStart: e.cableStart != null ? String(e.cableStart) : '',
  markEnd: e.cableEnd != null ? String(e.cableEnd) : '',
  fat: e.fat == null ? '' : e.fat ? 'yes' : 'no',
  notes: e.notes ?? '',
  materials: e.materials.join('\n'),
});
const toExtra = (f: ExtraForm): Extra => ({
  type: f.type,
  customer: f.customer.trim() || undefined,
  location: f.location.trim(),
  houseNo: f.houseNo.trim() || undefined,
  signal: f.signal.trim() || undefined,
  paid: f.paid ? Number(f.paid) : undefined,
  materials: f.materials.split('\n').map((m) => m.trim()).filter(Boolean),
  cableM: usedFrom(f) ? Number(usedFrom(f)) : undefined,
  ...(f.markStart !== '' && f.markEnd !== '' ? { cableStart: Number(f.markStart), cableEnd: Number(f.markEnd) } : {}),
  fat: f.fat ? f.fat === 'yes' : undefined,
  notes: f.notes.trim() || undefined,
});
const num = (v: string) => v.replace(/[^0-9.]/g, '');

/** The report as the office will see it, put together on the phone when there is no signal to ask the server. */
/** A task finished on this phone with no signal: its saved details and the report waiting in the outbox. */
type OfflineDone = { code: string; type: string; address: string; customerName: string; body: Record<string, unknown> };

function offlineText(r: Report, fields: Record<string, Fields>, extras: ExtraForm[], note: string, offline: OfflineDone[] = []) {
  const lines = [`*Daily report — ${r.team ? r.team.name : 'today'}*`, `${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · made offline`];
  if (r.members.length > 1) {
    lines.push('', '*Members*');
    r.members.forEach((m, i) => lines.push(`${i + 1}. ${m.name}${m.leader ? ' (leader)' : ''}`));
  }
  const cableOf = (f: Fields) => (f.markStart !== '' && f.markEnd !== '' ? `${usedFrom(f)} m (marks ${f.markStart} → ${f.markEnd})` : f.cable ? `${f.cable} m` : 'none');
  const one = (n: number, head: string, location: string, f: Fields, materials: string[]) => {
    lines.push('', `*Task ${n} — ${head}*`, `Location: ${location}${f.houseNo ? ` · House ${f.houseNo}` : ''}`, 'Status: Complete');
    if (f.signal) lines.push(`Signal: ${f.signal}`);
    lines.push(`Client paid: ${f.paid ? `KES ${Number(f.paid).toLocaleString()}` : 'Nothing'}`);
    lines.push(materials.length ? `Materials used:\n${materials.map((m, k) => `  ${k + 1}. ${m}`).join('\n')}` : 'Materials used: none');
    lines.push(`Drop cable: ${cableOf(f)}`, `FAT pre-installed: ${f.fat === '' ? 'not recorded' : f.fat === 'yes' ? 'Yes' : 'No'}`);
    if (f.notes.trim()) lines.push(`Notes: ${f.notes.trim()}`);
  };
  r.tasks.forEach((t, i) => one(i + 1, `${t.type.charAt(0)}${t.type.slice(1).toLowerCase()} · ${t.code}`, t.address, fields[t.id] ?? fieldsOf(t), t.materials));
  offline.forEach((o, i) => {
    const b = o.body;
    const f: Fields = {
      houseNo: String(b.houseNo ?? ''),
      signal: String(b.signal ?? ''),
      paid: b.amountCollected ? String(b.amountCollected) : '',
      cable: b.dropCableM != null ? String(b.dropCableM) : '',
      markStart: b.dropStartM != null ? String(b.dropStartM) : '',
      markEnd: b.dropEndM != null ? String(b.dropEndM) : '',
      fat: b.fatPreinstalled == null ? '' : b.fatPreinstalled ? 'yes' : 'no',
      notes: '',
    };
    const rep = b.report as { found?: string; done?: string; result?: string } | undefined;
    if (rep) f.notes = [rep.found, rep.done, rep.result].filter(Boolean).join('. ');
    one(r.tasks.length + i + 1, `${o.type.charAt(0)}${o.type.slice(1).toLowerCase()} · ${o.code} (finished offline)`, o.address, f, []);
  });
  extras.forEach((e, i) => one(r.tasks.length + offline.length + i + 1, e.type, e.location, e, e.materials.split('\n').map((m) => m.trim()).filter(Boolean)));
  if (note.trim()) lines.push('', '*Comments*', note.trim());
  lines.push('', `_Made on the phone with no signal. The office's copy is put together when it arrives, with every task report._`);
  return lines.join('\n');
}
const TYPES = ['Installation', 'Repair', 'Relocation', 'Maintenance'];

/**
 * The daily report, in two steps. 1 — the report form: each task finished today with the template's
 * fields (location, house no., signal, client paid, materials, drop cable, FAT, notes), filled from the task
 * reports and correctable; tasks done outside the app can be added by hand. 2 — generate: the report in the
 * office's template, sent to the office and shareable on WhatsApp. On team tasks the leader sends it.
 */
export default function DayReport() {
  // Customer care upload the report exported from the call-centre system instead
  const care = useAuth((s) => s.user?.role === 'CUSTOMER_CARE');
  const { then } = useLocalSearchParams<{ then?: string }>();
  return care ? <CareDayReport checkingOut={then === 'checkout'} /> : <TechDayReport />;
}

function TechDayReport() {
  // Opened on the way to check out: once it is sent, carry on to the check-out
  const { then } = useLocalSearchParams<{ then?: string }>();
  const checkingOut = then === 'checkout';
  const { data, reload } = useApi<{ report: Report; sent: { id: string; at: string; tasksDone: number; extra: Extra[] } | null }>('/day-reports/mine');
  const [step, setStep] = useState<'form' | 'report'>('form');
  const [fields, setFields] = useState<Record<string, Fields>>({});
  const [extras, setExtras] = useState<ExtraForm[]>([]);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<Report | null>(null);
  const [busy, setBusy] = useState<'gen' | 'send' | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Tasks finished today with no signal: still on this phone, so not in the office's list yet
  const outbox = useOutbox();
  const finishedOffline = outbox.filter((i) => i.state !== 'sent' && /\/tasks\/[^/]+\/complete$/.test(i.path));
  const doneOffline = finishedOffline.length;

  // Fill the form once from the task reports (and the hand-added tasks of a report already sent today)
  useEffect(() => {
    if (!data || loaded) return;
    setFields(Object.fromEntries(data.report.tasks.map((t) => [t.id, fieldsOf(t)])));
    setExtras((data.sent?.extra ?? []).map(extraOf));
    setLoaded(true);
  }, [data, loaded]);

  if (!data) return <Loading />;
  const r = data.report;
  const memberOnly = !r.canSubmit && !r.tasks.length && !!r.reason && /leads/.test(r.reason);

  const setField = (id: string, k: keyof Fields, v: string) => setFields((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));
  const setExtra = (i: number, k: keyof ExtraForm, v: string) => setExtras((l) => l.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const generate = async () => {
    const bad = extras.findIndex((e) => e.location.trim().length < 2);
    if (bad >= 0) return toast.warning('Where was it?', `Fill in the location of added task ${bad + 1}.`);
    if (!r.tasks.length && !extras.length && !doneOffline) return toast.warning('Nothing to report', 'Finish a task in the app, or add one with "Add a task".');
    setBusy('gen');
    let corrected = false;
    try {
      // Save corrections to today's tasks first, so the report and the tasks agree
      for (const t of r.tasks) {
        const f = fields[t.id];
        const was = fieldsOf(t);
        if (!f || JSON.stringify(f) === JSON.stringify(was)) continue;
        corrected = true;
        await outboxSend(
          `/day-reports/tasks/${t.id}`,
          {
            houseNo: f.houseNo.trim() || null,
            signal: f.signal.trim() || null,
            amountCollected: f.paid ? Number(f.paid) : null,
            dropCableM: usedFrom(f) ? Number(usedFrom(f)) : null,
            dropStartM: f.markStart !== '' && f.markEnd !== '' ? Number(f.markStart) : null,
            dropEndM: f.markStart !== '' && f.markEnd !== '' ? Number(f.markEnd) : null,
            fatPreinstalled: f.fat ? f.fat === 'yes' : null,
            ...(f.notes.trim().length >= 5 && f.notes !== was.notes ? { completionNotes: f.notes.trim() } : {}),
          },
          { label: `Report details for ${t.code}`, method: 'PATCH', taskId: t.id },
        );
      }
      // No signal: the report is put together on the phone; the office's copy is built when it arrives
      let res: { report: Report } | null = null;
      if (!phoneOffline()) {
        try {
          res = await api<{ report: Report }>('/day-reports/preview', { body: { note: note.trim() || undefined, extra: extras.map(toExtra) } });
        } catch (e) {
          if (!(e instanceof ApiError && e.code === 'NETWORK')) throw e;
        }
      }
      const offline: OfflineDone[] = finishedOffline.map((i) => {
        const t = (apiCache.get(`/tasks/${i.taskId}`)?.data as { task?: Task } | undefined)?.task;
        return { code: t?.code ?? i.label.replace(/^Completed task (\S+).*$/, '$1'), type: t?.type ?? 'TASK', address: t?.address ?? '', customerName: t?.customerName ?? '', body: i.body ?? {} };
      });
      const offlinePaid = offline.reduce((n, o) => n + Number(o.body.amountCollected ?? 0), 0);
      const offlineCable = offline.reduce((n, o) => n + Number(o.body.dropCableM ?? 0), 0);
      setPreview(
        res && !corrected && !offline.length
          ? res.report
          : { ...r, text: offlineText(r, fields, extras, note, offline), tasksDone: r.tasks.length + offline.length + extras.length, collected: r.collected + offlinePaid, cable: r.cable + offlineCable },
      );
      setStep('report');
    } catch (e) {
      toast.error('Could not generate', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy('send');
    try {
      const sent = await outboxSend('/day-reports', { note: note.trim() || undefined, extra: extras.map(toExtra) }, { label: r.team ? `Daily report for ${r.team.name}` : 'Daily report' });
      if (sent.queued) celebrate('Report saved', 'It is on this phone and goes to the office by itself as soon as you are back online.');
      else celebrate('Report sent', r.team ? `${r.team.name}'s report is with the office.` : 'Your report is with the office.');
      if (checkingOut) return void router.replace('/check-in?mode=out&go=1');
      await reload();
    } catch (e) {
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  if (memberOnly) {
    return (
      <Screen>
        <ScreenHeader title="Daily report" subtitle="Your tasks today" />
        <EmptyState icon="document-text-outline" title="Nothing to send" message={r.reason!} />
      </Screen>
    );
  }

  const shown = preview ?? r;
  return (
    <Screen
      footer={
        step === 'form' ? (
          <Button label="Generate report" icon="document-text" size="lg" loading={busy === 'gen'} disabled={!!busy} onPress={generate} />
        ) : (
          <View style={{ gap: space.sm }}>
            <Button label={data.sent ? 'Send updated report' : 'Send to the office'} icon="send" size="lg" loading={busy === 'send'} disabled={!!busy} onPress={send} />
            <Button label="Share on WhatsApp" icon="logo-whatsapp" onPress={() => void whatsapp(null, shown.text)} style={{ backgroundColor: WA_GREEN, borderColor: WA_GREEN }} textColor="#FFFFFF" />
          </View>
        )
      }
    >
      <ScreenHeader title="Daily report" subtitle={r.team ? `${r.team.name} · you send it as team leader` : 'Your tasks today'} />
      {checkingOut ? (
        <View style={styles.sent}>
          <Ionicons name="log-out-outline" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
          <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, flex: 1 }}>
            Before you check out: fill in the form, generate the report and send it. The check-out photo comes next.
          </Text>
        </View>
      ) : null}

      <View style={styles.steps}>
        <StepPill n={1} label="Report form" on={step === 'form'} onPress={() => setStep('form')} />
        <Ionicons name="chevron-forward" size={14} color={SME.fg4} />
        <StepPill n={2} label="Report" on={step === 'report'} onPress={preview ? () => setStep('report') : undefined} />
      </View>

      {data.sent ? (
        <View style={styles.sent}>
          <Ionicons name="checkmark-circle" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
          <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, flex: 1 }}>
            Sent at {new Date(data.sent.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })} · {data.sent.tasksDone} task{data.sent.tasksDone === 1 ? '' : 's'}. Changed something? Generate and send again.
          </Text>
        </View>
      ) : null}

      {step === 'form' ? (
        <>
          {r.team ? (
            <View style={styles.card}>
              <Text variant="title" color={SME.fg} fixedColor style={styles.cardTitle}>
                {r.team.name}
              </Text>
              <Text variant="label" color={SME.fg3} fixedColor>
                Members
              </Text>
              {r.members.map((m, i) => (
                <Text key={m.id} variant="bodySm" color={SME.fg2} fixedColor>
                  {i + 1}. {m.name}
                  {m.leader ? ' (leader)' : ''}
                </Text>
              ))}
            </View>
          ) : null}

          {finishedOffline.length ? (
            <View style={styles.sent}>
              <Ionicons name="time-outline" size={18} color={SME.fg3} />
              <Text variant="bodySm" color={SME.fg2} fixedColor style={{ flex: 1 }}>
                Finished with no signal, waiting on this phone: {finishedOffline.map((i) => i.label.replace(/^Completed task (\S+).*$/, '$1')).join(', ')}. They reach the office first and are put in this report with their task reports.
              </Text>
            </View>
          ) : null}

          {r.tasks.map((t, i) => {
            const f = fields[t.id] ?? fieldsOf(t);
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text variant="title" color={SME.fg} fixedColor style={[styles.cardTitle, { flex: 1 }]}>
                    Task {i + 1} — {humanize(t.type)}
                  </Text>
                  <Text variant="label" color={SME.fg4} fixedColor>
                    {t.code}
                  </Text>
                </View>
                <Text variant="bodySm" color={SME.fg2} fixedColor>
                  {t.customerName} · {t.address}
                </Text>
                <Text variant="label" color={SME.fg3} fixedColor>
                  Status: Complete{t.endedAt ? ` at ${time(t.endedAt)}` : ''}
                </Text>
                <TemplateFields f={f} on={(k, v) => setField(t.id, k, v)} />
                <Text variant="label" color={SME.fg3} fixedColor style={{ marginTop: 4 }}>
                  Materials used (from the task)
                </Text>
                {t.materials.length ? (
                  t.materials.map((m, k) => (
                    <Text key={k} variant="bodySm" color={SME.fg2} fixedColor>
                      {k + 1}. {m}
                    </Text>
                  ))
                ) : (
                  <Text variant="bodySm" color={SME.fg4} fixedColor>
                    None recorded
                  </Text>
                )}
              </View>
            );
          })}

          {extras.map((e, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardHead}>
                <Text variant="title" color={SME.fg} fixedColor style={[styles.cardTitle, { flex: 1 }]}>
                  Task {r.tasks.length + i + 1} — added
                </Text>
                <Pressable onPress={() => setExtras((l) => l.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel="Remove this task">
                  <Ionicons name="trash-outline" size={18} color={SME.fg3} />
                </Pressable>
              </View>
              <Segmented options={TYPES.map((x) => ({ value: x, label: x }))} value={e.type} onChange={(v) => setExtra(i, 'type', v)} />
              <Input label="Customer" icon="person-outline" value={e.customer} onChangeText={(v) => setExtra(i, 'customer', v)} />
              <Input label="Location" icon="location-outline" value={e.location} onChangeText={(v) => setExtra(i, 'location', v)} placeholder="e.g. Kware, Terena Apartments" />
              <TemplateFields f={e} on={(k, v) => setExtra(i, k, v)} />
              <Input label="Materials used (one per line)" multiline value={e.materials} onChangeText={(v) => setExtra(i, 'materials', v)} placeholder={'1 ATB\n1 patch cord\n1 router'} />
            </View>
          ))}

          <Button label="Add a task not in the app" icon="add-circle-outline" variant="secondary" onPress={() => setExtras((l) => [...l, emptyExtra()])} />
          <Input label="Comments for the office (optional)" multiline value={note} onChangeText={setNote} placeholder="Anything else the office should know" />
          {!r.tasks.length && !extras.length ? (
            <Text variant="bodySm" color={SME.fg3} fixedColor style={{ textAlign: 'center' }}>
              No tasks finished in the app today. Add the tasks you did, or open your tasks.
            </Text>
          ) : null}
          <Button label="Open my tasks" icon="briefcase-outline" variant="ghost" onPress={() => router.push('/jobs')} />
        </>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label="Tasks done" value={String(shown.tasksDone)} />
            <Stat label="Client paid" value={kes(shown.collected)} />
            <Stat label="Drop cable" value={`${shown.cable} m`} />
          </View>
          <View style={styles.card}>
            <ReportText text={shown.text} />
          </View>
          <Button label="Back to the form" icon="create-outline" variant="ghost" onPress={() => setStep('form')} />
        </>
      )}
    </Screen>
  );
}

/** The template's fields for one task: house no., signal, client paid, drop cable, FAT, notes. */
function TemplateFields({ f, on }: { f: Fields; on: (k: keyof Fields, v: string) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Input label="House no." value={f.houseNo} onChangeText={(v) => on('houseNo', v)} placeholder="D3" autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Signal" value={f.signal} onChangeText={(v) => on('signal', v)} placeholder="-27 dBm" />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Input label="Client paid (KES)" keyboardType="number-pad" value={f.paid} onChangeText={(v) => on('paid', v.replace(/\D/g, ''))} placeholder="0" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Drop cable (m)" keyboardType="decimal-pad" value={usedFrom(f)} onChangeText={(v) => on('cable', num(v))} placeholder="0" />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <Input label="Cable mark before" keyboardType="decimal-pad" value={f.markStart} onChangeText={(v) => on('markStart', num(v))} placeholder="e.g. 1240" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Cable mark after" keyboardType="decimal-pad" value={f.markEnd} onChangeText={(v) => on('markEnd', num(v))} placeholder="e.g. 1210" />
        </View>
      </View>
      <Text variant="label" color={SME.fg3} fixedColor>
        FAT pre-installed?
      </Text>
      <Segmented options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} value={(f.fat || '') as 'yes'} onChange={(v) => on('fat', v)} />
      <Input label="Notes" multiline value={f.notes} onChangeText={(v) => on('notes', v)} placeholder="What was done" />
    </View>
  );
}

function StepPill({ n, label, on, onPress }: { n: number; label: string; on: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.step, on && styles.stepOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Text variant="label" color={on ? '#FFFFFF' : SME.fg3} fixedColor style={{ fontFamily: fonts.semibold }}>
        {n}. {label}
      </Text>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold }}>
        {value}
      </Text>
      <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/** The report as it reads on WhatsApp: *bold* lines shown bold, the rest as written. */
export function ReportText({ text }: { text: string }) {
  return (
    <View style={{ gap: 2 }}>
      {text.split('\n').map((line, i) => {
        const bold = /^\*.*\*/.test(line.trim());
        const clean = line.replace(/\*/g, '');
        return (
          <Text key={i} variant="bodySm" color={bold ? SME.fg : SME.fg2} fixedColor style={[{ fontSize: 13, lineHeight: 19 }, bold && { fontFamily: fonts.semibold, fontSize: 14, marginTop: i ? 4 : 0 }, !clean.trim() && { height: 6 }]}>
            {clean}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: SME.surface },
  stepOn: { backgroundColor: '#2DA043' },
  sent: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#E3F4EA' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 14, backgroundColor: SME.surface },
  card: { gap: 8, padding: 16, borderRadius: 16, backgroundColor: SME.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontFamily: fonts.semibold },
  pair: { flexDirection: 'row', gap: 10 },
});
