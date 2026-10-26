import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { Dashboard, User } from '../../src/api/types';
import { Text } from '../../src/components';
import { TAB_BAR_CLEARANCE } from '../../src/components/Screen';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { fonts } from '../../src/theme';
import { confirmAction } from '../../src/utils/confirm';
import { humanize } from '../../src/utils/format';
import { unregisterPush } from '../../src/utils/push';
import { useStatusBarColor } from '../../src/utils/statusBar';

/* Dark "profile & tools" page: completion ring, then a grid of tools with live counts. */

const BG = '#000000';
const GREEN = '#7DC242';
const LINE = 'rgba(255,255,255,0.22)';
const MUTED = 'rgba(255,255,255,0.7)';

type IconName = keyof typeof Ionicons.glyphMap;
interface Tile {
  key: string;
  icon: IconName;
  title: string;
  sub: string;
  href: string;
  count?: number;
}

/** What makes a profile complete: people can reach you, and you have your own password. */
function completion(u: User) {
  const checks = [!!u.name, !!u.phone, !!u.email, !!u.region, !u.mustChangePassword];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function More() {
  useStatusBarColor(BG);
  const insets = useSafeAreaInsets();
  const stored = useAuth((s) => s.user)!;
  const me = useApi<{ user: User }>('/auth/me');
  const dash = useApi<Dashboard>('/reports/dashboard');
  const unread = useApi<{ unread: number }>('/notifications/unread-count');
  const user = me.data?.user ?? stored;
  const role = user.role;
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  const d = dash.data;
  const pct = completion(user);
  const flagged = d ? d.routers.overdueInCustody + d.routers.missingInSpotCounts + d.routers.lostLast30Days : 0;

  const tiles: Tile[] = [
    ...(managers
      ? [
          { key: 'people', icon: 'people-outline' as IconName, title: 'People', sub: 'Staff & customer accounts', href: '/admin/users' },
          { key: 'req', icon: 'chatbubbles-outline' as IconName, title: 'Customer requests', sub: 'Visits customers asked for', href: '/admin/requests', count: d?.requests?.open },
          { key: 'dress', icon: 'shirt-outline' as IconName, title: 'Dress-code reviews', sub: 'Approve check-in photos', href: '/admin/reviews', count: d?.attendance.pendingDressReviews },
          { key: 'verify', icon: 'shield-checkmark-outline' as IconName, title: 'Jobs to verify', sub: 'Proof photos & materials', href: '/board?status=COMPLETED', count: d?.tasks.awaitingVerification },
          { key: 'att', icon: 'calendar-outline' as IconName, title: 'Attendance', sub: 'Check-ins, photos, absentees', href: '/admin/attendance' },
        ]
      : []),
    { key: 'reports', icon: 'download-outline', title: 'Reports & exports', sub: 'Excel: attendance, jobs, stock', href: '/admin/reports' },
    { key: 'recon', icon: 'git-compare-outline', title: 'Reconciliation', sub: 'Issued vs installed vs held', href: '/admin/reconciliation', count: flagged },
    { key: 'items', icon: 'pricetags-outline', title: 'Catalogue', sub: 'Items, prices, reorder levels', href: '/admin/items', count: d?.lowStockItems },
    { key: 'ledger', icon: 'list-outline', title: 'Stock ledger', sub: 'Every movement, newest first', href: '/admin/movements' },
    { key: 'trace', icon: 'barcode-outline', title: 'Trace a device', sub: 'Custody by serial number', href: '/admin/unit' },
    { key: 'search', icon: 'search-outline', title: 'Search', sub: 'Jobs, devices, people', href: '/search' },
    { key: 'alerts', icon: 'notifications-outline', title: 'Notifications', sub: 'Alerts and activity', href: '/notifications', count: unread.data?.unread },
    ...(role === 'ADMIN' ? [{ key: 'audit', icon: 'finger-print-outline' as IconName, title: 'Audit log', sub: 'Who changed what, and when', href: '/admin/audit' }] : []),
    { key: 'pw', icon: 'key-outline', title: 'Change password', sub: 'Keep your account safe', href: '/change-password' },
  ];

  const edit = () => router.push(managers ? `/admin/user-edit?id=${user.id}` : '/change-password');
  const signOut = async () => {
    if (!(await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out'))) return;
    await unregisterPush();
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.headerSide} />
        <Text variant="title" color="#FFFFFF" fixedColor style={styles.headerTitle}>
          Profile & tools
        </Text>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={styles.headerSide} accessibilityLabel="Notifications">
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.profile}>
          <CompletionRing pct={pct} onEdit={edit} />
          <Text variant="title" color="#FFFFFF" fixedColor style={styles.name}>
            {user.name}
          </Text>
          <Text variant="label" color={MUTED} fixedColor>
            {humanize(user.role)} · {user.staffNo}
            {user.region ? ` · ${user.region}` : ''}
          </Text>
        </View>

        <View style={styles.intro}>
          <Text variant="bodySm" color="#FFFFFF" fixedColor>
            {pct < 100 ? 'Complete your profile so your team can reach you' : 'Your profile is complete'}
          </Text>
        </View>

        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable key={t.key} onPress={() => router.push(t.href as never)} accessibilityRole="button" accessibilityLabel={t.title} style={({ pressed }) => [styles.tile, pressed && { backgroundColor: '#0F0F0F' }]}>
              {t.count ? (
                <View style={styles.badge}>
                  <Text variant="label" color="#FF3B30" fixedColor style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                    {t.count > 99 ? '99+' : t.count}
                  </Text>
                </View>
              ) : null}
              <BubbleIcon name={t.icon} />
              <Text variant="title" color="#FFFFFF" fixedColor style={styles.tileTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text variant="label" color={MUTED} fixedColor numberOfLines={1} style={{ fontSize: 11, textAlign: 'center' }}>
                {t.sub}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color="#FF6B5E" />
          <Text variant="title" color="#FF6B5E" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            Sign out
          </Text>
        </Pressable>
        <Text variant="label" color="rgba(255,255,255,0.4)" fixedColor style={{ textAlign: 'center', marginTop: 14, fontSize: 11 }}>
          Optimas MS · © 2026 Optimas Technologies Ltd.
        </Text>
      </ScrollView>
    </View>
  );
}

/** Avatar inside a ring that fills with profile completeness, a % pill and an edit pencil. */
function CompletionRing({ pct, onEdit }: { pct: number; onEdit: () => void }) {
  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#FFFFFF" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={GREEN}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.avatar}>
        <Ionicons name="person" size={92} color="#C9C9C9" style={{ marginTop: 26 }} />
      </View>
      <View style={styles.pct}>
        <Text variant="label" color={GREEN} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
          {pct}%
        </Text>
      </View>
      <Pressable onPress={onEdit} style={styles.pencil} accessibilityLabel="Edit profile" hitSlop={6}>
        <Ionicons name="pencil" size={18} color={GREEN} />
      </Pressable>
    </View>
  );
}

/** Green outlined speech-bubble icon from the reference. */
function BubbleIcon({ name }: { name: IconName }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 10 }}>
      <View style={styles.bubble}>
        <Ionicons name={name} size={22} color={GREEN} />
      </View>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerSide: { width: 32, alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18 },
  profile: { alignItems: 'center', gap: 6, paddingTop: 30 },
  name: { fontFamily: fonts.semibold, fontSize: 19, marginTop: 12 },
  intro: { marginHorizontal: 20, marginTop: 26, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.35)' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 20, paddingTop: 22 },
  tile: { width: '48.5%', minHeight: 150, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 18, borderRadius: 12, borderWidth: 1.5, borderColor: LINE, backgroundColor: BG },
  tileTitle: { fontFamily: fonts.bold, fontSize: 14, textAlign: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 34, height: 34, paddingHorizontal: 4, borderRadius: 17, borderWidth: 2.5, borderColor: GREEN, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 48, height: 48, borderRadius: 10, borderWidth: 3, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  tail: { width: 0, height: 0, marginTop: -1, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: GREEN },
  avatar: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', bottom: 4, paddingHorizontal: 16, height: 30, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pencil: { position: 'absolute', right: -10, top: 86, width: 46, height: 46, borderRadius: 23, backgroundColor: '#222222', alignItems: 'center', justifyContent: 'center' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 26, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,107,94,0.5)' },
});
