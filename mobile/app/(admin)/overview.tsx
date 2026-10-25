import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Dashboard } from '../../src/api/types';
import { Avatar, NotificationBell, Card, Screen, SectionHeader, StatGrid, StatTile, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, radius, space } from '../../src/theme';
import { duration, firstName, greeting, kes } from '../../src/utils/format';

export default function Overview() {
  const user = useAuth((s) => s.user)!;
  const { data: d, refresh, refreshing } = useApi<Dashboard>('/reports/dashboard');
  const pct = d && d.attendance.technicians ? Math.round((d.attendance.checkedIn / d.attendance.technicians) * 100) : 0;
  const routerRisk = d ? d.routers.overdueInCustody + d.routers.missingInSpotCounts + d.routers.lostLast30Days : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" color={colors.textMuted}>
            {greeting()},
          </Text>
          <Text variant="h1">{firstName(user.name)}</Text>
        </View>
        <NotificationBell />
        <Avatar name={user.name} />
      </View>

      <Card variant="hero" style={{ padding: space.xl, gap: space.lg }} onPress={user.role === 'STOREKEEPER' ? undefined : () => router.push('/admin/attendance')}>
        <View style={styles.rowBetween}>
          <Text variant="overline" color={colors.textMuted}>
            Today's attendance
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.rowBetween}>
          <View>
            <Text variant="display">
              {d?.attendance.checkedIn ?? '–'}
              <Text variant="h2" color={colors.textMuted}>
                {' '}
                / {d?.attendance.technicians ?? '–'}
              </Text>
            </Text>
            <Text variant="bodySm" color={colors.textMuted}>
              technicians checked in
            </Text>
          </View>
          <View style={styles.ring}>
            <Text variant="h2" color={colors.primary}>
              {pct}%
            </Text>
          </View>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <View style={styles.pills}>
          <Pill icon="alarm-outline" label="Late" value={d?.attendance.late} tint={colors.warning} />
          <Pill icon="close-circle-outline" label="Absent" value={d?.attendance.absent} tint={colors.danger} />
          <Pill icon="log-out-outline" label="Out" value={d?.attendance.checkedOut} tint={colors.info} />
        </View>
      </Card>

      {d?.attendance.pendingDressReviews ? (
        <ActionCard
          icon="shirt-outline"
          tint={colors.accent}
          title={`${d.attendance.pendingDressReviews} dress-code photo(s) to review`}
          subtitle="Approve or reject check-in photos"
          onPress={() => router.push('/admin/reviews')}
        />
      ) : null}
      {d?.tasks.awaitingVerification ? (
        <ActionCard
          icon="shield-checkmark-outline"
          tint={colors.primary}
          title={`${d.tasks.awaitingVerification} job(s) awaiting verification`}
          subtitle="Check proof photos and materials"
          onPress={() => router.push('/board?status=COMPLETED')}
        />
      ) : null}

      <SectionHeader title="Jobs" />
      <StatGrid>
        <StatTile icon="briefcase-outline" label="Open jobs" value={d ? d.tasks.assigned + d.tasks.inProgress : '–'} hint={d ? `${d.tasks.inProgress} in progress` : undefined} />
        <StatTile icon="checkmark-done" label="Done (7 days)" value={d?.tasks.completedLast7Days ?? '–'} tint={colors.success} />
        <StatTile icon="timer-outline" label="Avg. job time" value={duration(d?.tasks.avgDurationMinutes)} tint={colors.accent} />
        <StatTile icon="cash-outline" label="Collected (7 days)" value={kes(d?.tasks.amountCollectedLast7Days).replace('KES ', '')} tint={colors.warning} hint="KES" />
      </StatGrid>

      <SectionHeader title="Router accountability" action="Reconcile" onAction={() => router.push('/admin/reconciliation')} />
      <Card style={{ gap: space.lg }} onPress={() => router.push('/admin/reconciliation')}>
        <View style={styles.flow}>
          <Flow label="In store" value={d?.routers.inStore} />
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          <Flow label="With techs" value={d ? d.routers.withTechnicians + d.routers.inTransit : undefined} />
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
          <Flow label="Installed" value={d?.routers.installed} tint={colors.success} />
        </View>
        <View style={[styles.riskBox, { backgroundColor: routerRisk ? colors.dangerSoft : colors.successSoft }]}>
          <Ionicons name={routerRisk ? 'warning' : 'shield-checkmark'} size={20} color={routerRisk ? colors.danger : colors.success} />
          <Text variant="bodySm" color={routerRisk ? colors.danger : colors.success} style={{ flex: 1 }}>
            {routerRisk
              ? `${d!.routers.overdueInCustody} overdue in custody · ${d!.routers.missingInSpotCounts} missing in counts · ${d!.routers.lostLast30Days} lost (30d)`
              : 'All issued devices are accounted for'}
          </Text>
        </View>
      </Card>

      {d?.lowStockItems ? (
        <ActionCard icon="trending-down" tint={colors.warning} title={`${d.lowStockItems} item(s) below reorder level`} subtitle="Restock the store" onPress={() => router.push('/store')} />
      ) : null}
    </Screen>
  );
}

function Pill({ icon, label, value, tint }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: number; tint: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text variant="title">{value ?? '–'}</Text>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function Flow({ label, value, tint = colors.text }: { label: string; value?: number; tint?: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text variant="stat" color={tint}>
        {value ?? '–'}
      </Text>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function ActionCard(props: { icon: keyof typeof Ionicons.glyphMap; tint: string; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Card onPress={props.onPress} style={styles.action}>
      <View style={[styles.actionIcon, { backgroundColor: `${props.tint}22` }]}>
        <Ionicons name={props.icon} size={20} color={props.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title">{props.title}</Text>
        <Text variant="bodySm" color={colors.textMuted}>
          {props.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ring: { width: 76, height: 76, borderRadius: 38, borderWidth: 6, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.heroInset, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
  pills: { flexDirection: 'row', gap: space.sm },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.heroInset, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  flow: { flexDirection: 'row', alignItems: 'center' },
  riskBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actionIcon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
