import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { PhotoRef, Task } from '../../src/api/types';
import { AuthImage, Avatar, Badge, Button, Card, Input, Loading, Screen, ScreenHeader, SectionHeader, SignatureView, StarRating, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { confirmAction } from '../../src/utils/confirm';
import { isManager, useAuth } from '../../src/store/auth';
import { requestCapture } from '../../src/store/bridge';
import { submitWithPhoto } from '../../src/offline/queue';
import { colors, radius, space } from '../../src/theme';
import { dateTime, duration, firstName, flagLabel, humanize, kes, priorityTone, taskStatusTone, taskTypeIcon, time } from '../../src/utils/format';
import { celebrate, toast } from '../../src/store/feedback';
import { openChatWith } from '../../src/utils/chat';

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

  const mine = task.assignee.id === user.id;
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
    let savedOffline = false;
    await run(async () => {
      const res = await submitWithPhoto<{ task: Task }>(photo, { kind: 'TASK_START', label: `${task.code} started`, path: `/tasks/${task.id}/start`, taskId: task.id });
      if (res.queued) {
        savedOffline = true;
        return { task };
      }
      return res.data;
    });
    if (savedOffline) toast.info('Saved on this phone', 'No signal. The job start will be sent automatically when you are back online.');
  };
  const verify = async (decision: 'VERIFIED' | 'REJECTED') => {
    const ok = await run(() => api(`/tasks/${task.id}/verify`, { body: { decision, note: note || undefined } }));
    if (ok && decision === 'VERIFIED') celebrate('Job verified', `${task.code} is closed.`);
  };
  const cancel = async () => {
    if (await confirmAction('Cancel job', 'This job will be cancelled for the technician.', 'Cancel job')) {
      await run(() => api(`/tasks/${task.id}/cancel`, { body: {} }));
    }
  };

  const open = task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS';
  const materialsTotal = task.materials?.reduce((n, m) => n + m.amount, 0) ?? 0;

  const footer =
    mine && task.status === 'ASSIGNED' ? (
      <Button label="Start job · take photo" icon="camera" size="lg" loading={busy} onPress={start} />
    ) : mine && task.status === 'IN_PROGRESS' ? (
      <Button label="Complete job" icon="checkmark-done" size="lg" onPress={() => router.push(`/task/complete?id=${task.id}`)} />
    ) : manager && task.status === 'COMPLETED' ? (
      <View style={{ gap: space.sm }}>
        <Input placeholder="Note (required to reject)" value={note} onChangeText={setNote} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Reject" variant="danger" icon="close" loading={busy} onPress={() => verify('REJECTED')} style={{ flex: 1 }} />
          <Button label="Verify" icon="shield-checkmark" loading={busy} onPress={() => verify('VERIFIED')} style={{ flex: 1.4 }} />
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
    ) : manager && task.status === 'IN_PROGRESS' ? (
      <Button label="Cancel job" variant="danger" icon="close-circle-outline" loading={busy} onPress={cancel} />
    ) : helper && open ? (
      <View style={styles.leadNote}>
        <Ionicons name="star" size={18} color={colors.brand} />
        <Text variant="bodySm" style={{ flex: 1 }}>
          {firstName(task.assignee.name)} leads {team!.name} and files the report for everyone.
        </Text>
      </View>
    ) : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} footer={footer}>
      <ScreenHeader title={task.code} subtitle={humanize(task.type)} right={<Badge label={humanize(task.status)} tone={taskStatusTone[task.status]} />} />

      <Card variant="hero" style={{ gap: space.md, padding: space.xl }}>
        <View style={styles.row}>
          <View style={styles.typeIcon}>
            <Ionicons name={taskTypeIcon[task.type]} size={22} color={colors.white} />
          </View>
          <Badge label={`${humanize(task.priority)} priority`} tone={priorityTone[task.priority]} />
        </View>
        <Text variant="h2">{task.title}</Text>
        {task.description ? (
          <Text variant="bodySm" color={colors.textMuted}>
            {task.description}
          </Text>
        ) : null}
        <View style={styles.metrics}>
          <Metric label="Started" value={time(task.startedAt)} />
          <Metric label="Finished" value={time(task.endedAt)} />
          <Metric label="Duration" value={task.durationMinutes != null ? duration(task.durationMinutes) : task.startedAt ? 'Running' : '—'} />
        </View>
      </Card>

      <SectionHeader title="Customer" />
      <Card style={{ gap: space.md }}>
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
            <Button label="Call" icon="call" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${task.customerPhone}`)} />
          ) : null}
          {mine || helper ? (
            <Button label="Directions" icon="navigate" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/navigate/${task.id}`)} />
          ) : open ? (
            <Button label="Track" icon="navigate" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/track/${task.id}`)} />
          ) : null}
        </View>
        {mine && open ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Message" icon="chatbubble-ellipses-outline" variant="secondary" style={{ flex: 1 }} onPress={() => openChatWith({ taskId: task.id, with: 'customer' })} />
            <Button label="Onboard customer" icon="person-add-outline" variant="secondary" style={{ flex: 1.3 }} onPress={() => router.push(`/onboard?taskId=${task.id}`)} />
          </View>
        ) : null}
      </Card>

      {team ? (
        <>
          <SectionHeader title={`Team · ${team.name}`} />
          <Card style={{ gap: space.md }}>
            {team.members.map((m) => {
              const leads = m.userId === task.assignee.id;
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
                  {m.userId !== user.id && (manager || mine || helper) ? (
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

      {manager && !team ? (
        <Card style={styles.row}>
          <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.textMuted}>
              Assigned to
            </Text>
            <Text variant="title">
              {task.assignee.name} · {task.assignee.staffNo}
            </Text>
          </View>
          <Button label="Message" icon="chatbubble-ellipses-outline" variant="secondary" onPress={() => openChatWith({ userId: task.assignee.id })} />
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

      {task.materials?.length ? (
        <>
          <SectionHeader title="Materials used" />
          <Card style={{ gap: space.md }}>
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
          <Card style={{ gap: space.sm }}>
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
          <Card style={{ gap: space.sm }}>
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
          <Card>
            <Text variant="body">{task.completionNotes}</Text>
          </Card>
        </>
      ) : null}

      {task.verifiedBy ? (
        <Card style={{ borderWidth: 1, borderColor: task.status === 'VERIFIED' ? colors.success : colors.danger, gap: 4 }}>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="title">{value}</Text>
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
  typeIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.heroInset, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', backgroundColor: colors.heroInset, borderRadius: radius.md, padding: space.md },
  matRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  total: { paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  photoEmpty: { aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
