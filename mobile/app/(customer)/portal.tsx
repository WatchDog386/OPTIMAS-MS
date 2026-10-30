import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerJob, CustomerOverview, ServiceRequest } from '../../src/api/types';
import {
  AdminHero,
  AdminHeroBar,
  BrandFooter,
  Button,
  CircleAction,
  Glass,
  GlassCircle,
  Pill,
  PulseDot,
  QuickActions,
  RateVisit,
  Reveal,
  Screen,
  Section,
  SectionRow,
  Skeleton,
  StarRating,
  Text,
  type HeroStat,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { call, whatsapp } from '../../src/utils/contact';
import { openChatWith } from '../../src/utils/chat';
import { date, duration, firstName, humanize, minutesSince, taskTypeIcon, time } from '../../src/utils/format';

const RATE_WINDOW_DAYS = 30;

export default function Portal() {
  const user = useAuth((s) => s.user)!;
  const { data, refresh, refreshing, loading, updatedAt, setData } = useApi<CustomerOverview>('/customer/overview', { poll: 20_000 });
  const unread = useApi<{ unread: number }>('/notifications/unread-count', { poll: 30_000 });

  // Tick so "working for 35 min" stays current between syncs.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const active = data?.active ?? [];
  const history = data?.history ?? [];
  const support = data?.support;
  const openRequests = (data?.requests ?? []).filter((r) => r.status === 'OPEN');
  const toRate = history.find((j) => !j.ratedAt && j.endedAt && Date.now() - new Date(j.endedAt).getTime() < RATE_WINDOW_DAYS * 86_400_000);
  const name = data?.customer.name ?? user.name;

  const stats: HeroStat[] = [
    {
      key: 'active',
      label: 'Visits in progress',
      value: active.length,
      sub: active.some((j) => j.status === 'IN_PROGRESS') ? 'Technician on site' : active.length ? 'Technician assigned' : 'Nothing scheduled',
      icon: 'construct',
      onPress: active[0] ? () => router.push(`/visit/${active[0].id}`) : () => router.push('/requests'),
    },
    { key: 'req', label: 'Open requests', value: openRequests.length, sub: openRequests.length ? 'Waiting to be scheduled' : 'All handled', icon: 'chatbubbles', onPress: () => router.push('/requests') },
    { key: 'dev', label: 'Devices', value: data?.devices.length ?? 0, sub: 'At your premises', icon: 'wifi', onPress: () => router.push('/account') },
    { key: 'done', label: 'Visits completed', value: history.length, sub: history[0] ? `Last on ${date(history[0].endedAt)}` : 'No visits yet', icon: 'checkmark-done', onPress: history[0] ? () => router.push(`/visit/${history[0].id}`) : undefined },
  ];

  const onRated = (job: CustomerJob) => setData((prev) => (prev ? { ...prev, history: prev.history.map((j) => (j.id === job.id ? job : j)) } : prev));

  return (
    <Screen edges={[]} refreshing={refreshing} onRefresh={() => (refresh(), unread.refresh())} contentStyle={{ gap: 18, paddingTop: 0 }} stickyHeader>
      <AdminHeroBar
        firstName={firstName(name)}
        unread={unread.data?.unread}
        updatedAt={updatedAt}
        onAvatar={() => router.push('/account')}
        extra={support?.phone ? { icon: 'headset-outline', label: 'Call Optimas support', onPress: () => call(support.phone) } : undefined}
        onBell={() => router.push('/notifications')}
      />
      <View style={{ marginHorizontal: -16 }}>
        <AdminHero
          bar={false}
          firstName={firstName(name)}
          link={{ label: 'Request service', icon: 'add-circle-outline', onPress: () => router.push('/request-new') }}
          onViewAll={() => router.push('/requests')}
          viewAllLabel="My requests"
          loading={!data && loading}
          stats={stats}
        />
      </View>

      {!data && loading ? (
        <Skeleton height={260} radius={28} />
      ) : active.length ? (
        active.map((job, i) => (
          <Reveal key={job.id} index={1 + i}>
            <VisitTracker job={job} />
          </Reveal>
        ))
      ) : openRequests[0] ? (
        <Reveal index={1}>
          <RequestTracker request={openRequests[0]} />
        </Reveal>
      ) : (
        <Reveal index={1}>
          <Glass strong style={{ gap: 14 }}>
            <Text variant="h1" style={styles.title}>
              {'Need a\ntechnician?'}
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              Report a problem or ask us to move your router. You can follow the visit live, right here.
            </Text>
            <View style={styles.footer}>
              <Text variant="h1" style={{ flex: 1, fontFamily: fonts.medium, fontSize: 22 }}>
                Request service
              </Text>
              <GlassCircle size={48} highlight onPress={() => router.push('/request-new')} label="Request service">
                <Ionicons name="arrow-forward" size={20} color={colors.onHighlight} />
              </GlassCircle>
            </View>
          </Glass>
        </Reveal>
      )}

      {toRate ? (
        <Reveal index={3}>
          <RateVisit key={toRate.id} job={toRate} onRated={onRated} />
        </Reveal>
      ) : null}

      <Reveal index={4}>
        <QuickActions
          items={[
            { label: 'Report a fault', icon: 'construct-outline', onPress: () => router.push('/request-new?type=REPAIR') },
            { label: 'Move router', icon: 'swap-horizontal-outline', onPress: () => router.push('/request-new?type=RELOCATION') },
            { label: 'Chat with us', icon: 'chatbubble-ellipses-outline', onPress: () => openChatWith({ support: true }) },
            ...(support?.phone ? [{ label: 'Call us', icon: 'call-outline' as const, onPress: () => call(support.phone) }] : []),
            ...(support?.whatsapp ? [{ label: 'WhatsApp', icon: 'logo-whatsapp' as const, onPress: () => whatsapp(support.whatsapp!), tint: '#25D366' }] : []),
          ]}
        />
      </Reveal>

      <Reveal index={5}>
        <Section title="Devices at your premises" subtitle="Installed and registered to your account">
          {data?.devices.length ? (
            data.devices.map((d) => (
              <SectionRow
                key={d.serialNumber}
                icon="wifi"
                tint={colors.text}
                tintBg={colors.highlight}
                title={d.item.name}
                subtitle={`S/N ${d.serialNumber}${d.installedAt ? ` · installed ${date(d.installedAt)}` : ''}`}
                right={<Pill label="Active" tone="success" />}
              />
            ))
          ) : (
            <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
              No devices recorded yet.
            </Text>
          )}
        </Section>
      </Reveal>

      <Reveal index={6}>
        <Section title="Past visits" subtitle="Work completed at your premises">
          {history.length ? (
            history.map((j) => (
              <SectionRow
                key={j.id}
                icon="checkmark-done"
                tint={colors.success}
                tintBg={colors.successSoft}
                title={j.title}
                subtitle={`${date(j.endedAt)} · ${j.assignee.name}${j.signedByName ? ` · signed by ${j.signedByName}` : ''}`}
                right={j.customerRating ? <StarRating value={j.customerRating} size={12} /> : undefined}
                onPress={() => router.push(`/visit/${j.id}`)}
              />
            ))
          ) : (
            <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
              No visits yet.
            </Text>
          )}
        </Section>
      </Reveal>

      <BrandFooter />
    </Screen>
  );
}

/* ───────────────────────── Live tracking ───────────────────────── */

const STEPS = ['Requested', 'Assigned', 'Working', 'Done'] as const;

/** Four-stop progress line; the fill animates to the current stop and the current stop pulses. */
function Stepper({ step, times }: { step: number; times: (string | undefined)[] }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: step / (STEPS.length - 1), duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [step, fill]);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.track}>
        <View style={styles.trackBase} />
        <Animated.View style={[styles.trackFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        <View style={styles.nodes}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.nodeSlot}>
              {i === step && step < STEPS.length - 1 ? (
                <View style={styles.nodeActive}>
                  <PulseDot color={colors.text} size={8} />
                </View>
              ) : (
                <View style={[styles.node, i <= step && styles.nodeDone]}>{i < step || step === STEPS.length - 1 ? <Ionicons name="checkmark" size={11} color={colors.onHighlight} /> : null}</View>
              )}
            </View>
          ))}
        </View>
      </View>
      <View style={styles.labels}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.labelSlot, i === 0 && { alignItems: 'flex-start' }, i === STEPS.length - 1 && { alignItems: 'flex-end' }]}>
            <Text variant="label" color={i <= step ? colors.text : colors.textDim} style={{ fontFamily: i === step ? fonts.bold : fonts.medium, fontSize: 11.5 }}>
              {s}
            </Text>
            <Text variant="label" color={colors.textDim} style={{ fontSize: 10.5 }}>
              {times[i] ?? ' '}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function VisitTracker({ job }: { job: CustomerJob }) {
  const working = job.status === 'IN_PROGRESS';
  const step = working ? 2 : 1;
  const tech = job.assignee;
  return (
    <Glass strong onPress={() => router.push(`/visit/${job.id}`)} style={{ gap: 16 }}>
      <View style={styles.head}>
        <View style={styles.live}>
          <PulseDot color={working ? '#F59E0B' : colors.success} size={6} />
          <Text variant="label" style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 }}>
            LIVE · {job.code}
          </Text>
        </View>
        <Pill label={humanize(job.type)} tone="neutral" />
      </View>
      <View>
        <Text variant="h1" style={styles.title}>
          {working ? 'Your technician\nis working' : 'Technician\non the way'}
        </Text>
        <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 6 }}>
          {job.title}
          {working && job.startedAt ? ` · for ${duration(minutesSince(job.startedAt))}` : job.dueAt ? ` · expected by ${time(job.dueAt)}` : ''}
        </Text>
      </View>
      <Stepper step={step} times={[time(job.createdAt), time(job.createdAt), job.startedAt ? time(job.startedAt) : undefined, undefined]} />
      <View style={styles.techRow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={colors.textMuted}>
            Your technician
          </Text>
          <Text variant="title" numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 16 }}>
            {tech.name}
          </Text>
        </View>
        <CircleAction icon="chatbubble-ellipses" label="Message" onPress={() => openChatWith({ taskId: job.id, with: 'technician' })} />
        <CircleAction icon="call" label="Call" primary onPress={tech.phone ? () => call(tech.phone) : undefined} />
      </View>
      <View style={styles.where}>
        <Ionicons name={taskTypeIcon[job.type]} size={15} color={colors.textMuted} />
        <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
          {job.address}
        </Text>
      </View>
      {working ? null : <Button label={`Follow ${tech.name.split(' ')[0]} on the map`} icon="map-outline" onPress={() => router.push(`/track/${job.id}`)} />}
    </Glass>
  );
}

