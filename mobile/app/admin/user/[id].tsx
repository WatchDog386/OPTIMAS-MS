import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../../src/api/client';
import type { Attendance, TaskStatus, TaskType, User } from '../../../src/api/types';
import { Badge, Button, Glass, Loading, Pill, Screen, ScreenHeader, Section, SectionRow, StatGrid, StatTile, TempPasswordCard, Text } from '../../../src/components';
import { useApi } from '../../../src/hooks/useApi';
import { useAuth } from '../../../src/store/auth';
import { colors, fonts } from '../../../src/theme';
import { confirmAction, notice } from '../../../src/utils/confirm';
import { call } from '../../../src/utils/contact';
import { date, dateTime, duration, humanize, kes, taskStatusTone, taskTypeIcon, time } from '../../../src/utils/format';

interface Profile {
  user: User;
  stats: { daysPresent30: number; lateDays30: number; hoursWorked30: number; dressRejected30: number; tasks: Partial<Record<TaskStatus, number>>; avgJobMinutes: number; amountCollected: number };
  attendance: Attendance[];
  recentTasks: { id: string; code: string; title: string; status: TaskStatus; type: TaskType; customerName: string; endedAt: string | null; durationMinutes: number | null }[];
  custody: { units: { id: string; serialNumber: string; status: string; heldSince: string | null; item: { name: string } }[]; bulk: { name: string; unit: string; quantity: number }[] };
  lastCount: { createdAt: string; missing: string[] } | null;
}

