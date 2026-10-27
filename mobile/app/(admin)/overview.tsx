import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { Dashboard, Task } from '../../src/api/types';
import {
  AdminHero,
  AdminHeroBar,
  BrandFooter,
  Glass,
  GlassLink,
  GlassStatCard,
  NotchCard,
  lastDays,
  Pill,
  PillChart,
  QuickActions,
  Reveal,
  Screen,
  Section,
  SectionRow,
  Text,
  type HeroStat,
  type QuickAction,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import type { ApprovalSummary } from '../../src/api/approvals';
import { DemoNotice } from '../../src/components/DemoNotice';
import { requestScan } from '../../src/store/bridge';
import { colors, fonts } from '../../src/theme';
import { duration, firstName } from '../../src/utils/format';

export default function Overview() {
  const user = useAuth((s) => s.user)!;
  const managers = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const { data: d, refresh, refreshing, loading, updatedAt } = useApi<Dashboard>('/reports/dashboard', { poll: 30_000 });
  const done = useApi<{ tasks: Task[] }>('/tasks?status=COMPLETED,VERIFIED');
  const unread = useApi<{ unread: number }>('/notifications/unread-count', { poll: 30_000 });
  // Everything technicians sent that is waiting for a supervisor (photos, check-outs, finished jobs)
  const approvals = useApi<ApprovalSummary>(managers ? '/approvals/summary' : null, { poll: 30_000 });
  const [tab, setTab] = useState<0 | 1>(managers ? 0 : 1);
  // Insights shortcuts stay tucked away until the manager taps Manage
  const [manage, setManage] = useState(false);

  const techs = d?.attendance.technicians ?? 0;
  const inField = d ? d.routers.withTechnicians + d.routers.inTransit : 0;
  const flagged = d ? d.routers.overdueInCustody + d.routers.missingInSpotCounts + d.routers.lostLast30Days : 0;
  const week = lastDays(done.data?.tasks ?? [], (t) => t.endedAt);
  const kes = (n?: number) => (n ?? 0).toLocaleString('en-KE');

  const opsStats: HeroStat[] = [
    ...(managers
      ? [
          {
            key: 'att',
            label: 'Checked in today',
            value: `${d?.attendance.checkedIn ?? 0}/${d?.attendance.technicians ?? 0}`,
            sub: `${d?.attendance.late ?? 0} late · ${d?.attendance.absent ?? 0} absent`,
            icon: 'people' as const,
            onPress: () => router.push('/admin/attendance'),
          },
          {
            key: 'ver',
            label: 'Jobs to verify',
            value: d?.tasks.awaitingVerification ?? 0,
            sub: 'Proof photos waiting',
            icon: 'shield-checkmark' as const,
            alert: !!d?.tasks.awaitingVerification,
            onPress: () => router.push('/board?status=COMPLETED'),
          },
          {
            key: 'req',
            label: 'Customer requests',
            value: d?.requests?.open ?? 0,
            sub: 'New, not yet assigned',
            icon: 'chatbubbles' as const,
            alert: !!d?.requests?.open,
            onPress: () => router.push('/admin/requests'),
          },
        ]
      : []),
    {
      key: 'open',
      label: 'Open jobs',
      value: d ? d.tasks.assigned + d.tasks.inProgress : 0,
      sub: `${d?.tasks.inProgress ?? 0} in progress`,
      icon: 'briefcase',
      onPress: () => router.push('/board'),
    },
    ...(managers
      ? [
          {
            key: 'dress',
            label: 'Dress reviews',
            value: d?.attendance.pendingDressReviews ?? 0,
            sub: 'Check-in photos',
            icon: 'shirt' as const,
            onPress: () => router.push('/admin/reviews'),
          },
        ]
      : []),
    {
      key: 'cash',
      label: 'Collected · 7 days',
      value: kes(d?.tasks.amountCollectedLast7Days),
      sub: `KES · ${d?.tasks.completedLast7Days ?? 0} jobs · avg ${duration(d?.tasks.avgDurationMinutes)}`,
      icon: 'cash',
      onPress: () => router.push('/admin/reports'),
    },
  ];
  const stockStats: HeroStat[] = [
    {
      key: 'store',
      label: 'Routers in store',
      value: d?.routers.inStore ?? 0,
      sub: 'Ready to issue',
      icon: 'cube',
      onPress: () => router.push('/store'),
    },
    {
      key: 'field',
      label: 'With technicians',
      value: inField,
      sub: `${d?.routers.inTransit ?? 0} not yet confirmed`,
      icon: 'person',
      onPress: () => router.push('/admin/reconciliation'),
    },
    {
      key: 'inst',
      label: 'Installed',
      value: d?.routers.installed ?? 0,
      sub: 'At customer premises',
      icon: 'home',
      onPress: () => router.push('/admin/unit'),
    },
    {
      key: 'flag',
      label: 'Flagged devices',
      value: flagged,
      sub: flagged ? 'Overdue · missing · lost' : 'All accounted for',
      icon: 'warning',
      alert: flagged > 0,
      onPress: () => router.push('/admin/reconciliation'),
    },
    {
      key: 'low',
      label: 'Low-stock items',
      value: d?.lowStockItems ?? 0,
      sub: 'Below reorder level',
      icon: 'trending-down',
      alert: !!d?.lowStockItems,
      onPress: () => router.push('/admin/items'),
    },
  ];

  const all: (QuickAction | false)[] = [
    managers && {
      label: 'New job',
      icon: 'add-circle-outline',
      onPress: () => router.push('/admin/task-new'),
    },
    managers && {
      label: 'Requests',
      icon: 'chatbubbles-outline',
      onPress: () => router.push('/admin/requests'),
      badge: d?.requests?.open,
    },
    managers && {
      label: 'People',
      icon: 'people-outline',
      onPress: () => router.push('/admin/users'),
    },
    {
      label: 'Issue stock',
      icon: 'arrow-up-circle-outline',
      onPress: () => router.push('/admin/transfer?direction=issue'),
    },
    {
      label: 'Receive',
      icon: 'download-outline',
      onPress: () => router.push('/admin/receive'),
    },
    {
      label: 'Catalogue',
      icon: 'pricetags-outline',
      onPress: () => router.push('/admin/items'),
    },
    {
      label: 'Reconcile',
      icon: 'git-compare-outline',
      onPress: () => router.push('/admin/reconciliation'),
    },
    {
      label: 'Reports',
      icon: 'document-text-outline',
      onPress: () => router.push('/admin/reports'),
    },
    {
      label: 'Returns',
      icon: 'arrow-down-circle-outline',
      onPress: () => router.push('/admin/transfer?direction=return'),
    },
    {
      label: 'Trace device',
      icon: 'search-outline',
      onPress: () => router.push('/admin/unit'),
    },
  ];
  const actions = all.filter((a): a is QuickAction => !!a).slice(0, 8);

  const scan = async () => {
    const r = await requestScan({ title: 'Scan a device' });
    if (r?.[0]) router.push(`/admin/unit?serial=${encodeURIComponent(r[0])}`);
  };

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={() => {
        refresh();
        done.refresh();
        unread.refresh();
        approvals.refresh();
      }}
      contentStyle={{ gap: 18, paddingTop: 0 }}
      stickyHeader
    >
      <AdminHeroBar
        firstName={firstName(user.name)}
        unread={unread.data?.unread}
        onAvatar={() => router.push('/more')}
        onSearch={() => router.push('/search')}
        onScan={scan}
        onBell={() => router.push('/notifications')}
        updatedAt={updatedAt}
      />
      <View style={{ marginHorizontal: -16 }}>
        <AdminHero
          bar={false}
          firstName={firstName(user.name)}
          tabs={['Operations', 'Inventory']}
          tab={tab}
          onTab={setTab}
          link={
            tab === 0
              ? managers
                ? {
                    label: 'New Job',
                    icon: 'add-circle-outline',
                    onPress: () => router.push('/admin/task-new'),
                  }
                : {
                    label: 'Open jobs',
                    icon: 'briefcase-outline',
                    onPress: () => router.push('/board'),
                  }
              : {
                  label: 'Issue Stock',
                  icon: 'arrow-up-circle-outline',
                  onPress: () => router.push('/admin/transfer?direction=issue'),
                }
          }
          onViewAll={() => router.push(tab === 0 ? '/board' : '/store')}
          stats={tab === 0 ? opsStats : stockStats}
          showStats={false}
          loading={!d && loading}
          updatedAt={updatedAt}
        />
      </View>

      <NotchCard onTab={() => router.push('/board')} tabLabel="All jobs">
        <View style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <Text variant="h1" style={{ fontFamily: fonts.medium, fontSize: 24, lineHeight: 29 }}>
              {'Jobs done\nThis week'}
            </Text>
            <GlassLink label="All jobs" onPress={() => router.push('/board')} />
          </View>
          <PillChart data={week} activeIndex={week.length - 1} format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`} />
        </View>
      </NotchCard>

      <DemoNotice />

      <QuickActions items={actions} action={managers ? { label: manage ? 'Done' : 'Manage', active: manage, onPress: () => setManage((m) => !m) } : undefined} />

      {managers && manage ? (
        <Reveal index={0}>
          <QuickActions
            title="Insights"
            items={[
              { label: 'Approvals', icon: 'checkmark-done-circle-outline', onPress: () => router.push('/admin/approvals'), badge: approvals.data?.total },
              { label: 'Activity', icon: 'time-outline', onPress: () => router.push('/admin/activity') },
              { label: 'Leaderboard', icon: 'trophy-outline', onPress: () => router.push('/admin/leaderboard') },
              { label: 'Live map', icon: 'map-outline', onPress: () => router.push('/admin/map') },
              { label: 'Charts', icon: 'bar-chart-outline', onPress: () => router.push('/admin/charts') },
              { label: 'Ratings', icon: 'star-outline', onPress: () => router.push('/admin/ratings') },
            ]}
          />
        </Reveal>
      ) : null}

      {managers ? (
        <GlassStatCard
          notched
          onTab={() => router.push('/admin/attendance')}
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
      ) : (
        <Section
          title="Router accountability"
          subtitle="Where every serialised device is now"
          action={{
            label: 'Reconcile',
            onPress: () => router.push('/admin/reconciliation'),
          }}
        >
          <SectionRow icon="cube-outline" title="In store" subtitle="Ready to issue" right={<Pill label={String(d?.routers.inStore ?? 0)} tone="neutral" />} />
          <SectionRow icon="person-outline" title="With technicians" subtitle={`${d?.routers.inTransit ?? 0} not yet confirmed`} right={<Pill label={String(inField)} tone="warning" />} />
          <SectionRow icon="home-outline" tint={colors.success} tintBg={colors.successSoft} title="Installed at customers" right={<Pill label={String(d?.routers.installed ?? 0)} tone="success" />} />
          <SectionRow
            icon="warning-outline"
            tint={colors.danger}
            tintBg={colors.dangerSoft}
            title="Faulty or lost"
            subtitle={`${d?.routers.lostLast30Days ?? 0} lost in the last 30 days`}
            right={<Pill label={String((d?.routers.faulty ?? 0) + (d?.routers.lost ?? 0))} tone="danger" />}
          />
        </Section>
      )}

      <BrandFooter />
    </Screen>
  );
}