function RequestTracker({ request }: { request: ServiceRequest }) {
  return (
    <Glass strong onPress={() => router.push('/requests')} style={{ gap: 16 }}>
      <View style={styles.head}>
        <View style={styles.live}>
          <PulseDot color={colors.success} size={6} />
          <Text variant="label" style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6 }}>
            REQUEST RECEIVED
          </Text>
        </View>
        <Pill label={humanize(request.type)} tone="neutral" />
      </View>
      <View>
        <Text variant="h1" style={styles.title}>
          {'We’re on it'}
        </Text>
        <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 6 }} numberOfLines={2}>
          “{request.description}”
        </Text>
      </View>
      <Stepper step={0} times={[time(request.createdAt), undefined, undefined, undefined]} />
      <Text variant="label" color={colors.textMuted}>
        A supervisor is assigning a technician. You’ll get a notification the moment they do.
      </Text>
    </Glass>
  );
}

const NODE = 22;

const styles = StyleSheet.create({
  title: { fontFamily: fonts.medium, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,29,31,0.05)' },
  track: { height: NODE, justifyContent: 'center', marginHorizontal: NODE / 2 },
  trackBase: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,29,31,0.08)' },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.highlight },
  nodes: { position: 'absolute', left: -NODE / 2, right: -NODE / 2, flexDirection: 'row', justifyContent: 'space-between' },
  nodeSlot: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: 'rgba(28,29,31,0.15)', alignItems: 'center', justifyContent: 'center' },
  nodeDone: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  nodeActive: { width: NODE + 4, height: NODE + 4, borderRadius: (NODE + 4) / 2, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  labelSlot: { flex: 1, alignItems: 'center' },
  techRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(28,29,31,0.07)' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center' },
  where: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
