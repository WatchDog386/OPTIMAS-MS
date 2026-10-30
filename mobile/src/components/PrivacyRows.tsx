import { useState } from 'react';
import { Platform, Share, Switch } from 'react-native';
import { router } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import { api, ApiError, API_URL, authHeader } from '../api/client';
import { useAuth } from '../store/auth';
import { promptDialog, toast } from '../store/feedback';
import { colors } from '../theme';
import { useBiometricSetting } from './BiometricSetting';
import { ListRow } from './ListRow';

/** Saves the person's own data export (JSON) to their device. */
async function downloadMyData() {
  const res = await fetch(`${API_URL}/auth/my-data`, { headers: { Accept: 'application/json', ...authHeader() } });
  if (!res.ok) throw new ApiError(res.status, 'Could not prepare your data. Try again.');
  const text = await res.text();
  const name = `optimas-my-data-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } else {
    await Share.share({ title: name, message: text });
  }
}

export interface PrivacyItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
  /** Fingerprint lock: whether it is on. */
  on?: boolean;
}

/**
 * The person's data rights and the legal pages, for Profile / Account: fingerprint lock, download my data,
 * privacy, terms, help, and (customers) delete my account. Rows or tiles draw these the same way.
 */
export function usePrivacyItems(): PrivacyItem[] {
  const user = useAuth((s) => s.user);
  const lock = useBiometricSetting();
  const [busy, setBusy] = useState<string | null>(null);
  if (!user) return [];

  const download = async () => {
    if (busy) return;
    setBusy('download');
    try {
      await downloadMyData();
      toast.success('Your data is downloaded', 'A file with everything the app holds about you.');
    } catch (e) {
      toast.error('Download failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    const password = await promptDialog({
      title: 'Delete your account?',
      message: 'Your account is closed and your name, phone, e-mail and location are removed. Visit and payment records are kept without your name. This cannot be undone. Enter your password to confirm.',
      icon: 'trash-outline',
      tone: 'danger',
      confirmLabel: 'Delete account',
      input: { placeholder: 'Your password', required: true, secret: true },
    });
    if (!password) return;
    setBusy('delete');
    try {
      await api('/auth/delete-account', { body: { password } });
      await useAuth.getState().logout();
      router.replace('/login');
      toast.success('Your account is deleted', 'Thank you for using Optimas.');
    } catch (e) {
      toast.error('Not deleted', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const items: PrivacyItem[] = [];
  if (lock) items.push({ key: 'lock', icon: 'finger-print', title: 'Fingerprint lock', sub: lock.busy ? 'Working…' : lock.on ? 'On · tap to turn off' : 'Off · tap to turn on', on: lock.on, onPress: () => void lock.toggle(!lock.on) });
  items.push(
    { key: 'data', icon: 'download-outline', title: 'Download my data', sub: busy === 'download' ? 'Preparing…' : 'Everything the app holds', onPress: download },
    { key: 'privacy', icon: 'shield-checkmark-outline', title: 'Privacy Policy', sub: 'How your data is used', onPress: () => router.push('/privacy') },
    { key: 'terms', icon: 'document-text-outline', title: 'Terms of Service', sub: 'The rules of the app', onPress: () => router.push('/terms') },
    { key: 'help', icon: 'help-buoy-outline', title: 'Help', sub: 'Guides and support', onPress: () => router.push(user.role === 'CUSTOMER' ? '/help' : '/help?who=technician') },
  );
  if (user.role === 'CUSTOMER') items.push({ key: 'delete', icon: 'trash-outline', title: 'Delete my account', sub: 'Close your account and remove your details', danger: true, onPress: remove });
  return items;
}

/** The privacy items as list rows (technician Profile, customer Account). */
export function PrivacyRows() {
  const items = usePrivacyItems();
  return (
    <>
      {items.map((i) =>
        i.key === 'lock' ? (
          <ListRow
            key={i.key}
            icon={i.icon}
            iconTint={colors.brand}
            title={i.title}
            subtitle={i.on ? 'On for this phone' : 'Unlock the app with your fingerprint'}
            onPress={i.onPress}
            chevron={false}
            right={<Switch value={!!i.on} onValueChange={i.onPress} trackColor={{ true: colors.brand, false: colors.border }} thumbColor={colors.white} accessibilityLabel="Fingerprint lock" />}
          />
        ) : (
          <ListRow key={i.key} icon={i.icon} iconTint={i.danger ? colors.danger : colors.text} title={i.title} subtitle={i.key === 'data' || i.danger ? i.sub : undefined} onPress={i.onPress} />
        ),
      )}
    </>
  );
}
