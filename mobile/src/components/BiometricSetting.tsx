import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../store/auth';
import { useLock } from '../store/lock';
import { toast } from '../store/feedback';
import { biometricAvailable, biometricProblem, disableBiometricLock, enableBiometricLock, lockKeyOnThisDevice, prepareBiometric } from '../utils/biometric';

/** The fingerprint lock's state on this phone and its on/off switch; null where the phone has no usable sensor. */
export function useBiometricSetting() {
  const user = useAuth((s) => s.user);
  const changed = useLock((s) => s.changed);
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false); // the row and its switch can both fire for one tap

  useEffect(() => {
    void biometricAvailable().then(setAvailable);
  }, []);
  useEffect(() => {
    const isOn = !!user && !!lockKeyOnThisDevice(user.id);
    setOn(isOn);
    // Ready before the tap, so the fingerprint prompt opens straight away
    if (user && available && !isOn) void prepareBiometric('register');
  }, [user, available]);
  const toggle = async (next: boolean) => {
    if (working.current || !user) return;
    working.current = true;
    setBusy(true);
    try {
      if (next) {
        await enableBiometricLock(user.id);
        toast.success('Fingerprint lock is on', 'The app will ask for your fingerprint when you open it.');
      } else {
        await disableBiometricLock(user.id);
        toast.success('Fingerprint lock is off');
        void prepareBiometric('register');
      }
      setOn(next);
      changed();
    } catch (e) {
      toast.error(next ? 'Fingerprint not set up' : 'Could not change the lock', biometricProblem(e));
      if (next) void prepareBiometric('register');
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  return user && available ? { on, busy, toggle } : null;
}
