import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { Dashboard, Task } from '../api/types';
import { useApi } from '../hooks/useApi';
import { TaskCard } from './TaskCard';
import { usePublicInfo } from '../hooks/usePublicInfo';
import { fonts, isDark } from '../theme';
import { SME } from './SmeKit';
import { Text } from './Text';

/*
 * The overview's search bar, task tiles and advert card, as on Knoxville-SME's dashboard: the search bar
 * under the header, the Active / Expiring / Expired subscriber tiles (here: active, due soon and overdue
 * tasks) with the row under them, and the pay-with-M-Pesa banner.
 */

const LOGO = require('../../assets/logo-app.webp');

/** Tapping it opens Search (tasks, customers, devices, people). */
export function OverviewSearch() {
  return (
    <Pressable onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="Search tasks, customers and devices" style={({ pressed }) => [styles.search, pressed && { transform: [{ scale: 0.99 }] }]}>
      <Ionicons name="search" size={20} color={isDark ? '#8FD14F' : '#2DA043'} />
      <Text variant="body" color={SME.fg4} fixedColor numberOfLines={1} style={{ fontSize: 14, flex: 1 }}>
        Search tasks, customers, devices…
      </Text>
      <Ionicons name="scan-outline" size={18} color={SME.fg4} />
    </Pressable>
  );
}

/** Pastel tiles in light mode; charcoal tiles with coloured numbers in dark mode (Knoxville-SME's look). */
const TILE = isDark
  ? { active: { bg: SME.surface, ink: '#34D399' }, soon: { bg: SME.surface, ink: '#FBBF24' }, over: { bg: SME.surface, ink: '#F87171' } }
  : { active: { bg: '#ECFDF5', ink: '#047857' }, soon: { bg: '#FFFBEB', ink: '#B45309' }, over: { bg: '#FEF2F2', ink: '#B91C1C' } };

/** Tasks at a glance: active, due in the next 2 hours, past due; and the tasks waiting to be verified. */
export function TaskHealth({ d }: { d?: Dashboard | null }) {
  const t = d?.tasks;
  const tiles = [
    { label: 'Active', value: (t?.assigned ?? 0) + (t?.inProgress ?? 0), tone: TILE.active, href: '/board?status=ASSIGNED,IN_PROGRESS' },
    { label: 'Due soon', value: t?.dueSoon ?? 0, tone: TILE.soon, href: '/board?due=soon' },
    { label: 'Overdue', value: t?.overdue ?? 0, tone: TILE.over, href: '/board?due=overdue' },
  ];
  const verify = t?.awaitingVerification ?? 0;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 17, flex: 1 }}>
          Tasks
        </Text>
        <Pressable onPress={() => router.push('/board')} style={styles.seeAll} accessibilityRole="link">
          <Text variant="label" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
            See all
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tiles.map((x) => (
          <Pressable key={x.label} onPress={() => router.push(x.href as never)} accessibilityRole="button" accessibilityLabel={`${x.value} ${x.label}`} style={({ pressed }) => [styles.tile, { backgroundColor: x.tone.bg }, pressed && { transform: [{ scale: 0.96 }] }]}>
            <Text variant="h2" color={x.tone.ink} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 22 }}>
              {x.value}
            </Text>
            <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 11, fontFamily: fonts.medium }}>
              {x.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => router.push('/board?status=COMPLETED')} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
        <View style={styles.rowIcon}>
          <Ionicons name="shield-checkmark" size={20} color={isDark ? '#C4B5FD' : '#7C3AED'} />
          {verify > 0 ? (
            <View style={styles.badge}>
              <Text variant="label" color="#FFFFFF" fixedColor style={{ fontSize: 10, fontFamily: fonts.bold }}>
                {verify}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
            Tasks to verify
          </Text>
          <Text variant="label" color={SME.fg4} fixedColor numberOfLines={1} style={{ fontSize: 12 }}>
            {verify > 0 ? `${verify} finished task${verify === 1 ? '' : 's'}: check the report and photos` : 'All caught up'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={SME.fg4} />
      </Pressable>
    </View>
  );
}

/**
 * Today's tasks on the overview: the newest first, refreshed every 20 seconds, so a task made by anyone
 * (customer care, a supervisor, another phone) shows up without leaving the page.
 */
export function TodayTasks({ bare }: { bare?: boolean } = {}) {
  const { data } = useApi<{ tasks: Task[] }>('/tasks?created=today', { poll: 20_000 });
  const tasks = [...(data?.tasks ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <View style={{ gap: 10 }}>
      {bare ? null : <View style={styles.head}>
        <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 17, flex: 1 }}>
          Today’s tasks{tasks.length ? ` · ${tasks.length}` : ''}
        </Text>
        <Pressable onPress={() => router.push('/board?status=' as never)} style={styles.seeAll} accessibilityRole="link">
          <Text variant="label" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
            See all
          </Text>
        </Pressable>
      </View>}
      {data && !tasks.length ? (
        <Text variant="bodySm" color={SME.fg4} fixedColor style={{ paddingHorizontal: 2 }}>
          No tasks yet today. New ones appear here as soon as they are made.
        </Text>
      ) : null}
      {tasks.slice(0, 5).map((t) => (
        <TaskCard key={t.id} task={t} showAssignee />
      ))}
    </View>
  );
}

/** The pay-with-M-Pesa banner (paybill from the server's MPESA_PAYBILL), account and support line. */
export function AdvertCard() {
  const info = usePublicInfo();
  const paybill = info?.paybill;
  const support = info?.support.phone;
  return (
    <View style={styles.advert}>
      <View style={styles.logoBox}>
        <Image source={LOGO} style={{ width: 96, height: 37 }} resizeMode="contain" accessibilityLabel="Optimas" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor style={{ fontSize: 11, fontFamily: fonts.semibold, letterSpacing: 1.6 }}>
          PAY WITH M-PESA
        </Text>
        {paybill ? (
          <Text variant="h2" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.bold, fontSize: 20, letterSpacing: 1 }}>
            Paybill <Text variant="h2" color="#E0292E" fixedColor style={{ fontFamily: fonts.bold, fontSize: 20 }}>{paybill}</Text>
          </Text>
        ) : (
          <Text variant="title" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 16 }}>
            Home of fibre internet
          </Text>
        )}
        <Text variant="label" color="rgba(255,255,255,0.8)" fixedColor style={{ fontSize: 12 }}>
          Account number: your Optimas account number
        </Text>
        <Text variant="label" color="rgba(255,255,255,0.65)" fixedColor numberOfLines={1} style={{ fontSize: 11, marginTop: 2 }}>
          {support ? `Support ${support} · ` : ''}optimaswifi.co.ke
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: SME.surface },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  seeAll: { paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: SME.surface3 },
  tile: { flex: 1, padding: 12, borderRadius: 16, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowIcon: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : '#EDE9FE' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  advert: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: '#0F2341', overflow: 'hidden' },
  logoBox: { padding: 8, borderRadius: 12, backgroundColor: '#FFFFFF' },
});
