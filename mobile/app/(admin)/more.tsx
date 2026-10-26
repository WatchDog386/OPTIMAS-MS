import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import type { User } from '../../src/api/types';
import { GlassBackground, Text } from '../../src/components';
import { TAB_BAR_CLEARANCE } from '../../src/components/Screen';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { confirmAction } from '../../src/utils/confirm';
import { humanize } from '../../src/utils/format';
import { unregisterPush } from '../../src/utils/push';
import { DemoNotice } from '../../src/components/DemoNotice';

/* "Profile": completion ring and the few account tools — in the app's glass theme. */

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
  const insets = useSafeAreaInsets();
  const stored = useAuth((s) => s.user)!;
  const me = useApi<{ user: User }>('/auth/me');
  const unread = useApi<{ unread: number }>('/notifications/unread-count');
  const user = me.data?.user ?? stored;
  const role = user.role;
  const managers = role === 'ADMIN' || role === 'SUPERVISOR';
  const pct = completion(user);

  const tiles: Tile[] = [
    { key: 'alerts', icon: 'notifications-outline', title: 'Notifications', sub: 'Alerts and activity', href: '/notifications', count: unread.data?.unread },
    { key: 'trace', icon: 'barcode-outline', title: 'Trace a device', sub: 'Custody by serial number', href: '/admin/unit' },
    ...(role === 'ADMIN' ? [{ key: 'audit', icon: 'finger-print-outline' as IconName, title: 'Audit log', sub: 'Who changed what', href: '/admin/audit' }] : []),
    { key: 'pw', icon: 'key-outline', title: 'Change password', sub: 'Keep your account safe', href: '/change-password' },
  ];

  // Back to wherever the person came from; straight to the dashboard if the page was opened directly
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/overview'));
  const edit = () => router.push(managers ? `/admin/user-edit?id=${user.id}` : '/change-password');
  const signOut = async () => {
    if (!(await confirmAction('Sign out', 'Are you sure you want to sign out?', 'Sign out'))) return;
    await unregisterPush();
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <GlassBackground />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="title" style={styles.headerTitle}>
          Profile
        </Text>
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }} showsVerticalScrollIndicator={false}>
        <DemoNotice style={{ marginHorizontal: 20, marginBottom: 12 }} />
        <View style={styles.profile}>
          <CompletionRing pct={pct} onEdit={edit} />
          <Text variant="title" style={styles.name}>
            {user.name}
          </Text>
          <Text variant="label" color={colors.textMuted}>
            {humanize(user.role)} · {user.staffNo}
            {user.region ? ` · ${user.region}` : ''}
          </Text>
        </View>

        <View style={styles.grid}>
          {tiles.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => router.push(t.href as never)}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              {t.count ? (
                <View style={styles.badge}>
                  <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                    {t.count > 99 ? '99+' : t.count}
                  </Text>
                </View>
              ) : null}
              <BubbleIcon name={t.icon} />
              <Text variant="title" style={styles.tileTitle} numberOfLines={1}>
                {t.title}
              </Text>
              <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11, textAlign: 'center' }}>
                {t.sub}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={signOut} style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text variant="title" color={colors.danger} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            Sign out
          </Text>
        </Pressable>
        <Text variant="label" color={colors.textDim} style={{ textAlign: 'center', marginTop: 14, fontSize: 11 }}>
          Optimas MS · © 2026 Optimas Technologies Ltd.
        </Text>
      </ScrollView>
    </View>
  );
}

/** Avatar inside a ring that fills with profile completeness, a % pill and an edit pencil. */
function CompletionRing({ pct, onEdit }: { pct: number; onEdit: () => void }) {
  const size = 112;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(28,29,31,0.08)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.highlight}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.avatar}>
        <Ionicons name="person" size={60} color={colors.charcoal} style={{ marginTop: 16 }} />
      </View>
      <View style={styles.pct}>
        <Text variant="label" style={{ fontFamily: fonts.bold, fontSize: 12 }}>
          {pct}%
        </Text>
      </View>
      <Pressable onPress={onEdit} style={styles.pencil} accessibilityLabel="Edit profile" hitSlop={6}>
        <Ionicons name="pencil" size={15} color={colors.highlight} />
      </Pressable>
    </View>
  );
}

/** Green outlined speech-bubble icon from the reference. */
function BubbleIcon({ name }: { name: IconName }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 10 }}>
      <View style={styles.bubble}>
        <Ionicons name={name} size={22} color={colors.text} />
      </View>
      <View style={styles.tail} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  backSpacer: { width: 40, height: 40 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 18 },
  profile: { alignItems: 'center', gap: 4, paddingTop: 6 },
  name: { fontFamily: fonts.semibold, fontSize: 18, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 20, paddingTop: 24 },
  tile: {
    width: '48.5%',
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    shadowColor: '#1C1D1F',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  tileTitle: { fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: colors.bgTop,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.highlight,
  },
  avatar: { width: 92, height: 92, borderRadius: 46, overflow: 'hidden', backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  pct: { position: 'absolute', bottom: -2, paddingHorizontal: 12, height: 24, borderRadius: 12, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  pencil: { position: 'absolute', right: -6, top: 54, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.charcoal, alignItems: 'center', justifyContent: 'center' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginTop: 26, height: 52, borderRadius: 26, backgroundColor: colors.dangerSoft },
});
