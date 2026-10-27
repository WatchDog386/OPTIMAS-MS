import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../src/api/client';
import type { Attendance, Custody } from '../src/api/types';
import { Badge, Button, Card, ListRow, Screen, ScreenHeader, SectionHeader, Text } from '../src/components';
import { useApi } from '../src/hooks/useApi';
import { requestCapture } from '../src/store/bridge';
import { colors, radius, space } from '../src/theme';
import { duration, flagLabel, time } from '../src/utils/format';
import { celebrate, toast } from '../src/store/feedback';
import { submitWithPhoto } from '../src/offline/queue';

const DRESS_CODE = [
  { key: 'uniform', icon: 'shirt-outline', label: 'Full company uniform', hint: 'Branded Optimas shirt / reflector jacket, clean and tucked in' },
  { key: 'idBadge', icon: 'id-card-outline', label: 'Staff ID visible', hint: 'Worn on a lanyard or clipped on the chest' },
  { key: 'safetyBoots', icon: 'footsteps-outline', label: 'Safety boots', hint: 'Closed, protective work footwear' },
  { key: 'groomed', icon: 'sparkles-outline', label: 'Neat & well groomed', hint: 'Presentable for customer premises' },
] as const;
type Key = (typeof DRESS_CODE)[number]['key'];

export default function CheckIn() {
  const { mode } = useLocalSearchParams<{ mode: 'in' | 'out' }>();
  const isIn = mode !== 'out';
  const today = useApi<{ record: Attendance | null; custody: Custody }>(isIn ? null : '/attendance/today');
  const [checks, setChecks] = useState<Record<Key, boolean>>({ uniform: false, idBadge: false, safetyBoots: false, groomed: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ record: Attendance; flags: string[] } | null>(null);
  const [queued, setQueued] = useState(false);
  const allChecked = Object.values(checks).every(Boolean);

  const submit = async () => {
    const photo = await requestCapture(isIn ? 'CHECK_IN' : 'CHECK_OUT');
    if (!photo) return;
    setBusy(true);
    try {
      const res = await submitWithPhoto<{ record: Attendance }>(photo, {
        kind: isIn ? 'CHECK_IN' : 'CHECK_OUT',
        label: isIn ? 'Check-in' : 'Check-out',
        path: isIn ? '/attendance/check-in' : '/attendance/check-out',
        body: isIn ? { checklist: checks } : {},
      });
      if (res.queued) {
        setQueued(true);
        return;
      }
      setDone({ record: res.data.record, flags: photo.flags });
      celebrate(isIn ? 'Checked in' : 'Checked out', isIn ? 'Have a good shift.' : 'See you tomorrow.');
    } catch (e) {
      toast.error(isIn ? 'Check-in failed' : 'Check-out failed', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (queued) {
    return (
      <Screen>
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Ionicons name="cloud-offline-outline" size={42} color={colors.onPrimary} />
          </View>
          <Text variant="h1" align="center">
            Saved on this phone
          </Text>
          <Text variant="body" color={colors.textMuted} align="center">
            {`You have no signal. Your ${isIn ? 'check-in' : 'check-out'} is recorded with the time you took the photo and will be sent automatically when you are back online.`}
          </Text>
        </View>
        <Button label="Back to home" onPress={() => router.back()} />
      </Screen>
    );
  }

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
          {done.flags.map((f) => (
            <Badge key={f} label={flagLabel[f] ?? f} tone="warning" />
          ))}
        </View>
        <Button label="Back to home" onPress={() => router.back()} />
      </Screen>
    );
  }

  const custody = today.data?.custody;
  return (
    <Screen
      footer={
        <Button
          label={isIn ? 'Take check-in photo' : 'Take check-out photo'}
          icon="camera"
          size="lg"
          loading={busy}
          disabled={isIn && !allChecked}
          onPress={submit}
        />
      }
    >
      <ScreenHeader title={isIn ? 'Morning check-in' : 'Evening check-out'} subtitle={isIn ? 'Confirm the dress code, then take a live photo' : 'Review what you still hold, then take a live photo'} />

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
                You have a job still in progress
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
