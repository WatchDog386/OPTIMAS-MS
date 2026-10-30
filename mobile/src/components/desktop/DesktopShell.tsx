import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Role } from '../../api/types';
import { useApi } from '../../hooks/useApi';
import { homeFor, useAuth } from '../../store/auth';
import { fonts } from '../../theme';
import { useDesktop } from '../../theme/desktop';
import { Text } from '../Text';

/** The Business-SME desktop colours: navy rail, light page. */
export const desk = {
  nav: '#0E2135',
  navText: '#E2E8F0',
  navMuted: '#8A9AAE',
  navActive: '#4DA3FF',
  navHover: 'rgba(255,255,255,0.06)',
  orgCard: 'rgba(255,255,255,0.06)',
  page: '#F7F8FA',
  bar: '#FFFFFF',
  border: '#E5E7EB',
  ink: '#17201C',
  muted: '#6B7280',
  green: '#2DA043',
};

type Icon = keyof typeof Ionicons.glyphMap;
type Item = { label: string; icon: Icon; href: string; badge?: number };
type Group = { title?: string; items: Item[] };

const ROLE_NAME: Record<Role, string> = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', STOREKEEPER: 'Store', TECHNICIAN: 'Technician', CUSTOMER: 'Customer', CUSTOMER_CARE: 'Customer care' };

