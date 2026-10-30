import { useEffect, useState } from 'react';
import { Switch } from 'react-native';
import { ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { useLock } from '../store/lock';
import { toast } from '../store/feedback';
import { colors } from '../theme';
import { biometricAvailable, disableBiometricLock, enableBiometricLock, lockKeyOnThisDevice } from '../utils/biometric';
import { ListRow } from './ListRow';

/** "Fingerprint lock" on/off for this phone. Hidden where the phone has no sensor the browser can use. */
export function BiometricSetting() {
  const user = useAuth((s) => s.user);
  const changed = useLock((s) => s.changed);
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricAvailable().then(setAvailable);
  }, []);
  useEffect(() => {
    setOn(!!user && !!lockKeyOnThisDevice(user.id));
  }, [user]);
  if (!user || !available) return null;

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        await enableBiometricLock(user.id);
        toast.success('Fingerprint lock is on', 'The app will ask for your fingerprint when you open it.');
      } else {
        await disableBiometricLock(user.id);
        toast.success('Fingerprint lock is off');
      }
      setOn(next);
      changed();
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') toast.error('Could not change the lock', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListRow
      icon="finger-print"
      iconTint={colors.brand}
      title="Fingerprint lock"
      subtitle={on ? 'On for this phone' : 'Unlock the app with your fingerprint'}
      onPress={() => void toggle(!on)}
      chevron={false}
      right={<Switch value={on} onValueChange={toggle} disabled={busy} trackColor={{ true: colors.brand, false: colors.border }} thumbColor={colors.white} accessibilityLabel="Fingerprint lock" />}
    />
  );
}
