import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import type { SerialUnit } from '../src/api/types';
import { Button, Glass, Input, Screen, ScreenHeader, Text } from '../src/components';
import { useApi } from '../src/hooks/useApi';
import { toast } from '../src/store/feedback';
import { colors, fonts, space } from '../src/theme';
import { goBack } from '../src/utils/nav';
import { currentFix } from '../src/utils/location';
import { isPending, toastPending } from '../src/utils/stockApproval';

type Held = SerialUnit & { awaitingApproval?: string | null };

/*
 * Technician: record a router installed — no job needed. Pick the device from your hands (or type its SN
 * exactly as printed), say where it went and add your comments; your GPS position goes with it when the
 * phone gives it. An admin approves it, then the device moves from In hand to Installed.
 */
export default function Install() {
  const p = useLocalSearchParams<{ serial?: string }>();
  const { data } = useApi<{ units: Held[]; pending: Held[] }>('/inventory/my');
  const devices = [...(data?.units ?? []), ...(data?.pending ?? [])];
  const [serial, setSerial] = useState(p.serial ?? '');
  const [location, setLocation] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [note, setNote] = useState('');
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const pinHere = async () => {
    setLocating(true);
    const fix = await currentFix();
    setLocating(false);
    if (fix) setGps({ lat: fix.lat, lng: fix.lng });
    else toast.warning('Location not available', 'Allow location for this app, or describe the place in words.');
  };

  const chosen = serial.trim().toUpperCase();
  const ready = chosen.length >= 3 && location.trim().length >= 3 && note.trim().length >= 3;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api('/inventory/install', {
        body: {
          serial: chosen,
          location: location.trim(),
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          note: note.trim(),
          ...(gps ?? {}),
        },
      });
      if (isPending(r)) toastPending(r);
      else toast.success('Recorded installed', `${chosen} moved from In hand to Installed.`);
      goBack();
    } catch (e) {
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Send for approval" icon="send" size="lg" loading={busy} disabled={!ready || busy} onPress={submit} />}>
      <ScreenHeader title="Install a device" subtitle="No task needed · an admin approves it" />

      <Glass strong style={{ gap: space.md }}>
        <Text variant="label" color={colors.textMuted}>
          Which device?
        </Text>
        {devices.length ? (
          <View style={{ gap: 8 }}>
            {devices.map((u) => {
              const on = u.serialNumber === chosen;
              const waiting = !!u.awaitingApproval;
              return (
                <Pressable
                  key={u.id}
                  disabled={waiting}
                  onPress={() => setSerial(u.serialNumber)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: waiting }}
                  style={[styles.device, on && styles.deviceOn, waiting && { opacity: 0.5 }]}
                >
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontFamily: fonts.semibold }}>
                      {u.item.name}
                    </Text>
                    <Text variant="bodySm" color={colors.textMuted}>
                      SN {u.serialNumber}
                      {waiting ? ' · waiting for approval' : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : data ? (
          <Text variant="bodySm" color={colors.textMuted}>
            You hold no devices. Type the SN below if the store has not recorded it yet.
          </Text>
        ) : null}
        <Input
          label="Or type the SN"
          icon="barcode-outline"
          autoCapitalize="characters"
          value={serial}
          onChangeText={setSerial}
          placeholder="Exactly as printed next to “SN” — not the MAC"
        />
      </Glass>

      <Glass strong style={{ gap: space.md }}>
        <Text variant="label" color={colors.textMuted}>
          Where was it installed?
        </Text>
        <Input label="Place" icon="location-outline" multiline value={location} onChangeText={setLocation} placeholder="Estate, road, building, house no." />
        <Pressable onPress={pinHere} disabled={locating} accessibilityRole="button" style={styles.pin}>
          <Ionicons name={gps ? 'checkmark-circle' : 'navigate-outline'} size={18} color={gps ? colors.success : colors.primary} />
          <Text variant="bodySm" color={gps ? colors.success : colors.primary} style={{ fontFamily: fonts.semibold, flex: 1 }}>
            {locating ? 'Finding you…' : gps ? `Location added · ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : 'Add my current location (I am at the site)'}
          </Text>
        </Pressable>
        <Input label="Customer name (optional)" icon="person-outline" value={customerName} onChangeText={setCustomerName} />
        <Input label="Customer phone (optional)" icon="call-outline" keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
      </Glass>

      <Glass strong style={{ gap: space.md }}>
        <Text variant="label" color={colors.textMuted}>
          Comments for the admin
        </Text>
        <Input label="Comments" multiline value={note} onChangeText={setNote} placeholder="e.g. New connection, no task in the app. Configured Wi-Fi, customer tested internet." />
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  device: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  deviceOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
