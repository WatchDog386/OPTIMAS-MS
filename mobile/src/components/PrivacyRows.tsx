import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError, API_URL, authHeader } from '../api/client';
import { useAuth } from '../store/auth';
import { promptDialog, toast } from '../store/feedback';
import { colors } from '../theme';
import { BiometricSetting } from './BiometricSetting';
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

/**
 * The person's data rights and the legal pages, for Profile / Account: download my data, privacy,
 * terms, help, and (customers) delete my account.
 */
export function PrivacyRows() {
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState<string | null>(null);
  if (!user) return null;

  const download = async () => {
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

  return (
    <>
      <BiometricSetting />
      <ListRow icon="download-outline" iconTint={colors.text} title="Download my data" subtitle="A copy of everything the app holds about you" onPress={busy ? undefined : download} />
      <ListRow icon="shield-checkmark-outline" iconTint={colors.text} title="Privacy Policy" onPress={() => router.push('/privacy')} />
      <ListRow icon="document-text-outline" iconTint={colors.text} title="Terms of Service" onPress={() => router.push('/terms')} />
      <ListRow icon="help-buoy-outline" iconTint={colors.text} title="Help" onPress={() => router.push(user.role === 'CUSTOMER' ? '/help' : '/help?who=technician')} />
      {user.role === 'CUSTOMER' ? <ListRow icon="trash-outline" iconTint={colors.danger} title="Delete my account" subtitle="Close your account and remove your details" onPress={busy ? undefined : remove} /> : null}
    </>
  );
}
