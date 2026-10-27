import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../../src/api/client';
import type { Nearby, NearbyTech } from '../../../src/api/field';
import type { Task } from '../../../src/api/types';
import { Avatar, Badge, Button, Input, Loading, MapCanvas, Reveal, Screen, ScreenHeader, Text, type MapPin } from '../../../src/components';
import { useApi } from '../../../src/hooks/useApi';
import { celebrate, toast } from '../../../src/store/feedback';
import { colors, fonts, radius, space } from '../../../src/theme';
import { confirmAction } from '../../../src/utils/confirm';

const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function status(t: NearbyTech): { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' } {
  if (t.current) return { label: 'Has the job', tone: 'info' };
  if (!t.onDuty) return { label: 'Not checked in', tone: 'neutral' };
  if (t.busy) return { label: 'On a job', tone: 'warning' };
  return { label: 'Free', tone: 'success' };
}

/**
 * Hand a job to the technician who can get there soonest. Technicians are ranked by whether they are
 * free and checked in, then by driving time from where their phone last placed them.
 */
export default function ForwardJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, refresh, refreshing } = useApi<Nearby>(`/tasks/${id}/nearby`, { poll: 30_000 });
  const job = useApi<{ task: Task }>(`/tasks/${id}`);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const choice = picked ?? data?.suggestedId ?? null;
  const pins = useMemo(() => {
    const out: MapPin[] = [];
    if (data?.job.lat != null && data.job.lng != null) out.push({ id: 'site', kind: 'site', lat: data.job.lat, lng: data.job.lng });
    for (const t of data?.technicians ?? [])
      if (t.position)
        out.push({ id: t.user.id, kind: 'tech', lat: t.position.lat, lng: t.position.lng, label: initials(t.user.name), color: t.current ? colors.textMuted : !t.onDuty ? '#9AA39E' : t.busy ? colors.navy : colors.success, live: t.position.kind === 'live', dim: !t.onDuty, selected: t.user.id === choice });
    return out;
  }, [data, choice]);

  if (!data || !job.data) return <Loading />;
  const task = job.data.task;
  const chosen = data.technicians.find((t) => t.user.id === choice) ?? null;

  const forward = async () => {
    if (!chosen) return;
    if (!(await confirmAction('Forward job', `${task.code} moves from ${task.assignee.name} to ${chosen.user.name}. Both are notified, and so is the customer.`, 'Forward'))) return;
    setBusy(true);
    try {
      await api(`/tasks/${id}/forward`, { body: { technicianId: chosen.user.id, note: note.trim() || undefined } });
      celebrate('Job forwarded', `${chosen.user.name} has ${task.code} now.`);
      router.replace(`/task/${id}`);
    } catch (e) {
      toast.error('Could not forward', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const footer =
    task.status === 'ASSIGNED' ? (
      <Button label={chosen && !chosen.current ? `Forward to ${chosen.user.name.split(' ')[0]}` : 'Choose a technician'} icon="git-branch-outline" size="lg" disabled={!chosen || chosen.current} loading={busy} onPress={forward} />
    ) : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} footer={footer}>
      <ScreenHeader title="Forward to nearest" subtitle={`${task.code} · ${task.customerName}`} />

      {task.status !== 'ASSIGNED' ? (
        <Text variant="bodySm" color={colors.warning}>
          This job has already started, so it can no longer be forwarded.
        </Text>
      ) : null}

      <View style={styles.mapBox}>
        <MapCanvas pins={pins} fitKey="nearby" onPinPress={(pid) => pid !== 'site' && setPicked(pid)} style={{ flex: 1 }} />
      </View>
      {data.job.lat == null ? (
        <Text variant="bodySm" color={colors.warning}>
          This job has no map pin, so distances cannot be worked out. Edit the job to add the address or a pin.
        </Text>
      ) : null}

      <View>
        {data.technicians.map((t, i) => {
          const s = status(t);
          const selected = t.user.id === choice;
          const suggested = t.user.id === data.suggestedId;
          return (
            <Reveal key={t.user.id} index={Math.min(i, 8)}>
              <Pressable onPress={() => setPicked(t.user.id)} disabled={t.current} style={({ pressed }) => [styles.row, selected && styles.selected, pressed && { opacity: 0.7 }]} accessibilityRole="radio" accessibilityState={{ selected }}>
                <Avatar name={t.user.name} tint={t.onDuty && !t.busy ? colors.success : colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {t.user.name}
                    </Text>
                    {suggested ? (
                      <View style={styles.best}>
                        <Ionicons name="flash" size={11} color={colors.onHighlight} />
                        <Text variant="label" color={colors.onHighlight} fixedColor style={{ fontFamily: fonts.bold, fontSize: 11 }}>
                          Nearest
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                    {t.distanceKm != null ? `${t.distanceKm} km · about ${t.etaMinutes} min away` : t.position ? 'Distance unknown' : 'Location not shared'} · {t.openJobs} open job{t.openJobs === 1 ? '' : 's'}
                  </Text>
                </View>
                <Badge label={s.label} tone={s.tone} />
              </Pressable>
            </Reveal>
          );
        })}
      </View>

      {task.status === 'ASSIGNED' ? <Input label="Note for the technician (optional)" placeholder="e.g. Customer is waiting at the gate" value={note} onChangeText={setNote} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mapBox: { height: 300, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#E9ECEA' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: space.md, paddingHorizontal: 10, borderRadius: radius.lg },
  selected: { backgroundColor: 'rgba(236,242,58,0.35)' },
  best: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.highlight, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
});
