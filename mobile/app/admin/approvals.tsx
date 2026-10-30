import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { ApprovalSummary, AttendanceReview, JobReview, ProofPhoto } from '../../src/api/approvals';
import { AuthImage, Avatar, Badge, Button, EmptyState, Glass, PageHeader, Reveal, Screen, SectionLead, Text, TileGrid } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { celebrate, confirmDialog, promptDialog, toast } from '../../src/store/feedback';
import { colors, fonts, radius, space } from '../../src/theme';
import { dateTime, duration, flagLabel, humanize, time } from '../../src/utils/format';

type Tab = 'checkins' | 'checkouts' | 'jobs';
type Show = 'PENDING' | 'DONE';
const DRESS: Record<string, string> = { uniform: 'Uniform', idBadge: 'Staff ID', safetyBoots: 'Safety boots', groomed: 'Well groomed' };
const hasFlags = (...p: (ProofPhoto | null | undefined)[]) => p.some((x) => (x?.flags.length ?? 0) > 0);

/**
 * The review desk. Every check-in photo, check-out photo and finished job a technician submits waits here
 * with its photos and details until a supervisor approves it or sends it back with a reason. Clean items
 * (no warnings on their photos) can be approved together.
 */
export default function Approvals() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'checkouts' || params.tab === 'jobs' ? params.tab : 'checkins');
  const [show, setShow] = useState<Show>('PENDING');
  const summary = useApi<ApprovalSummary>('/approvals/summary', { poll: 30_000 });
  const ins = useApi<{ records: AttendanceReview[] }>(tab === 'checkins' ? `/approvals/check-ins?status=${show}` : null);
  const outs = useApi<{ records: AttendanceReview[] }>(tab === 'checkouts' ? `/approvals/check-outs?status=${show}` : null);
  const jobs = useApi<{ tasks: JobReview[] }>(tab === 'jobs' ? `/approvals/jobs?status=${show}` : null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => {
    summary.reload();
    if (tab === 'checkins') ins.reload();
    else if (tab === 'checkouts') outs.reload();
    else jobs.reload();
  };

  /** Runs one decision, confirms it, and refreshes the list and the counts. */
  const decide = async (key: string, run: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await run();
      toast.success(done);
      reload();
    } catch (e) {
      toast.error('Not saved', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (title: string) =>
    promptDialog({ title, message: 'Tell the technician what was wrong. They will see this message.', icon: 'arrow-undo-outline', tone: 'danger', confirmLabel: 'Send back', input: { placeholder: 'Reason (required)', required: true } });

  const clean =
    tab === 'checkins'
      ? (ins.data?.records ?? []).filter((r) => !hasFlags(r.checkInPhoto)).map((r) => ({ kind: 'CHECK_IN' as const, id: r.id }))
      : tab === 'checkouts'
        ? (outs.data?.records ?? []).filter((r) => !hasFlags(r.checkOutPhoto)).map((r) => ({ kind: 'CHECK_OUT' as const, id: r.id }))
        : (jobs.data?.tasks ?? []).filter((t) => !hasFlags(t.startPhoto, t.endPhoto)).map((t) => ({ kind: 'JOB' as const, id: t.id }));

  const approveClean = async () => {
    const ok = await confirmDialog({ title: `Approve ${clean.length} without warnings?`, message: 'Items whose photos have a warning (no GPS, away from the office, taken offline…) are left for you to check one by one.', icon: 'checkmark-done-outline', confirmLabel: 'Approve all' });
    if (!ok) return;
    setBusy('bulk');
    try {
      const r = await api<{ approved: number }>('/approvals/bulk-approve', { body: { items: clean } });
      celebrate(`${r.approved} approved`, 'The technicians have been notified.');
      reload();
    } catch (e) {
      toast.error('Not saved', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const s = summary.data;
  const loading = tab === 'checkins' ? ins.loading : tab === 'checkouts' ? outs.loading : jobs.loading;
  const count = tab === 'checkins' ? ins.data?.records.length : tab === 'checkouts' ? outs.data?.records.length : jobs.data?.tasks.length;

  return (
    <Screen refreshing={summary.refreshing} onRefresh={reload}>
      <PageHeader title="Approvals" subtitle={s ? (s.total ? `${s.total} waiting${s.flagged ? ` · ${s.flagged} with warnings` : ''}` : 'Nothing waiting') : undefined} />

      <TileGrid
        items={[
          { key: 'checkins', title: 'Check-ins', status: s?.checkIns ? `${s.checkIns} waiting` : 'All reviewed', icon: 'log-in-outline', badge: s?.checkIns, selected: tab === 'checkins', onPress: () => setTab('checkins') },
          { key: 'checkouts', title: 'Check-outs', status: s?.checkOuts ? `${s.checkOuts} waiting` : 'All reviewed', icon: 'log-out-outline', badge: s?.checkOuts, selected: tab === 'checkouts', onPress: () => setTab('checkouts') },
          { key: 'jobs', title: 'Jobs', status: s?.jobs ? `${s.jobs} to verify` : 'All verified', icon: 'briefcase-outline', badge: s?.jobs, selected: tab === 'jobs', onPress: () => setTab('jobs') },
        ]}
      />
      <SectionLead text={tab === 'jobs' ? 'Below are the jobs' : tab === 'checkins' ? 'Below are the check-ins' : 'Below are the check-outs'} accent={show === 'PENDING' ? 'waiting for you' : 'already reviewed'} />
      <View style={styles.showRow}>
        {(['PENDING', 'DONE'] as Show[]).map((v) => (
          <Pressable key={v} onPress={() => setShow(v)} style={[styles.chip, show === v && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: show === v }}>
            <Text variant="label" style={{ fontFamily: fonts.semibold }} color={show === v ? colors.onPrimary : colors.textMuted} fixedColor={show === v}>
              {v === 'PENDING' ? 'Waiting' : 'Reviewed'}
            </Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        {show === 'PENDING' && clean.length > 1 ? <Button label={`Approve ${clean.length} clean`} icon="checkmark-done" loading={busy === 'bulk'} onPress={approveClean} /> : null}
      </View>

      {!loading && !count ? (
        <EmptyState icon="checkmark-done-circle-outline" title={show === 'PENDING' ? 'All caught up' : 'Nothing reviewed yet'} message={show === 'PENDING' ? 'New submissions will appear here as technicians send them.' : 'Approved and returned items will show here.'} />
      ) : null}

      {tab === 'checkins'
        ? ins.data?.records.map((r, i) => (
            <Reveal key={r.id} index={Math.min(i, 6)}>
              <Glass strong style={styles.card}>
                <Header name={r.user.name} sub={`${r.user.staffNo} · ${dateTime(r.checkInAt)}`} userId={r.user.id} date={r.workDate} right={<Badge label={r.status === 'LATE' ? 'Late' : 'On time'} tone={r.status === 'LATE' ? 'warning' : 'success'} />} />
                <AuthImage photoId={r.checkInPhoto?.id} title="Check-in photo" subtitle={`${r.user.name} · ${dateTime(r.checkInAt)}`} flagged={hasFlags(r.checkInPhoto)} style={styles.photo} />
                <Flags photo={r.checkInPhoto} />
                {r.dressChecklist ? (
                  <View style={styles.ticks}>
                    {Object.entries(r.dressChecklist).map(([k, v]) => (
                      <View key={k} style={styles.tick}>
                        <Ionicons name={v ? 'checkmark-circle' : 'close-circle'} size={15} color={v ? colors.success : colors.danger} />
                        <Text variant="label" color={colors.textMuted}>
                          {DRESS[k] ?? humanize(k)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {show === 'PENDING' ? (
                  <Actions
                    busy={busy === r.id}
                    onReject={async () => {
                      const note = await reject('Send back this check-in?');
                      if (note) await decide(r.id, () => api(`/attendance/${r.id}/review`, { body: { decision: 'REJECTED', note } }), 'Check-in sent back');
                    }}
                    onApprove={() => decide(r.id, () => api(`/attendance/${r.id}/review`, { body: { decision: 'APPROVED' } }), 'Check-in approved')}
                  />
                ) : (
                  <Outcome status={r.dressReview} by={r.reviewedBy?.name} at={r.reviewedAt} note={r.reviewNote} />
                )}
              </Glass>
            </Reveal>
          ))
        : null}

      {tab === 'checkouts'
        ? outs.data?.records.map((r, i) => (
            <Reveal key={r.id} index={Math.min(i, 6)}>
              <Glass strong style={styles.card}>
                <Header name={r.user.name} sub={`${r.user.staffNo} · out ${dateTime(r.checkOutAt)}`} userId={r.user.id} date={r.workDate} right={<Badge label={duration(r.workedMinutes)} tone="info" dot={false} />} />
                <View style={styles.pair}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <AuthImage photoId={r.checkInPhoto?.id} title="Check-in photo" subtitle={`${r.user.name} · ${dateTime(r.checkInAt)}`} flagged={hasFlags(r.checkInPhoto)} />
                    <Text variant="label" color={colors.textMuted}>
                      In · {time(r.checkInAt)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {r.checkOutPhoto ? <AuthImage photoId={r.checkOutPhoto.id} title="Check-out photo" subtitle={`${r.user.name} · ${dateTime(r.checkOutAt)}`} flagged={hasFlags(r.checkOutPhoto)} /> : null}
                    <Text variant="label" color={colors.textMuted}>
                      Out · {time(r.checkOutAt)}
                    </Text>
                  </View>
                </View>
                <Flags photo={r.checkOutPhoto} />
                {show === 'PENDING' ? (
                  <Actions
                    busy={busy === r.id}
                    onReject={async () => {
                      const note = await reject('Send back this check-out?');
                      if (note) await decide(r.id, () => api(`/attendance/${r.id}/review-checkout`, { body: { decision: 'REJECTED', note } }), 'Check-out sent back');
                    }}
                    onApprove={() => decide(r.id, () => api(`/attendance/${r.id}/review-checkout`, { body: { decision: 'APPROVED' } }), 'Check-out approved')}
                  />
                ) : (
                  <Outcome status={r.checkOutReview ?? null} by={r.checkOutReviewedBy?.name} at={r.checkOutReviewedAt ?? null} note={r.checkOutNote ?? null} />
                )}
              </Glass>
            </Reveal>
          ))
        : null}

      {tab === 'jobs'
        ? jobs.data?.tasks.map((t, i) => (
            <Reveal key={t.id} index={Math.min(i, 6)}>
              <Glass strong style={styles.card}>
                <Header name={t.assignee.name} sub={`${t.code} · ${humanize(t.type)} · ${dateTime(t.endedAt)}`} userId={t.assignee.id} date={t.endedAt?.slice(0, 10)} right={<Badge label={duration(t.durationMinutes)} tone="info" dot={false} />} />
                <Pressable onPress={() => router.push(`/task/${t.id}`)} accessibilityRole="link">
                  <Text variant="title">{t.title}</Text>
                  <Text variant="label" color={colors.textMuted}>
                    {t.customerName} · {t.address}
                  </Text>
                </Pressable>
                <View style={styles.pair}>
                  <View style={{ flex: 1, gap: 6 }}>
                    {t.startPhoto ? <AuthImage photoId={t.startPhoto.id} title={`${t.code} · before`} flagged={hasFlags(t.startPhoto)} /> : <NoPhoto />}
                    <Text variant="label" color={colors.textMuted}>
                      Before · {time(t.startedAt)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {t.endPhoto ? <AuthImage photoId={t.endPhoto.id} title={`${t.code} · after`} flagged={hasFlags(t.endPhoto)} /> : <NoPhoto />}
                    <Text variant="label" color={colors.textMuted}>
                      After · {time(t.endedAt)}
                    </Text>
                  </View>
                </View>
                <Flags photo={t.startPhoto} />
                <Flags photo={t.endPhoto} />
                {t.completionNotes ? (
                  <Text variant="bodySm" style={styles.quote}>
                    “{t.completionNotes}”
                  </Text>
                ) : null}
                <View style={styles.facts}>
                  {t.materials.map((m) => (
                    <Fact key={m.id} icon={m.unit ? 'wifi-outline' : 'cube-outline'} text={m.unit ? `${m.item.name} · ${m.unit.serialNumber}` : `${m.quantity} ${m.item.unit} ${m.item.name}`} />
                  ))}
                  {t.amountCollected ? <Fact icon="cash-outline" text={`KES ${t.amountCollected.toLocaleString('en-KE')} collected`} /> : null}
                  <Fact icon={t.signed ? 'create-outline' : 'remove-circle-outline'} text={t.signed ? `Signed by ${t.signedByName ?? 'customer'}` : 'No customer signature'} />
                </View>
                {show === 'PENDING' ? (
                  <Actions
                    busy={busy === t.id}
                    approveLabel="Verify"
                    onReject={async () => {
                      const note = await reject(`Send back ${t.code}?`);
                      if (note) await decide(t.id, () => api(`/tasks/${t.id}/verify`, { body: { decision: 'REJECTED', note } }), `${t.code} sent back`);
                    }}
                    onApprove={() => decide(t.id, () => api(`/tasks/${t.id}/verify`, { body: { decision: 'VERIFIED' } }), `${t.code} verified`)}
                  />
                ) : (
                  <Outcome status={t.status === 'VERIFIED' ? 'APPROVED' : 'REJECTED'} by={t.verifiedBy?.name} at={t.verifiedAt} note={t.verificationNote} />
                )}
              </Glass>
            </Reveal>
          ))
        : null}
    </Screen>
  );
}

/** Name, time and a link to that person's whole day. */
function Header({ name, sub, userId, date, right }: { name: string; sub: string; userId: string; date?: string | null; right?: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <Pressable onPress={() => router.push(`/admin/activity?userId=${userId}${date ? `&date=${date.slice(0, 10)}` : ''}`)} style={styles.who} accessibilityRole="link" accessibilityLabel={`${name}'s day`}>
        <Avatar name={name} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="label" color={colors.textMuted} numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </Pressable>
      {right}
    </View>
  );
}

function Flags({ photo }: { photo?: ProofPhoto | null }) {
  if (!photo?.flags.length) return null;
  return (
    <View style={styles.ticks}>
      {photo.flags.map((f) => (
        <Badge key={f} label={flagLabel[f] ?? humanize(f)} tone="warning" />
      ))}
    </View>
  );
}

function Actions({ onApprove, onReject, busy, approveLabel = 'Approve' }: { onApprove: () => void; onReject: () => void; busy: boolean; approveLabel?: string }) {
  return (
    <View style={styles.actions}>
      <Button label="Send back" icon="arrow-undo-outline" variant="danger" onPress={onReject} disabled={busy} style={{ flex: 1 }} />
      <Button label={approveLabel} icon="checkmark" onPress={onApprove} loading={busy} style={{ flex: 1 }} />
    </View>
  );
}

function Outcome({ status, by, at, note }: { status: string | null; by?: string | null; at?: string | null; note?: string | null }) {
  const ok = status === 'APPROVED';
  return (
    <View style={[styles.outcome, { backgroundColor: ok ? colors.successSoft : colors.dangerSoft }]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'arrow-undo'} size={18} color={ok ? colors.success : colors.danger} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySm" style={{ fontFamily: fonts.semibold }} color={ok ? colors.success : colors.danger}>
          {ok ? 'Approved' : 'Sent back'}
          {by ? ` by ${by}` : ''}
          {at ? ` · ${dateTime(at)}` : ''}
        </Text>
        {note ? (
          <Text variant="label" color={colors.textMuted}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Fact({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text variant="label" color={colors.textMuted}>
        {text}
      </Text>
    </View>
  );
}

function NoPhoto() {
  return (
    <View style={styles.noPhoto}>
      <Ionicons name="image-outline" size={24} color={colors.textDim} />
    </View>
  );
}

const styles = StyleSheet.create({
  showRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  photo: { aspectRatio: 4 / 5 },
  pair: { flexDirection: 'row', gap: 10 },
  ticks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  outcome: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: radius.md, padding: space.md },
  quote: { fontStyle: 'italic', color: colors.text },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noPhoto: { aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
});
