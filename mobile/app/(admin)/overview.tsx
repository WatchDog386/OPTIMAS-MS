import { View } from 'react-native';
import { router } from 'expo-router';
import type { Dashboard, Task } from '../../src/api/types';
import {
  BrandFooter,
  Glass,
  GlassLink,
  GlassStatCard,
  GlassTopBar,
  lastDays,
  Pill,
  PillChart,
  Portrait,
  ProfileHero,
  QuickActions,
  Screen,
  Section,
  SectionRow,
  Text,
  type QuickAction,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { humanize } from '../../src/utils/format';

export default function Overview() {
  const user = useAuth((s) => s.user)!;
  const { data: d, refresh, refreshing } = useApi<Dashboard>('/reports/dashboard');
  const done = useApi<{ tasks: Task[] }>('/tasks?status=COMPLETED,VERIFIED');
  const managers = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const inField = d ? d.routers.withTechnicians + d.routers.inTransit : 0;
  const risk = d ? d.routers.overdueInCustody + d.routers.missingInSpotCounts + d.routers.lostLast30Days : 0;
  const week = lastDays(done.data?.tasks ?? [], (t) => t.endedAt);
  const techs = d?.attendance.technicians ?? 0;

  const all: (QuickAction | false)[] = [
    managers && { label: 'New job', icon: 'add-circle-outline', onPress: () => router.push('/admin/task-new') },
    managers && { label: 'Requests', icon: 'chatbubbles-outline', onPress: () => router.push('/admin/requests'), badge: d?.requests?.open },
    { label: 'Issue stock', icon: 'arrow-up-circle-outline', onPress: () => router.push('/admin/transfer?direction=issue') },
    managers && { label: 'Dress code', icon: 'shirt-outline', onPress: () => router.push('/admin/reviews'), badge: d?.attendance.pendingDressReviews },
    { label: 'Reports', icon: 'document-text-outline', onPress: () => router.push('/admin/reports') },
    { label: 'Receive', icon: 'download-outline', onPress: () => router.push('/admin/receive') },
    { label: 'Returns', icon: 'arrow-down-circle-outline', onPress: () => router.push('/admin/transfer?direction=return') },
    { label: 'Reconcile', icon: 'git-compare-outline', onPress: () => router.push('/admin/reconciliation') },
    { label: 'Trace device', icon: 'search-outline', onPress: () => router.push('/admin/unit') },
  ];
  const actions = all.filter((a): a is QuickAction => !!a).slice(0, 8);

  const attention = [
    managers && d?.requests?.open
      ? { key: 'req', icon: 'chatbubbles-outline' as const, title: 'Customer requests', sub: 'Turn them into jobs or close them', n: d.requests.open, go: '/admin/requests' }
      : null,
    managers && d?.attendance.pendingDressReviews
      ? { key: 'dress', icon: 'shirt-outline' as const, title: 'Dress-code photos to review', sub: 'Approve or reject check-in selfies', n: d.attendance.pendingDressReviews, go: '/admin/reviews' }
      : null,
    managers && d?.tasks.awaitingVerification
      ? { key: 'verify', icon: 'shield-checkmark-outline' as const, title: 'Jobs awaiting verification', sub: 'Check proof photos and materials', n: d.tasks.awaitingVerification, go: '/board?status=COMPLETED' }
      : null,
    d?.routers.overdueInCustody
      ? { key: 'overdue', icon: 'time-outline' as const, title: 'Devices held too long', sub: 'In a technician’s hands past the limit', n: d.routers.overdueInCustody, go: '/admin/reconciliation' }
      : null,
    d?.routers.missingInSpotCounts
      ? { key: 'missing', icon: 'alert-circle-outline' as const, title: 'Missing in stock counts', sub: 'Last 7 days', n: d.routers.missingInSpotCounts, go: '/admin/reconciliation' }
      : null,
    d?.lowStockItems ? { key: 'low', icon: 'trending-down-outline' as const, title: 'Items below reorder level', sub: 'Restock the store', n: d.lowStockItems, go: '/store' } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { refresh(); done.refresh(); }} contentStyle={{ gap: 18 }}>
      <GlassTopBar profileHref="/more" calendarHref={managers ? '/admin/attendance' : '/store'} />

      <ProfileHero
        name={user.name}
        role={humanize(user.role)}
        stat={managers ? `${d?.attendance.checkedIn ?? 0}/${techs}` : inField}
        statLabel={managers ? 'Technicians checked in' : 'Devices in the field'}
        portrait={<Portrait name={user.name} />}
      />

      <Glass strong style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text variant="h1" style={{ fontFamily: fonts.medium, fontSize: 24, lineHeight: 29 }}>
            {'Jobs done\nThis week'}
          </Text>
          <GlassLink label="All jobs" onPress={() => router.push('/board')} />
        </View>
        <PillChart data={week} activeIndex={week.length - 1} format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`} />
      </Glass>

      {managers ? (
        <GlassStatCard
          title={'Attendance\nToday'}
          value={`${d?.attendance.checkedIn ?? 0}/${techs}`}
          progress={techs ? (d?.attendance.checkedIn ?? 0) / techs : 0}
          caption="Late · absent · checked out"
          footer={`${d?.attendance.late ?? 0} · ${d?.attendance.absent ?? 0} · ${d?.attendance.checkedOut ?? 0}`}
          secondaryIcon="shirt-outline"
          onSecondary={() => router.push('/admin/reviews')}
          icon="calendar-outline"
          onAction={() => router.push('/admin/attendance')}
        />
      ) : null}

      <GlassStatCard
        title={'Routers\nAccounted for'}
        value={inField}
        progress={inField + (d?.routers.installed ?? 0) ? (d?.routers.installed ?? 0) / (inField + (d?.routers.installed ?? 0)) : 0}
        progressLabel={`${d?.routers.installed ?? 0} installed`}
        caption={risk ? 'Flagged devices' : 'Status'}
        footer={risk ? `${risk} flagged` : 'All accounted'}
        secondaryIcon="search-outline"
        onSecondary={() => router.push('/admin/unit')}
        icon="git-compare-outline"
        onAction={() => router.push('/admin/reconciliation')}
      />

      <GlassStatCard
        title={'Collected\nLast 7 days'}
        value={`${d?.tasks.completedLast7Days ?? 0} jobs`}
        caption="Cash collected (KES)"
        footer={(d?.tasks.amountCollectedLast7Days ?? 0).toLocaleString('en-KE')}
        icon="document-text-outline"
        onAction={() => router.push('/admin/reports')}
      />

      <QuickActions items={actions} />

      <Section title="Needs attention" subtitle="Things waiting on you today">
        {attention.length === 0 ? (
          <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
            All clear — nothing needs your attention.
          </Text>
        ) : (
          attention.map((a) => (
            <SectionRow key={a.key} icon={a.icon} tint={colors.text} tintBg={colors.highlight} title={a.title} subtitle={a.sub} right={<Pill label={String(a.n)} tone="danger" />} onPress={() => router.push(a.go as never)} />
          ))
        )}
      </Section>

      <BrandFooter />
    </Screen>
  );
}
