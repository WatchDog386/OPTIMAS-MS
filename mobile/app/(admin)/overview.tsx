import type { ReactElement } from 'react';
import { router } from 'expo-router';
import type { Dashboard } from '../../src/api/types';
import {
  BankCard,
  BrandFooter,
  CardCarousel,
  DashboardHeader,
  Pill,
  QuickActions,
  Screen,
  Section,
  SectionRow,
  Text,
  type QuickAction,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { cardThemes, colors } from '../../src/theme';
import { duration, firstName, greeting } from '../../src/utils/format';

export default function Overview() {
  const user = useAuth((s) => s.user)!;
  const { data: d, refresh, refreshing } = useApi<Dashboard>('/reports/dashboard');
  const managers = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const inField = d ? d.routers.withTechnicians + d.routers.inTransit : 0;
  const risk = d ? d.routers.overdueInCustody + d.routers.missingInSpotCounts + d.routers.lostLast30Days : 0;

  const cards = [
    managers ? (
      <BankCard
        key="att"
        theme={cardThemes.teal}
        label="Checked in today"
        value={d?.attendance.checkedIn ?? '–'}
        note={`of ${d?.attendance.technicians ?? '–'}`}
        masked={d?.attendance.checkedIn ?? 0}
        footerLeft={`${d?.attendance.late ?? 0} late · ${d?.attendance.absent ?? 0} absent`}
        footerRight={`${d?.attendance.checkedOut ?? 0} out`}
        icon="people-outline"
        action={{ label: 'Register', onPress: () => router.push('/admin/attendance') }}
      />
    ) : null,
    managers ? (
      <BankCard
        key="verify"
        theme={cardThemes.charcoal}
        label="Jobs to verify"
        value={d?.tasks.awaitingVerification ?? '–'}
        note="waiting"
        masked={d?.tasks.completedLast7Days ?? 0}
        footerLeft={`${d ? d.tasks.assigned + d.tasks.inProgress : 0} open jobs`}
        footerRight={`avg ${duration(d?.tasks.avgDurationMinutes)}`}
        icon="shield-checkmark-outline"
        action={{ label: 'Review', onPress: () => router.push('/board?status=COMPLETED') }}
      />
    ) : null,
    <BankCard
      key="routers"
      theme={cardThemes.garnet}
      label="Routers in the field"
      value={inField}
      note="units"
      masked={d?.routers.installed ?? 0}
      footerLeft={`${d?.routers.inStore ?? 0} in store · ${d?.routers.installed ?? 0} installed`}
      footerRight={risk ? `${risk} flagged` : 'All accounted'}
      icon="wifi-outline"
      action={{ label: 'Reconcile', onPress: () => router.push('/admin/reconciliation') }}
    />,
    <BankCard
      key="cash"
      theme={cardThemes.amethyst}
      label="Collected · last 7 days"
      value={(d?.tasks.amountCollectedLast7Days ?? 0).toLocaleString('en-KE')}
      note="KES"
      masked={d?.tasks.completedLast7Days ?? 0}
      footerLeft={`${d?.tasks.completedLast7Days ?? 0} jobs completed`}
      footerRight="7 days"
      icon="cash-outline"
      action={{ label: 'Reports', onPress: () => router.push('/admin/reports') }}
    />,
  ].filter((c): c is ReactElement => c !== null);

  const all: (QuickAction | false)[] = [
    managers && { label: 'New job', icon: 'add-circle-outline', onPress: () => router.push('/admin/task-new') },
    { label: 'Issue stock', icon: 'arrow-up-circle-outline', onPress: () => router.push('/admin/transfer?direction=issue') },
    { label: 'Receive', icon: 'download-outline', onPress: () => router.push('/admin/receive') },
    { label: 'Returns', icon: 'arrow-down-circle-outline', onPress: () => router.push('/admin/transfer?direction=return') },
    managers && { label: 'Dress code', icon: 'shirt-outline', onPress: () => router.push('/admin/reviews'), badge: d?.attendance.pendingDressReviews },
    managers && { label: 'Register', icon: 'calendar-outline', onPress: () => router.push('/admin/attendance') },
    { label: 'Reconcile', icon: 'git-compare-outline', onPress: () => router.push('/admin/reconciliation') },
    { label: 'Reports', icon: 'document-text-outline', onPress: () => router.push('/admin/reports') },
    { label: 'Trace device', icon: 'search-outline', onPress: () => router.push('/admin/unit') },
  ];
  const actions = all.filter((a): a is QuickAction => !!a).slice(0, 8);

  const attention = [
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
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <DashboardHeader name={user.name} title={`${greeting()}, ${firstName(user.name)}`} profileHref="/more" />

      <CardCarousel>{cards}</CardCarousel>

      <QuickActions items={actions} />

      <Section title="Needs attention" subtitle="Things waiting on you today">
        {attention.length === 0 ? (
          <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
            All clear — nothing needs your attention.
          </Text>
        ) : (
          attention.map((a) => (
            <SectionRow
              key={a.key}
              icon={a.icon}
              tint={colors.garnet}
              tintBg={colors.garnetSoft}
              title={a.title}
              subtitle={a.sub}
              right={<Pill label={String(a.n)} tone="danger" />}
              onPress={() => router.push(a.go as never)}
            />
          ))
        )}
      </Section>

      <Section title="Router accountability" subtitle="Where every serialised device is now" action={{ label: 'Reconcile', onPress: () => router.push('/admin/reconciliation') }}>
        <SectionRow icon="home-outline" title="In store" subtitle="Ready to issue" right={<Pill label={String(d?.routers.inStore ?? 0)} tone="neutral" />} />
        <SectionRow icon="person-outline" title="With technicians" subtitle={`${d?.routers.inTransit ?? 0} not yet confirmed`} right={<Pill label={String(inField)} tone="warning" />} />
        <SectionRow icon="checkmark-circle-outline" tint={colors.success} tintBg={colors.successSoft} title="Installed at customers" right={<Pill label={String(d?.routers.installed ?? 0)} tone="success" />} />
        <SectionRow
          icon="warning-outline"
          tint={colors.garnet}
          tintBg={colors.garnetSoft}
          title="Faulty or lost"
          subtitle={`${d?.routers.lostLast30Days ?? 0} lost in the last 30 days`}
          right={<Pill label={String((d?.routers.faulty ?? 0) + (d?.routers.lost ?? 0))} tone="danger" />}
        />
      </Section>

      <BrandFooter />
    </Screen>
  );
}