/** Person profile for supervisors: performance, attendance, jobs, custody and account actions. */
export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const actor = useAuth((s) => s.user)!;
  const { data, refresh, refreshing, reload } = useApi<Profile>(`/users/${id}`);
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (!data) return <Loading />;
  const u = data.user;
  const customer = u.role === 'CUSTOMER';
  const tech = u.role === 'TECHNICIAN';
  const canManage = actor.role === 'ADMIN' || (actor.role === 'SUPERVISOR' && (tech || customer));
  const self = actor.id === u.id;
  const done = (data.stats.tasks.COMPLETED ?? 0) + (data.stats.tasks.VERIFIED ?? 0);
  const open = (data.stats.tasks.ASSIGNED ?? 0) + (data.stats.tasks.IN_PROGRESS ?? 0);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      notice('Not possible', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const reset = () =>
    run('reset', async () => {
      if (!(await confirmAction('Reset password', `${u.name} will get a new one-time password and must choose their own at next sign-in.`, 'Reset'))) return;
      setTemp((await api<{ temporaryPassword: string }>(`/users/${u.id}/reset-password`, { body: {} })).temporaryPassword);
      await reload();
    });

  const toggleActive = () =>
    run('active', async () => {
      const deactivate = u.active;
      if (deactivate && !(await confirmAction('Deactivate account', `${u.name} will no longer be able to sign in. History is kept.`, 'Deactivate'))) return;
      await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !deactivate } });
      await reload();
    });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={u.name} subtitle={customer ? `Customer · ${u.customerAccount}` : `${u.staffNo} · ${humanize(u.role)}`} right={!u.active ? <Badge label="Deactivated" tone="danger" /> : u.mustChangePassword ? <Badge label="Awaiting first sign-in" tone="info" /> : undefined} />

      <Glass strong style={{ gap: 6 }}>
        {u.phone ? <Row label="Phone" value={u.phone} /> : null}
        {u.email ? <Row label="Email" value={u.email} /> : null}
        {u.region ? <Row label="Region" value={u.region} /> : null}
        {u.address ? <Row label="Address" value={u.address} /> : null}
        <Row label="Last sign-in" value={u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'} />
        <Row label="Account created" value={date(u.createdAt)} />
        {u.phone ? <Button label="Call" icon="call" variant="secondary" onPress={() => call(u.phone)} style={{ marginTop: 8 }} /> : null}
      </Glass>

      {temp ? <TempPasswordCard loginId={u.staffNo} password={temp} name={u.name} /> : null}

      {tech ? (
        <>
          <StatGrid>
            <StatTile icon="calendar" label="Days present (30d)" value={data.stats.daysPresent30} hint={data.stats.lateDays30 ? `${data.stats.lateDays30} late` : undefined} tint={colors.info} />
            <StatTile icon="time-outline" label="Hours worked (30d)" value={data.stats.hoursWorked30} tint={colors.accent} />
            <StatTile icon="checkmark-done" label="Jobs completed" value={done} hint={open ? `${open} open` : undefined} tint={colors.success} />
            <StatTile icon="timer-outline" label="Avg. job time" value={duration(data.stats.avgJobMinutes)} hint={data.stats.dressRejected30 ? `${data.stats.dressRejected30} dress rejections` : undefined} tint={colors.warning} />
          </StatGrid>

          <Section title="In custody" subtitle={data.lastCount ? `Last stock count ${dateTime(data.lastCount.createdAt)}${data.lastCount.missing.length ? ` · ${data.lastCount.missing.length} missing` : ''}` : 'No stock count yet'}>
            {data.custody.units.length || data.custody.bulk.length ? (
              <>
                {data.custody.units.map((x) => (
                  <SectionRow key={x.id} icon="wifi" tint={colors.text} tintBg={colors.highlight} title={x.item.name} subtitle={`S/N ${x.serialNumber}${x.heldSince ? ` · since ${date(x.heldSince)}` : ''}`} right={<Pill label={x.status === 'IN_TRANSIT' ? 'Unconfirmed' : 'In hand'} tone={x.status === 'IN_TRANSIT' ? 'warning' : 'neutral'} />} onPress={() => router.push(`/admin/unit?serial=${encodeURIComponent(x.serialNumber)}`)} />
                ))}
                {data.custody.bulk.map((b) => (
                  <SectionRow key={b.name} icon="git-commit-outline" title={b.name} right={<Pill label={`${b.quantity} ${b.unit}`} tone="neutral" />} />
                ))}
              </>
            ) : (
              <Text variant="bodySm" color={colors.textDim}>
                Holds no devices or materials.
              </Text>
            )}
          </Section>

          <Section title="Recent jobs">
            {data.recentTasks.length ? (
              data.recentTasks.map((t) => (
                <SectionRow key={t.id} icon={taskTypeIcon[t.type]} tint={colors.text} tintBg={colors.highlight} title={`${t.code} · ${t.title}`} subtitle={`${t.customerName}${t.durationMinutes != null ? ` · ${duration(t.durationMinutes)}` : ''}`} right={<Badge label={humanize(t.status)} tone={taskStatusTone[t.status]} />} onPress={() => router.push(`/task/${t.id}`)} />
              ))
            ) : (
              <Text variant="bodySm" color={colors.textDim}>
                No jobs yet.
              </Text>
            )}
          </Section>

          <Section title="Attendance · last 30 days">
            {data.attendance.length ? (
              data.attendance.map((a) => (
                <SectionRow
                  key={a.id}
                  icon={a.status === 'LATE' ? 'alarm-outline' : 'checkmark-circle-outline'}
                  tint={a.status === 'LATE' ? colors.warning : colors.success}
                  tintBg={a.status === 'LATE' ? colors.warningSoft : colors.successSoft}
                  title={date(a.workDate)}
                  subtitle={`In ${time(a.checkInAt)} · Out ${time(a.checkOutAt)} · ${duration(a.workedMinutes)}`}
                  right={a.dressReview === 'REJECTED' ? <Pill label="Dress" tone="danger" /> : undefined}
                />
              ))
            ) : (
              <Text variant="bodySm" color={colors.textDim}>
                No attendance in the last 30 days.
              </Text>
            )}
          </Section>
          {data.stats.amountCollected ? (
            <Text variant="bodySm" color={colors.textMuted} align="center">
              Total collected from customers: {kes(data.stats.amountCollected)}
            </Text>
          ) : null}
        </>
      ) : null}

      {canManage && !self ? (
        <Section title="Account actions">
          <View style={styles.actions}>
            <Button label="Edit details" icon="create-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/admin/user-edit?id=${u.id}`)} />
            <Button label="Reset password" icon="key-outline" variant="secondary" style={{ flex: 1 }} loading={busy === 'reset'} onPress={reset} />
          </View>
          <Button label={u.active ? 'Deactivate account' : 'Reactivate account'} icon={u.active ? 'close-circle-outline' : 'checkmark-circle-outline'} variant={u.active ? 'danger' : 'primary'} loading={busy === 'active'} onPress={toggleActive} style={{ marginTop: 10 }} />
        </Section>
      ) : null}
      {self ? (
        <Text variant="bodySm" color={colors.textMuted} align="center">
          This is your own account — use Change password from the More tab.
        </Text>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySm" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="bodySm" style={{ fontFamily: fonts.semibold, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 },
  actions: { flexDirection: 'row', gap: 10 },
});
