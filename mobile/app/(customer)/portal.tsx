import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CustomerJob, CustomerOverview } from '../../src/api/types';
import {
  BrandFooter,
  Glass,
  GlassCircle,
  GlassTopBar,
  HatchedProgress,
  Pill,
  Portrait,
  ProfileHero,
  QuickActions,
  Screen,
  Section,
  SectionRow,
  Text,
} from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { call, whatsapp } from '../../src/utils/contact';
import { date, humanize, taskTypeIcon, time } from '../../src/utils/format';

const STAGE = { ASSIGNED: 0.34, IN_PROGRESS: 0.67, COMPLETED: 1, VERIFIED: 1 } as Record<string, number>;

export default function Portal() {
  const user = useAuth((s) => s.user)!;
  const { data, refresh, refreshing } = useApi<CustomerOverview>('/customer/overview');
  const active = data?.active ?? [];
  const support = data?.support;
  const open = (data?.requests ?? []).filter((r) => r.status === 'OPEN').length;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} contentStyle={{ gap: 18 }}>
      <GlassTopBar profileHref="/account" calendarHref="/requests" calendarIcon="chatbubbles-outline" />

      <ProfileHero
        name={data?.customer.name ?? user.name}
        role={`Customer · ${data?.customer.account ?? user.staffNo}`}
        stat={active.length}
        statLabel={active.length === 1 ? 'Visit in progress' : 'Visits in progress'}
        portrait={<Portrait name={data?.customer.name ?? user.name} />}
      />

      {active.length ? (
        active.map((job) => <VisitCard key={job.id} job={job} />)
      ) : (
        <Glass strong style={{ gap: 14 }}>
          <Text variant="h1" style={styles.title}>
            {'Need a\ntechnician?'}
          </Text>
          <Text variant="bodySm" color={colors.textMuted}>
            {open ? `We have your request (${open} open). A supervisor will assign a technician shortly.` : 'Report a problem or ask us to move your router. We’ll send a technician.'}
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
      )}

      <QuickActions
        items={[
          { label: 'Report a fault', icon: 'construct-outline', onPress: () => router.push('/request-new?type=REPAIR') },
          { label: 'Move router', icon: 'swap-horizontal-outline', onPress: () => router.push('/request-new?type=RELOCATION') },
          { label: 'Call us', icon: 'call-outline', onPress: () => call(support?.phone) },
          { label: 'WhatsApp', icon: 'logo-whatsapp', onPress: () => support && whatsapp(support.whatsapp), tint: '#25D366' },
        ]}
      />

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
            />
          ))
        ) : (
          <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
            No devices recorded yet.
          </Text>
        )}
      </Section>

      <Section title="Past visits" subtitle="Work completed at your premises">
        {data?.history.length ? (
          data.history.map((j) => (
            <SectionRow
              key={j.id}
              icon="checkmark-done"
              tint={colors.success}
              tintBg={colors.successSoft}
              title={j.title}
              subtitle={`${date(j.endedAt)} · ${j.assignee.name}${j.signedByName ? ` · signed by ${j.signedByName}` : ''}`}
              onPress={() => router.push(`/visit/${j.id}`)}
            />
          ))
        ) : (
          <Text variant="bodySm" color={colors.textDim} style={{ paddingHorizontal: 4 }}>
            No visits yet.
          </Text>
        )}
      </Section>

      <BrandFooter />
    </Screen>
  );
}

function VisitCard({ job }: { job: CustomerJob }) {
  const working = job.status === 'IN_PROGRESS';
  return (
    <Glass strong onPress={() => router.push(`/visit/${job.id}`)} style={{ gap: 16 }}>
      <View style={styles.top}>
        <Text variant="h1" style={styles.title}>
          {working ? 'Technician\nworking now' : 'Technician\nassigned'}
        </Text>
        <Pill label={humanize(job.type)} tone="neutral" />
      </View>
      <Text variant="bodySm" color={colors.textMuted}>
        {job.title}
        {job.dueAt && !working ? ` · expected by ${time(job.dueAt)}` : ''}
        {working && job.startedAt ? ` · started ${time(job.startedAt)}` : ''}
      </Text>
      <HatchedProgress value={STAGE[job.status] ?? 0.1} label={working ? 'Work in progress' : 'Assigned'} />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={colors.textMuted}>
            Your technician
          </Text>
          <Text variant="h1" numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 22 }}>
            {job.assignee.name}
          </Text>
        </View>
        <GlassCircle size={46} onPress={() => router.push(`/visit/${job.id}`)} label="Details">
          <Ionicons name={taskTypeIcon[job.type]} size={19} color={colors.text} />
        </GlassCircle>
        {job.assignee.phone ? (
          <GlassCircle size={46} highlight onPress={() => call(job.assignee.phone)} label={`Call ${job.assignee.name}`}>
            <Ionicons name="call" size={19} color={colors.onHighlight} />
          </GlassCircle>
        ) : null}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  title: { flex: 1, fontFamily: fonts.medium, fontSize: 24, lineHeight: 29, letterSpacing: -0.3 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
});
