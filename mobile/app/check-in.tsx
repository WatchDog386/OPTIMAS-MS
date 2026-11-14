import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../src/utils/nav';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, ApiError } from '../src/api/client';
import type { Attendance, Custody } from '../src/api/types';
import { Badge, Button, Card, ListRow, Screen, ScreenHeader, SectionHeader, Text } from '../src/components';
import { useApi } from '../src/hooks/useApi';
import { requestCapture } from '../src/store/bridge';
import { colors, radius, space } from '../src/theme';
import { duration, flagLabel, time } from '../src/utils/format';
import { celebrate, confirmDialog, toast } from '../src/store/feedback';
import { OfficeCheckCard, useOfficeCheck } from '../src/components/OfficeCheck';
import { distanceLabel } from '../src/utils/location';
import { submit as send, useOutbox } from '../src/offline/outbox';
import { patchCache } from '../src/api/cache';

const DRESS_CODE = [
  { key: 'uniform', icon: 'shirt-outline', label: 'Full company uniform', hint: 'Branded Optimas shirt / reflector jacket, clean and tucked in' },
  { key: 'idBadge', icon: 'id-card-outline', label: 'Staff ID visible', hint: 'Worn on a lanyard or clipped on the chest' },
  { key: 'safetyBoots', icon: 'footsteps-outline', label: 'Safety boots', hint: 'Closed, protective work footwear' },
  { key: 'groomed', icon: 'sparkles-outline', label: 'Neat & well groomed', hint: 'Presentable for customer premises' },
] as const;
type Key = (typeof DRESS_CODE)[number]['key'];

