import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../store/auth';
import { toast } from '../store/feedback';
import { colors } from '../theme';
import { disableLocationSharing, enableLocationSharing } from './LocationHost';
import { ListRow } from './ListRow';

/** "Share my location" switch for the Profile / Account page. */
export function LocationSetting() {
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  if (!user || (user.role !== 'TECHNICIAN' && user.role !== 'CUSTOMER')) return null;
  const on = user.locationConsent === true;
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disableLocationSharing();
        toast.info('Location is off', user.role === 'TECHNICIAN' ? 'The office can no longer see where you are.' : 'Your saved location was removed.');
      } else if (await enableLocationSharing()) toast.success('Location is on');
    } catch {
      toast.error('Could not change location sharing', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ListRow
      icon="location-outline"
      iconTint={colors.text}
      title="Share my location"
      subtitle={user.role === 'TECHNICIAN' ? 'For directions, tracking and the nearest jobs (only while the app is open)' : 'So technicians can find your premises'}
      onPress={busy ? undefined : toggle}
      chevron={false}
      right={
        <View style={[styles.switch, on && styles.on, busy && { opacity: 0.5 }]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
          <View style={[styles.knob, on && { transform: [{ translateX: 18 }] }]} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, padding: 3 },
  on: { backgroundColor: colors.success },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
});
