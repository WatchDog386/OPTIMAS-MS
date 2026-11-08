import { useEffect, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { User } from '../api/types';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import { usePageLoad } from '../store/pageLoad';
import { fonts } from '../theme';
import { confirmAction } from '../utils/confirm';
import { humanize } from '../utils/format';
import { unregisterPush } from '../utils/push';
import { changeAvatar, removeAvatar } from '../utils/avatar';
import { ProfileInstallCard } from './InstallPrompt';
import { useLocationSetting } from './LocationSetting';
import { usePrivacyItems } from './PrivacyRows';
import { TAB_BAR_CLEARANCE } from './Screen';
import { ShiftCard } from './ShiftCard';
import { ProfileRing, SME, SmeAppBar, useScrolledBar, SmeLogOut, SmeRow, SmeSection } from './SmeKit';
import { Text } from './Text';

type IconName = keyof typeof Ionicons.glyphMap;
/** A role's own tools on its profile (notifications, trace a device, office location …). */
export interface ProfileTool {
  key: string;
  icon: IconName;
  title: string;
  sub?: string;
  onPress: () => void;
  count?: number;
}

/** How complete the profile is: people can reach you, and you have your own password. */
function completion(u: User) {
  const checks = [!!u.name, !!u.phone, !!u.email, !!u.region, !u.mustChangePassword];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * The profile page, as in Optimas-SME: "Back · My Profile", the photo ring with how complete the profile
 * is, name and contact lines, then sections of rows (the role's tools, security, appearance, privacy and
 * help) and a red "Log out". `children` adds a role's own sections (a technician's attendance).
 */
export function SmeProfilePage({ tools = [], children, tabs = true }: { tools?: ProfileTool[]; children?: ReactNode; tabs?: boolean }) {
  const insets = useSafeAreaInsets();
  const bar = useScrolledBar();
  const stored = useAuth((s) => s.user)!;
  const me = useApi<{ user: User }>('/auth/me');
  const user = me.data?.user ?? stored;
  const managers = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const privacy = usePrivacyItems();
  const location = useLocationSetting();
  const lock = privacy.find((p) => p.key === 'lock');
  const theme = privacy.find((p) => p.key === 'theme');
  const others = privacy.filter((p) => p.key !== 'lock' && p.key !== 'theme');
  useEffect(() => usePageLoad.getState().shown(), []);

  // The pencil changes the photo; the new account comes back from the server
  const photo = async (fn: () => Promise<User | null>) => {
    const updated = await fn();
    if (updated) me.setData({ user: updated });
  };
  const allTools: ProfileTool[] = managers
    ? [...tools, { key: 'edit', icon: 'create-outline', title: 'Edit my details', sub: 'Name, phone, e-mail and region', onPress: () => router.push(`/admin/user-edit?id=${user.id}` as never) }]
    : tools;
  const signOut = async () => {
    if (!(await confirmAction('Log out', 'Are you sure you want to log out?', 'Log out'))) return;
    await unregisterPush();
    await useAuth.getState().logout();
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <SmeAppBar title="My Profile" scrolled={bar.scrolled} />
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={32} contentContainerStyle={[styles.body, { paddingBottom: (tabs ? TAB_BAR_CLEARANCE : 32) + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ProfileRing percent={completion(user)} initial={user.name?.charAt(0).toUpperCase()} photo={user.avatarUrl} onEdit={() => void photo(changeAvatar)} />
          <Text variant="title" color={SME.fg} fixedColor style={styles.name}>
            {user.name}
          </Text>
          <View style={{ gap: 2, alignItems: 'center' }}>
            <Line icon="id-card-outline" text={`${humanize(user.role)} · ${user.staffNo}${user.region ? ` · ${user.region}` : ''}`} />
            {user.phone ? <Line icon="call-outline" text={user.phone} /> : null}
            {user.email ? <Line icon="mail-outline" text={user.email} /> : null}
          </View>
          {user.avatarUrl ? (
            <Pressable onPress={() => void photo(removeAvatar)} hitSlop={8} accessibilityRole="button" style={styles.remove}>
              <Ionicons name="trash-outline" size={13} color="#DC2626" />
              <Text variant="label" color="#DC2626" fixedColor style={{ fontFamily: fonts.medium, fontSize: 12 }}>
                Remove photo
              </Text>
            </Pressable>
          ) : (
            <Text variant="label" color={SME.fg5} fixedColor style={{ fontSize: 10, marginTop: 8 }}>
              Tap the pencil to add a photo
            </Text>
          )}
        </View>

        <ProfileInstallCard />
        <ShiftCard />

        {allTools.length ? (
          <SmeSection title="Tools">
            {allTools.map((t) => (
              <SmeRow key={t.key} icon={t.icon} title={t.title} sub={t.sub} onPress={t.onPress} count={t.count} />
            ))}
          </SmeSection>
        ) : null}

        {children}

        <SmeSection title="Security">
          {lock ? <SmeRow icon="finger-print" title="Fingerprint lock" sub={lock.on ? 'On for this phone' : 'Unlock the app with your fingerprint'} toggle={!!lock.on} onPress={lock.onPress} /> : null}
          <SmeRow icon="key-outline" title="Change password" sub="Keep your account safe" onPress={() => router.push('/change-password')} />
          {location ? <SmeRow icon="location-outline" title="Share my location" sub={location.sub} toggle={location.on} busy={location.busy} onPress={() => void location.toggle()} /> : null}
        </SmeSection>

        {theme ? (
          <SmeSection title="Appearance">
            <SmeRow icon={theme.on ? 'moon' : 'sunny'} iconColor={theme.on ? undefined : '#F59E0B'} title="Dark mode" sub={theme.on ? 'On' : 'Off'} toggle={!!theme.on} onPress={theme.onPress} />
          </SmeSection>
        ) : null}

        <SmeSection title="Privacy and help">
          {others.map((i) => (
            <SmeRow key={i.key} icon={i.icon} title={i.title} sub={i.sub} onPress={i.onPress} danger={i.danger} />
          ))}
        </SmeSection>

        <SmeLogOut onPress={signOut} />
        <Text variant="label" color={SME.fg4} fixedColor align="center" style={{ fontSize: 11 }}>
          Optimas MS · © 2026 Optimas Technologies Ltd.
        </Text>
      </ScrollView>
    </View>
  );
}

function Line({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={13} color={SME.fg3} />
      <Text variant="label" color={SME.fg3} fixedColor style={{ fontFamily: fonts.medium, fontSize: 12 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SME.page },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 24, maxWidth: 672, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', paddingTop: 16 },
  name: { fontFamily: fonts.medium, fontSize: 16, marginTop: 28, marginBottom: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
});