/** What each role finds in the side rail, grouped like the Business-SME app (MONEY, CLIENTS, …). */
function navFor(role: Role, open: { requests?: number; approvals?: number }): { groups: Group[]; bottom: Item[] } {
  const bell: Item = { label: 'Notifications', icon: 'notifications-outline', href: '/notifications' };
  if (role === 'CUSTOMER_CARE')
    return {
      groups: [
        { items: [{ label: 'Home', icon: 'home-outline', href: '/care' }] },
        { title: 'Customers', items: [{ label: 'Support chats', icon: 'chatbubbles-outline', href: '/support' }, { label: 'Requests', icon: 'megaphone-outline', href: '/care-requests', badge: open.requests }, { label: 'New customer', icon: 'person-add-outline', href: '/admin/user-new?role=CUSTOMER' }] },
        { title: 'Jobs', items: [{ label: 'New job', icon: 'add-circle-outline', href: '/admin/task-new' }, { label: 'All jobs', icon: 'briefcase-outline', href: '/care-jobs' }] },
      ],
      bottom: [bell, { label: 'Profile', icon: 'person-circle-outline', href: '/care-profile' }],
    };
  if (role === 'TECHNICIAN')
    return {
      groups: [
        { items: [{ label: 'Home', icon: 'home-outline', href: '/home' }] },
        { title: 'Work', items: [{ label: 'Jobs', icon: 'briefcase-outline', href: '/jobs' }, { label: 'My stock', icon: 'cube-outline', href: '/stock' }, { label: 'Chats', icon: 'chatbubble-ellipses-outline', href: '/messages' }] },
      ],
      bottom: [bell, { label: 'Profile', icon: 'person-circle-outline', href: '/profile' }],
    };
  if (role === 'CUSTOMER')
    return {
      groups: [{ items: [{ label: 'Home', icon: 'home-outline', href: '/portal' }, { label: 'Requests', icon: 'chatbubbles-outline', href: '/requests' }] }],
      bottom: [bell, { label: 'Account', icon: 'person-circle-outline', href: '/account' }],
    };
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  const groups: Group[] = [
    { items: [{ label: 'Home', icon: 'home-outline', href: '/overview' }] },
    {
      title: 'Operations',
      items: [
        { label: 'Jobs', icon: 'briefcase-outline', href: '/board' },
        ...(managers
          ? [
              { label: 'Requests', icon: 'megaphone-outline' as Icon, href: '/admin/requests', badge: open.requests },
              { label: 'Approvals', icon: 'checkmark-done-circle-outline' as Icon, href: '/admin/approvals', badge: open.approvals },
              { label: 'Live map', icon: 'map-outline' as Icon, href: '/admin/map' },
            ]
          : []),
        { label: 'Chats', icon: 'chatbubble-ellipses-outline', href: '/chat' },
      ],
    },
    ...(managers
      ? [
          {
            title: 'People',
            items: [
              { label: 'Team', icon: 'people-outline' as Icon, href: '/team' },
              { label: 'People', icon: 'person-outline' as Icon, href: '/admin/users' },
              { label: 'Attendance', icon: 'calendar-outline' as Icon, href: '/admin/attendance' },
            ],
          },
        ]
      : []),
    {
      title: 'Store',
      items: [
        { label: 'Store', icon: 'cube-outline', href: '/store' },
        { label: 'Catalogue', icon: 'pricetags-outline', href: '/admin/items' },
        { label: 'Reconcile', icon: 'git-compare-outline', href: '/admin/reconciliation' },
        { label: 'Trace device', icon: 'search-outline', href: '/admin/unit' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Reports', icon: 'bar-chart-outline', href: '/admin/reports' },
        ...(managers ? [{ label: 'Charts', icon: 'stats-chart-outline' as Icon, href: '/admin/charts' }, { label: 'Leaderboard', icon: 'trophy-outline' as Icon, href: '/admin/leaderboard' }] : []),
      ],
    },
  ];
  return { groups, bottom: [bell, { label: 'Profile', icon: 'person-circle-outline', href: '/more' }] };
}

/** Pages that take the whole window (camera, scanner) or come before signing in. */
const BARE = ['/login', '/capture', '/scan', '/change-password', '/help', '/privacy', '/terms', '/verify'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * On a laptop or desktop browser the app gets the Business-SME frame: a navy side rail with the
 * sections, and a white top bar with the page name, search, alerts and the signed-in person. Phones
 * keep the floating tab bar.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const user = useAuth((s) => s.user);
  const path = usePathname();
  const on = desktop && !!user && !user.mustChangePassword && !BARE.some((p) => path === p || path.startsWith(`${p}/`));
  if (!on) return <>{children}</>;
  return <Frame path={path}>{children}</Frame>;
}

function Frame({ path, children }: { path: string; children: ReactNode }) {
  const user = useAuth((s) => s.user)!;
  const managers = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const care = user.role === 'CUSTOMER_CARE';
  const unread = useApi<{ unread: number }>('/notifications/unread-count', { poll: 60_000 });
  const requests = useApi<{ requests: unknown[] }>(managers || care ? '/requests?status=OPEN' : null, { poll: 60_000 });
  const approvals = useApi<{ total: number }>(managers ? '/approvals/summary' : null, { poll: 60_000 });
  const nav = navFor(user.role, { requests: requests.data?.requests.length, approvals: approvals.data?.total });
  const bell = unread.data?.unread ?? 0;
  const items = [...nav.groups.flatMap((g) => g.items), ...nav.bottom];
  const bare = (h: string) => h.split('?')[0]!;
  // The longest matching link is the page we are on
  const active = items.filter((i) => path === bare(i.href) || path.startsWith(`${bare(i.href)}/`)).sort((a, b) => bare(b.href).length - bare(a.href).length)[0];
  const go = (href: string) => router.navigate(href as never);

  const link = (i: Item) => {
    const on = active?.href === i.href;
    const badge = i.label === 'Notifications' ? bell : i.badge;
    return (
      <Pressable key={i.href} onPress={() => go(i.href)} style={(state) => [styles.item, (state as { hovered?: boolean }).hovered && !on && { backgroundColor: desk.navHover }]} accessibilityRole="link" accessibilityState={{ selected: on }}>
        <Ionicons name={i.icon} size={19} color={on ? desk.navActive : desk.navText} />
        <Text variant="body" color={on ? desk.navActive : desk.navText} fixedColor style={[styles.itemText, on && { fontFamily: fonts.medium }]} numberOfLines={1}>
          {i.label}
        </Text>
        {badge ? (
          <View style={styles.badge}>
            <Text variant="label" color="#FFFFFF" fixedColor style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.rail}>
        <Pressable onPress={() => go(homeFor(user.role))} style={styles.org} accessibilityRole="link" accessibilityLabel="Home">
          <Text variant="title" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>
            Optimas Fibre
          </Text>
          <Text variant="label" color={desk.navMuted} fixedColor numberOfLines={1}>
            {ROLE_NAME[user.role]}
          </Text>
        </Pressable>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
          {nav.groups.map((g, gi) => (
            <View key={g.title ?? gi} style={{ marginBottom: 10 }}>
              {g.title ? (
                <Text variant="label" color={desk.navMuted} fixedColor style={styles.group}>
                  {g.title.toUpperCase()}
                </Text>
              ) : null}
              {g.items.map(link)}
            </View>
          ))}
        </ScrollView>
        <View style={styles.railBottom}>{nav.bottom.map(link)}</View>
      </View>

      <View style={styles.main}>
        <View style={styles.bar}>
          <Text variant="body" color={desk.ink} fixedColor style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
            {active?.label ?? ''}
          </Text>
          <Pressable onPress={() => go('/search')} style={styles.barBtn} accessibilityLabel="Search">
            <Ionicons name="search-outline" size={20} color={desk.muted} />
          </Pressable>
          <Pressable onPress={() => go('/notifications')} style={styles.barBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color={desk.muted} />
            {bell ? (
              <View style={[styles.badge, styles.barBadge]}>
                <Text variant="label" color="#FFFFFF" fixedColor style={styles.badgeText}>
                  {bell > 99 ? '99+' : bell}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={() => go(nav.bottom[nav.bottom.length - 1]!.href)} style={styles.me} accessibilityLabel="Profile">
            <View style={styles.avatar}>
              <Text variant="label" color={desk.ink} fixedColor style={{ fontFamily: fonts.semibold }}>
                {initials(user.name)}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={14} color={desk.muted} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: desk.page },
  rail: { width: 240, backgroundColor: desk.nav, paddingHorizontal: 8, paddingTop: 8 },
  org: { paddingHorizontal: 12, paddingVertical: 11, borderRadius: 8, backgroundColor: desk.orgCard, gap: 1, marginBottom: 10 },
  group: { paddingHorizontal: 8, marginTop: 12, marginBottom: 6, letterSpacing: 1.2, fontSize: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 38, paddingHorizontal: 8, borderRadius: 8 },
  itemText: { flex: 1, fontSize: 14.5 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13 },
  railBottom: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  main: { flex: 1, minWidth: 0 },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, backgroundColor: desk.bar, borderBottomWidth: 1, borderBottomColor: desk.border },
  barBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  barBadge: { position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 9 },
  me: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 6 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
});
