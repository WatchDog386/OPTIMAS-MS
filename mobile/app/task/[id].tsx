import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, ApiError } from '../../src/api/client';
import type { PhotoRef, Task } from '../../src/api/types';
import { AuthImage, Avatar, Badge, Button, Card, Input, Loading, Screen, ScreenHeader, SectionHeader, SignatureView, StarRating, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { confirmAction } from '../../src/utils/confirm';
import { isManager, useAuth } from '../../src/store/auth';
import { requestCapture } from '../../src/store/bridge';
import { colors, fonts, isDark, radius, space } from '../../src/theme';
import { JOB_STATE } from '../../src/components/TaskCard';
import { SME } from '../../src/components/SmeKit';
import { dateTime, dayLabel, duration, firstName, isLaterDay, flagLabel, humanize, kes, statusLabel, priorityTone, taskStatusTone, taskTypeIcon, time } from '../../src/utils/format';
import { celebrate, toast } from '../../src/store/feedback';
import { openChatWith } from '../../src/utils/chat';
import { collectDevice } from '../../src/utils/devices';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user)!;
  const manager = isManager(user.role);
  // Supervisors and admins dispatch; the store only looks
  const dispatcher = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const { data, setData, refresh, refreshing } = useApi<{ task: Task }>(`/tasks/${id}`);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const task = data?.task;
  if (!task) return <Loading />;

  const mine = !!task.assignee && task.assignee.id === user.id;
  // Supervisors, admins and customer care give jobs out, assign saved jobs and transfer them
  const assigner = dispatcher || user.role === 'CUSTOMER_CARE';
  // Team jobs: the whole team works it; the leader (the assignee) starts it and files the report
  const team = task.team && 'members' in task.team ? task.team : null;
  const helper = !mine && !!team?.members.some((m) => m.userId === user.id);
  const run = async (fn: () => Promise<{ task: Task }>) => {
    setBusy(true);
    try {
      setData(await fn());
      return true;
    } catch (e) {
      toast.error('Action failed', e instanceof ApiError ? e.message : 'Try again');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const photo = await requestCapture('TASK_START', { taskId: task.id });
    if (!photo) return;
    await run(() => api<{ task: Task }>(`/tasks/${task.id}/start`, { body: { photoId: photo.photoId } }));
  };
  const verify = async (decision: 'VERIFIED' | 'REJECTED') => {
    const ok = await run(() => api(`/tasks/${task.id}/verify`, { body: { decision, note: note || undefined } }));
    if (ok && decision === 'VERIFIED') celebrate('Task verified', `${task.code} is closed.`);
  };
  const cancel = async () => {
    if (await confirmAction('Cancel task', 'This task will be cancelled for the technician.', 'Cancel task')) {
      await run(() => api(`/tasks/${task.id}/cancel`, { body: {} }));
    }
  };

  const open = task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS';
  const state = JOB_STATE[task.status];
  const materialsTotal = task.materials?.reduce((n, m) => n + m.amount, 0) ?? 0;

  const footer =
    mine && task.status === 'ASSIGNED' ? (
      <Button label="Start task · take photo" icon="camera" size="lg" loading={busy} onPress={start} />
    ) : mine && task.status === 'IN_PROGRESS' ? (
      <Button label="Complete task" icon="checkmark-done" size="lg" onPress={() => router.push(`/task/complete?id=${task.id}`)} />
    ) : manager && task.status === 'COMPLETED' ? (
      <View style={{ gap: space.sm }}>
        <Input placeholder="Note (required to reject)" value={note} onChangeText={setNote} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Reject" variant="danger" icon="close" loading={busy} onPress={() => verify('REJECTED')} style={{ flex: 1 }} />
          <Button label="Verify" icon="shield-checkmark" loading={busy} onPress={() => verify('VERIFIED')} style={{ flex: 1.4 }} />
        </View>
      </View>
    ) : assigner && task.status === 'OPEN' ? (
      <View style={{ gap: space.sm }}>
        <Button label="Assign now" icon="person-add-outline" size="lg" onPress={() => router.push(`/admin/task-edit?id=${task.id}`)} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {dispatcher ? <Button label="Cancel" variant="danger" icon="close-circle-outline" loading={busy} onPress={cancel} style={{ flex: 1 }} /> : null}
          <Button label="Nearest technician" icon="git-branch-outline" variant="secondary" onPress={() => router.push(`/admin/forward/${task.id}`)} style={{ flex: 1.4 }} />
        </View>
      </View>
    ) : manager && task.status === 'ASSIGNED' ? (
      <View style={{ gap: space.sm }}>
        {dispatcher ? <Button label="Forward to nearest technician" icon="git-branch-outline" onPress={() => router.push(`/admin/forward/${task.id}`)} /> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Cancel" variant="danger" icon="close-circle-outline" loading={busy} onPress={cancel} style={{ flex: 1 }} />
          <Button label="Edit / reassign" icon="create-outline" variant={dispatcher ? 'secondary' : 'primary'} onPress={() => router.push(`/admin/task-edit?id=${task.id}`)} style={{ flex: 1.4 }} />
        </View>
      </View>
    ) : user.role === 'CUSTOMER_CARE' && task.status === 'ASSIGNED' ? (
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Transfer" icon="git-branch-outline" variant="secondary" onPress={() => router.push(`/admin/forward/${task.id}`)} style={{ flex: 1 }} />
        <Button label="Edit / reassign" icon="create-outline" onPress={() => router.push(`/admin/task-edit?id=${task.id}`)} style={{ flex: 1.4 }} />
      </View>
    ) : manager && task.status === 'IN_PROGRESS' ? (
      <Button label="Cancel task" variant="danger" icon="close-circle-outline" loading={busy} onPress={cancel} />
    ) : helper && open ? (
      <View style={styles.leadNote}>
        <Ionicons name="star" size={18} color={colors.brand} />
        <Text variant="bodySm" style={{ flex: 1 }}>
          {firstName(task.assignee?.name ?? '')} leads {team!.name} and files the report for everyone.
        </Text>
      </View>
    ) : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} footer={footer}>
      <ScreenHeader title={task.code} subtitle={humanize(task.type)} right={<Badge label={statusLabel(task.status)} tone={taskStatusTone[task.status]} />} />

      {/* The job opens on the colour of the state it is in now, with that state in words */}
      <View style={[styles.hero, { backgroundColor: state.bg }]}>
        <View style={styles.row}>
          <View style={[styles.typeIcon, { backgroundColor: state.chip }]}>
            <Ionicons name={taskTypeIcon[task.type]} size={22} color={state.ink} />
          </View>
          <Badge label={`${humanize(task.priority)} priority`} tone={priorityTone[task.priority]} />
        </View>
        <View style={[styles.stateLine, { backgroundColor: state.chip }]}>
          <View style={[styles.stateDot, { backgroundColor: state.ink }]} />
          <Text variant="bodySm" color={state.ink} fixedColor style={{ fontFamily: fonts.semibold, flex: 1 }}>
            {stateText(task)}
          </Text>
        </View>
        <Text variant="h2" color={SME.fg} fixedColor>
          {task.title}
        </Text>
        {task.createdBy ? (
          <Text variant="label" color={SME.fg3} fixedColor>
            Posted by {firstName(task.createdBy.name)} · {dateTime(task.createdAt)}
          </Text>
        ) : null}
        {task.description ? (
          <Text variant="bodySm" color={SME.fg3} fixedColor>
            {task.description}
          </Text>
        ) : null}
        <View style={[styles.metrics, { backgroundColor: state.chip }]}>
          <Metric label="Started" value={time(task.startedAt)} />
          <Metric label="Finished" value={time(task.endedAt)} />
          <Metric label="Duration" value={task.durationMinutes != null ? duration(task.durationMinutes) : task.startedAt ? 'Running' : '—'} />
        </View>
      </View>

      <SectionHeader title="Customer" />
      <Card style={[styles.flat, { gap: space.md }]}>
        <Text variant="title">{task.customerName}</Text>
        {task.customerAccount ? (
          <Text variant="bodySm" color={colors.textMuted}>
            Account {task.customerAccount}
          </Text>
        ) : null}
        <View style={styles.row}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text variant="bodySm" color={colors.textMuted} style={{ flex: 1 }}>
            {task.address}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {task.customerPhone ? (
            <Button label="Call" icon="call" variant="secondary" style={[styles.flatBtn, { flex: 1 }]} onPress={() => Linking.openURL(`tel:${task.customerPhone}`)} />
          ) : null}
          {mine || helper ? (
            <Button label="Directions" icon="navigate" variant="secondary" style={[styles.flatBtn, { flex: 1 }]} onPress={() => router.push(`/navigate/${task.id}`)} />
          ) : open ? (
            <Button label="Track" icon="navigate" variant="secondary" style={[styles.flatBtn, { flex: 1 }]} onPress={() => router.push(`/track/${task.id}`)} />
          ) : null}
        </View>
        {mine && open ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Message" icon="chatbubble-ellipses-outline" variant="secondary" style={[styles.flatBtn, { flex: 1 }]} onPress={() => openChatWith({ taskId: task.id, with: 'customer' })} />
            <Button label="Onboard customer" icon="person-add-outline" variant="secondary" style={[styles.flatBtn, { flex: 1.3 }]} onPress={() => router.push(`/onboard?taskId=${task.id}`)} />
          </View>
        ) : null}
        {(mine || helper) && task.customerAccount ? (
          <Button label="Collect a device from this customer" icon="arrow-undo-outline" variant="secondary" style={styles.flatBtn} onPress={() => void collectDevice()} />
        ) : null}
      </Card>

      {team ? (
        <>
          <SectionHeader title={`Team · ${team.name}`} />
          {assigner || mine || helper ? (
            <Button label="Team chat" icon="chatbubbles-outline" variant="outline" onPress={() => openChatWith({ teamId: team.id })} />
          ) : null}
          <Card style={[styles.flat, { gap: space.md }]}>
            {team.members.map((m) => {
              const leads = m.userId === task.assignee?.id;
              return (
                <View key={m.id} style={styles.row}>
                  <Avatar name={m.user.name} size={36} tint={leads ? colors.brand : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{m.user.name}</Text>
                    <Text variant="label" color={colors.textMuted}>
                      {leads ? 'Team leader · files the report' : 'Team member'}
                      {m.userId === user.id ? ' · you' : ''}
                    </Text>
                  </View>
                  {leads ? <Ionicons name="star" size={18} color={colors.brand} /> : null}
                  {m.userId !== user.id && (manager || assigner || mine || helper) ? (
                    <Pressable onPress={() => openChatWith({ userId: m.userId })} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Message ${m.user.name}`}>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {(manager || assigner) && !team && task.assignee ? (
        <Card style={[styles.flat, styles.row]}>
          <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.textMuted}>
              Assigned to
            </Text>
            <Text variant="title">
              {task.assignee.name} · {task.assignee.staffNo}
            </Text>
          </View>
          <Button label="Message" icon="chatbubble-ellipses-outline" variant="secondary" style={styles.flatBtn} onPress={() => openChatWith({ userId: task.assignee!.id })} />
        </Card>
      ) : !task.assignee && task.status === 'OPEN' ? (
        <Card style={[styles.flat, styles.row]}>
          <Ionicons name="time-outline" size={22} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text variant="title">Not assigned yet</Text>
            <Text variant="label" color={colors.textMuted}>
              Saved to give to a technician or team later
            </Text>
          </View>
        </Card>
      ) : null}

      {task.startPhoto || task.endPhoto ? (
        <>
          <SectionHeader title="Proof of work" />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <ProofPhoto label="Before" photo={task.startPhoto} />
            <ProofPhoto label="After" photo={task.endPhoto} />
          </View>
        </>
      ) : null}

      {task.status === 'COMPLETED' || task.status === 'VERIFIED' || task.status === 'REJECTED' ? (
        <>
          <SectionHeader title="Task report" />
          <Card style={[styles.flat, { gap: 10 }]}>
            <Fact label="Location" value={`${task.address}${task.houseNo ? ` · House ${task.houseNo}` : ''}`} />
            <Fact label="Signal" value={task.signal || '—'} />
            <Fact label="Client paid" value={task.amountCollected ? kes(task.amountCollected) : 'Nothing'} />
            <Fact label="Drop cable" value={task.dropCableM != null ? `${task.dropCableM} m${task.dropStartM != null && task.dropEndM != null ? ` (${task.dropStartM} → ${task.dropEndM})` : ''}` : '—'} />
            <Fact label="FAT pre-installed" value={task.fatPreinstalled == null ? '—' : task.fatPreinstalled ? 'Yes' : 'No'} />
          </Card>
        </>
      ) : null}

      {task.materials?.length ? (
        <>
          <SectionHeader title="Materials used" />
          <Card style={[styles.flat, { gap: space.md }]}>
            {task.materials.map((m) => (
              <View key={m.id} style={styles.matRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="title">{m.item.name}</Text>
                  <Text variant="bodySm" color={colors.textMuted}>
                    {m.unit ? `S/N ${m.unit.serialNumber}` : `${m.quantity} ${m.item.unit} × ${kes(m.unitPrice)}`}
                  </Text>
                </View>
                <Text variant="title">{kes(m.amount)}</Text>
              </View>
            ))}
            <View style={[styles.matRow, styles.total]}>
              <Text variant="title" color={colors.textMuted}>
                Materials value
              </Text>
              <Text variant="h2">{kes(materialsTotal)}</Text>
            </View>
            {task.amountCollected != null ? (
              <View style={styles.matRow}>
                <Text variant="title" color={colors.textMuted}>
                  Collected from customer
                </Text>
                <Text variant="h2" color={colors.primary}>
                  {kes(task.amountCollected)}
                </Text>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {task.customerSignature ? (
        <>
          <SectionHeader title="Customer sign-off" />
          <Card style={[styles.flat, { gap: space.sm }]}>
            <SignatureView path={task.customerSignature} />
            <Text variant="bodySm" color={colors.textMuted}>
              Signed by <Text variant="bodySm">{task.signedByName}</Text> · {dateTime(task.signedAt)}
            </Text>
          </Card>
        </>
      ) : null}

      {task.customerRating ? (
        <>
          <SectionHeader title="Customer rating" />
          <Card style={[styles.flat, { gap: space.sm }]}>
            <StarRating value={task.customerRating} size={22} />
            {task.customerFeedback ? <Text variant="body">“{task.customerFeedback}”</Text> : null}
            <Text variant="bodySm" color={colors.textMuted}>
              Rated {dateTime(task.ratedAt)}
            </Text>
          </Card>
        </>
      ) : null}

      {task.completionNotes ? (
        <>
          <SectionHeader title="Technician notes" />
          <Card style={styles.flat}>
            <Text variant="body">{task.completionNotes}</Text>
          </Card>
        </>
      ) : null}

      {task.verifiedBy ? (
        <Card style={[styles.flat, { backgroundColor: state.bg, gap: 4 }]}>
          <Text variant="title" color={task.status === 'VERIFIED' ? colors.success : colors.danger}>
            {task.status === 'VERIFIED' ? 'Verified' : 'Rejected'} by {task.verifiedBy.name}
          </Text>
          {task.verificationNote ? (
            <Text variant="bodySm" color={colors.textMuted}>
              {task.verificationNote}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Text variant="label" color={colors.textDim} align="center">
        Created {dateTime(task.createdAt)}
        {task.dueAt ? ` · Due ${dateTime(task.dueAt)}` : ''}
      </Text>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySm" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="title" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** The task's state in words, as it stands now. */
function stateText(t: Task) {
  const who = t.team ? t.team.name : t.assignee?.name;
  if ((t.status === 'ASSIGNED' || t.status === 'OPEN') && isLaterDay(t.scheduledFor)) return `For ${dayLabel(t.scheduledFor)} · ${who ? `${who} gets it that morning` : 'to assign'}`;
  switch (t.status) {
    case 'OPEN':
      return 'Not assigned yet · waiting for a technician';
    case 'ASSIGNED':
      return `Assigned to ${who ?? 'a technician'} · not started yet`;
    case 'IN_PROGRESS':
      return `In progress · ${who ?? 'technician'} started at ${time(t.startedAt)}`;
    case 'COMPLETED':
      return `Done at ${time(t.endedAt)} · waiting to be verified`;
    case 'VERIFIED':
      return `Verified · closed${t.verifiedBy ? ` by ${t.verifiedBy.name}` : ''}`;
    case 'REJECTED':
      return `Returned to ${who ?? 'the technician'}${t.verificationNote ? ` · ${t.verificationNote}` : ''}`;
    case 'CANCELLED':
      return 'Cancelled';
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label" color={SME.fg3} fixedColor>
        {label}
      </Text>
      <Text variant="title" color={SME.fg} fixedColor>
        {value}
      </Text>
    </View>
  );
}

function ProofPhoto({ label, photo }: { label: string; photo?: PhotoRef | null }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      {photo ? (
        <AuthImage photoId={photo.id} title={`${label} photo`} flagged={photo.flags.length > 0} />
      ) : (
        <View style={styles.photoEmpty}>
          <Ionicons name="image-outline" size={26} color={colors.textDim} />
        </View>
      )}
      <Text variant="label" color={colors.textMuted}>
        {label} {photo ? `· ${time(photo.receivedAt)}` : ''}
      </Text>
      {photo?.flags.map((f) => <Badge key={f} label={flagLabel[f] ?? f} tone="warning" />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'space-between' },
  leadNote: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  hero: { gap: space.md, padding: space.xl, borderRadius: radius.xl },
  typeIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  metrics: { flexDirection: 'row', borderRadius: radius.md, padding: space.md },
  // Details cards without outlines; their buttons filled instead of outlined
  flat: { borderWidth: 0 },
  flatBtn: { borderWidth: 0, borderColor: 'transparent', backgroundColor: isDark ? '#2A2D2C' : '#EEF2F0' },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { paddingTop: space.md },
  photoEmpty: { aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