export default function CheckIn() {
  // `go`: back from the daily report on the way to check out — carry on straight to the photo
  const { mode, go } = useLocalSearchParams<{ mode: 'in' | 'out'; go?: string }>();
  const isIn = mode !== 'out';
  const today = useApi<{ record: Attendance | null; shiftStart: string; shiftEnd: string; graceMinutes: number; custody: Custody }>('/attendance/today');
  const [checks, setChecks] = useState<Record<Key, boolean>>({ uniform: false, idBadge: false, safetyBoots: false, groomed: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ record: Attendance; flags: string[]; queued?: boolean } | null>(null);
  const allChecked = Object.values(checks).every(Boolean);
  // Check-out waits for the work to be reported: tasks given to them, then the daily report
  const ready = useApi<{ ready: boolean; tasks: { id: string; code: string; title: string; status: string; customerName: string }[]; needsDayReport: boolean }>(isIn ? null : '/attendance/checkout-ready');
  // Reports and hand-backs saved on this phone (no signal yet) count: they reach the office before the check-out
  const outbox = useOutbox();
  const reportedHere = new Set(outbox.filter((i) => i.state !== 'failed' && /\/tasks\/[^/]+\/(complete|unable)$/.test(i.path)).map((i) => i.taskId));
  const dayReportHere = outbox.some((i) => i.state !== 'failed' && i.path === '/day-reports' && new Date(i.createdAt).toDateString() === new Date().toDateString());
  const tasksLeft = (ready.data?.tasks ?? []).filter((t) => !reportedHere.has(t.id));
  // Tasks not reported stop check-out; the daily report does not: it opens on the way
  const blocked = !isIn && !!ready.data && tasksLeft.length > 0;
  // A task finished today on this phone needs the daily report too, even before the office has it
  const finishedHere = outbox.some((i) => i.state !== 'failed' && /\/tasks\/[^/]+\/complete$/.test(i.path) && new Date(i.createdAt).toDateString() === new Date().toDateString());
  const needsReport = !isIn && !!ready.data && !blocked && (ready.data.needsDayReport || finishedHere) && !dayReportHere;
  const where = useOfficeCheck();

  /** Says plainly when this check-in will not count as at the office, before the photo is taken. */
  const confirmPlace = async () => {
    const step = isIn ? 'check in' : 'check out';
    const radius = distanceLabel(where.office?.radiusM ?? 300);
    if (where.state === 'away')
      return confirmDialog({
        title: 'You are not at the office',
        message: `You are ${distanceLabel(where.away ?? 0)} from the office (the check-in zone is ${radius}). If you ${step} here, your supervisor will be told you were away from the office.`,
        emoji: '📍',
        tone: 'danger',
        confirmLabel: `${isIn ? 'Check in' : 'Check out'} anyway`,
        cancelLabel: 'Cancel',
      });
    if (where.state === 'weak' || where.state === 'searching')
      return confirmDialog({
        title: 'Location not confirmed yet',
        message: `Your phone has not found your exact position${where.fix?.accuracy ? ` (±${distanceLabel(where.fix.accuracy)})` : ''}. Wait a few seconds near a window or outside. If you ${step} now, it will be marked "location not confirmed".`,
        emoji: '🛰️',
        confirmLabel: 'Continue anyway',
        cancelLabel: 'Wait',
      });
    if (where.state === 'off')
      return confirmDialog({
        title: 'Location is off',
        message: `Without your location the office cannot be confirmed, and your supervisor will be told. Allow location for this app, or ${step} anyway.`,
        emoji: '📍',
        tone: 'danger',
        confirmLabel: 'Continue anyway',
        cancelLabel: 'Cancel',
      });
    return true;
  };

  const submit = async () => {
    // Daily report first: the form opens, and once it is sent the check-out carries on
    if (needsReport) return void router.push('/day-report?then=checkout');
    if (!(await confirmPlace())) return;
    const photo = await requestCapture(isIn ? 'CHECK_IN' : 'CHECK_OUT');
    if (!photo) return;
    setBusy(true);
    try {
      const res = await send<{ record: Attendance }>(
        isIn ? '/attendance/check-in' : '/attendance/check-out',
        { ...(isIn ? { checklist: checks } : {}), photoId: photo.photoId },
        { label: isIn ? 'Checked in' : 'Checked out' },
      );
      let record: Attendance;
      if (res.queued) {
        // Shown as done now, with the time the photo was taken; the office gets it when the signal returns
        const now = new Date().toISOString();
        const prev = today.data?.record;
        record = isIn
          ? ({ id: 'local', userId: '', workDate: now.slice(0, 10), status: 'PRESENT', checkInAt: now, checkOutAt: null, workedMinutes: null, dressReview: 'PENDING', reviewNote: null } as Attendance)
          : ({ ...(prev as Attendance), checkOutAt: now, workedMinutes: prev ? Math.round((Date.now() - Date.parse(prev.checkInAt)) / 60_000) : null } as Attendance);
        patchCache<{ record: Attendance | null }>('/attendance/today', (d) => ({ ...d, record }));
      } else record = res.data.record;
      setDone({ record, flags: photo.flags, queued: res.queued });
      celebrate(isIn ? 'Checked in' : 'Checked out', res.queued ? 'Saved on this phone. It is sent by itself when you are back online.' : isIn ? 'Have a good shift.' : 'See you tomorrow.');
    } catch (e) {
      toast.error(isIn ? 'Check-in failed' : 'Check-out failed', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };


  // Back from the daily report: go on to the check-out photo once the server agrees
  const went = useRef(false);
  useEffect(() => {
    if (go === '1' && !isIn && ready.data && !blocked && !needsReport && !went.current) {
      went.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, ready.data, blocked, needsReport]);

  if (done) {
    return (
      <Screen>
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
          </View>
          <Text variant="h1" align="center">
            {isIn ? "You're checked in" : "You're checked out"}
          </Text>
          <Text variant="body" color={colors.textMuted} align="center">
            {isIn
              ? `Recorded at ${time(done.record.checkInAt)}. Your supervisor will review your dress-code photo.`
              : `Recorded at ${time(done.record.checkOutAt)} · ${duration(done.record.workedMinutes)} worked today.`}
          </Text>
          {isIn && done.record.status === 'LATE' ? <Badge label="Marked late" tone="warning" /> : null}
          {done.queued ? <Badge label="Saved on this phone · sends when online" tone="info" /> : null}
          {done.flags.map((f) => (
            <Badge key={f} label={flagLabel[f] ?? f} tone="warning" />
          ))}
        </View>
        <Button label="Back to home" onPress={goBack} />
      </Screen>
    );
  }

  const custody = today.data?.custody;
  return (
    <Screen
      footer={
        <Button
          label={isIn ? 'Take check-in photo' : needsReport ? 'Daily report, then check out' : 'Take check-out photo'}
          icon={needsReport ? 'document-text' : 'camera'}
          size="lg"
          loading={busy}
          disabled={(isIn && !allChecked) || blocked || (!isIn && !ready.data)}
          onPress={submit}
        />
      }
    >
      <ScreenHeader title={isIn ? 'Morning check-in' : 'Evening check-out'} subtitle={isIn ? 'Confirm the dress code, then take a live photo' : 'Review what you still hold, then take a live photo'} />
      {today.data ? (
        <Text variant="label" color={colors.textMuted}>
          {`Working hours ${time(today.data.shiftStart)} – ${time(today.data.shiftEnd)} · later than ${time(new Date(new Date(today.data.shiftStart).getTime() + today.data.graceMinutes * 60_000).toISOString())} counts as late`}
        </Text>
      ) : null}

      <OfficeCheckCard check={where} />

      {blocked && ready.data ? (
        <Card style={{ gap: space.sm, backgroundColor: colors.warningSoft, borderWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={18} color={colors.warning} />
            <Text variant="title" style={{ flex: 1 }}>
              Report your work before checking out
            </Text>
          </View>
          {tasksLeft.length ? (
            <>
              <Text variant="bodySm" color={colors.textMuted}>
                Each task given to you needs its start photo, completion photo and task report. Can’t do one? Open it and tap “Can’t do it today”.
              </Text>
              {tasksLeft.map((t) => (
                <ListRow
                  key={t.id}
                  icon={t.status === 'IN_PROGRESS' ? 'play-circle' : 'briefcase-outline'}
                  title={`${t.code} · ${t.title}`}
                  subtitle={`${t.customerName} · ${t.status === 'IN_PROGRESS' ? 'in progress: finish and send the report' : 'not started'}`}
                  onPress={() => router.push(`/task/${t.id}`)}
                />
              ))}
            </>
          ) : null}
        </Card>
      ) : null}

      {isIn ? (
        <>
          <Card variant="hero" style={{ gap: space.sm }}>
            <Ionicons name="shield-checkmark" size={26} color={colors.white} />
            <Text variant="title">Dress code check</Text>
            <Text variant="bodySm" color={colors.textMuted}>
              Your photo is reviewed by your supervisor. Make sure your uniform and staff ID are clearly visible.
            </Text>
          </Card>
          {DRESS_CODE.map((d) => {
            const on = checks[d.key];
            return (
              <Pressable key={d.key} onPress={() => setChecks((c) => ({ ...c, [d.key]: !c[d.key] }))} style={[styles.check, on && styles.checkOn]}>
                <View style={[styles.checkIcon, on && { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={d.icon} size={20} color={on ? colors.primary : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="title">{d.label}</Text>
                  <Text variant="bodySm" color={colors.textMuted}>
                    {d.hint}
                  </Text>
                </View>
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}</View>
              </Pressable>
            );
          })}
        </>
      ) : (
        <>
          <Card variant="hero" style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text variant="label" color={colors.textMuted}>
                Checked in
              </Text>
              <Text variant="h2">{time(today.data?.record?.checkInAt)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label" color={colors.textMuted}>
                Status
              </Text>
              <Text variant="h2">{today.data?.record?.status === 'LATE' ? 'Late' : 'On time'}</Text>
            </View>
          </Card>
          {custody?.tasksInProgress ? (
            <Card style={{ borderWidth: 1, borderColor: colors.warning }}>
              <Text variant="title" color={colors.warning}>
                You have a task still in progress
              </Text>
              <Text variant="bodySm" color={colors.textMuted}>
                Complete it before leaving, or inform your supervisor.
              </Text>
            </Card>
          ) : null}
          <SectionHeader title="Still in your custody" />
          <Text variant="bodySm" color={colors.textMuted}>
            You are accountable for these items until they are installed or returned to the store.
          </Text>
          {custody?.units.map((u) => (
            <ListRow key={u.serialNumber} icon="wifi" title={u.name} subtitle={`S/N ${u.serialNumber}`} right={<Badge label={u.status === 'IN_TRANSIT' ? 'Unconfirmed' : 'In hand'} tone={u.status === 'IN_TRANSIT' ? 'warning' : 'info'} />} />
          ))}
          {custody?.bulk.map((b) => (
            <ListRow key={b.name} icon="git-commit-outline" iconTint={colors.accent} title={b.name} right={<Text variant="title">{`${b.quantity} ${b.unit}`}</Text>} />
          ))}
          {custody && !custody.units.length && !custody.bulk.length ? (
            <Text variant="bodySm" color={colors.textMuted}>
              Nothing in your custody.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'transparent' },
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkIcon: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  summary: { flexDirection: 'row', gap: space.lg },
  success: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
