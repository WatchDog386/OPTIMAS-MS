import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../src/api/client';
import type { Onboarded } from '../src/api/field';
import type { Task } from '../src/api/types';
import { Button, Glass, Input, MapCanvas, PageHeader, Reveal, Screen, TempPasswordCard, Text } from '../src/components';
import { celebrate, toast } from '../src/store/feedback';
import { colors, fonts, radius, space } from '../src/theme';
import { askLocation, currentFix, type Fix } from '../src/utils/location';

/**
 * Onboarding: the technician installing a customer's Wi-Fi creates the customer's Optimas app account on
 * the spot. The customer signs in with their account number and the one-time password, then picks their own.
 */
export default function Onboard() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [account, setAccount] = useState('');
  const [pinHere, setPinHere] = useState(true);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Onboarded | null>(null);

  // Start from what the job already knows about the customer
  useEffect(() => {
    if (!taskId) return;
    api<{ task: Task }>(`/tasks/${taskId}`)
      .then(({ task: t }) => {
        setTask(t);
        setName((v) => v || t.customerName);
        setPhone((v) => v || (t.customerPhone ?? ''));
        setAddress((v) => v || t.address);
        setAccount((v) => v || (t.customerAccount ?? ''));
      })
      .catch(() => undefined);
  }, [taskId]);

  // Standing at the premises: use this phone's position as the customer's pin
  useEffect(() => {
    if (!pinHere || fix) return;
    setLocating(true);
    void askLocation()
      .then((ok) => (ok ? currentFix() : null))
      .then((f) => {
        if (f) setFix(f);
        else setPinHere(false);
      })
      .finally(() => setLocating(false));
  }, [pinHere, fix]);

  const pin = pinHere && fix ? { lat: fix.lat, lng: fix.lng } : task?.lat != null && task?.lng != null ? { lat: task.lat, lng: task.lng } : null;

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const res = await api<Onboarded>('/users/onboard-customer', {
        body: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, address: address.trim(), customerAccount: account.trim() || undefined, taskId: taskId || undefined, ...(pin ?? {}) },
      });
      setDone(res);
      celebrate('Customer onboarded', `${res.user.name} can now use the Optimas app.`);
    } catch (e) {
      if (e instanceof ApiError && e.details?.length) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      toast.error('Could not create the account', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen footer={<Button label="Done" icon="checkmark" size="lg" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />}>
        <PageHeader title="Customer onboarded" right={null} />
        <Reveal index={0}>
          <Glass strong style={{ gap: 10, alignItems: 'center', paddingVertical: space.xl }}>
            <View style={styles.okIcon}>
              <Ionicons name="checkmark" size={34} color={colors.white} />
            </View>
            <Text variant="h2" align="center">
              {done.user.name}
            </Text>
            <Text variant="bodySm" color={colors.textMuted} align="center">
              Account {done.loginId}. Share these details with the customer now: the password is shown only once.
            </Text>
          </Glass>
        </Reveal>
        <Reveal index={1}>
          <TempPasswordCard loginId={done.loginId} password={done.temporaryPassword} name={done.user.name} />
        </Reveal>
        <Reveal index={2}>
          <Glass style={{ gap: 8 }}>
            <Text variant="title">What the customer does next</Text>
            {['Open the Optimas app (or optimaswifi.co.ke) and sign in with the account number and password above.', 'Choose their own password.', 'They can then request visits, follow technicians on the map and chat with you or the office.'].map((t, i) => (
              <View key={t} style={styles.stepRow}>
                <View style={styles.stepNo}>
                  <Text variant="label" style={{ fontFamily: fonts.bold }}>
                    {i + 1}
                  </Text>
                </View>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {t}
                </Text>
              </View>
            ))}
          </Glass>
        </Reveal>
      </Screen>
    );
  }

  const ready = name.trim().length >= 2 && phone.trim().length >= 9 && address.trim().length >= 3;
  return (
    <Screen footer={<Button label="Create customer account" icon="person-add" size="lg" loading={busy} disabled={!ready} onPress={submit} />}>
      <PageHeader title="Onboard customer" subtitle={task ? `${task.code} · ${task.title}` : 'Create their Optimas app account'} right={null} />

      <Glass strong style={{ gap: 14 }}>
        <Input label="Customer name" icon="person-outline" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" placeholder="+2547…" value={phone} onChangeText={setPhone} error={errors.phone} />
        <Input label="Email (optional)" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} error={errors.email} />
        <Input label="Address / premises" icon="home-outline" value={address} onChangeText={setAddress} error={errors.address} />
        <Input label="Account number (optional)" icon="card-outline" autoCapitalize="characters" placeholder="Leave empty to create one" value={account} onChangeText={setAccount} error={errors.customerAccount} />
      </Glass>

      <Glass strong style={{ gap: 12 }}>
        <Pressable onPress={() => setPinHere((v) => !v)} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: pinHere }}>
          <View style={{ flex: 1 }}>
            <Text variant="title">Pin the premises where I am standing</Text>
            <Text variant="label" color={colors.textMuted}>
              {locating ? 'Finding your location…' : pinHere && fix ? `Accurate to about ${Math.round(fix.accuracy ?? 0)} m` : 'Technicians will find this customer without calling'}
            </Text>
          </View>
          <View style={[styles.switch, pinHere && styles.switchOn]}>
            <View style={[styles.knob, pinHere && { transform: [{ translateX: 18 }] }]} />
          </View>
        </Pressable>
        {pin ? (
          <View style={styles.mapBox}>
            <MapCanvas pins={[{ id: 'site', kind: 'site', lat: pin.lat, lng: pin.lng }]} fitKey={`${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`} style={{ flex: 1 }} />
          </View>
        ) : null}
      </Glass>

      <Text variant="label" color={colors.textDim} align="center">
        The customer gets a one-time password and chooses their own when they first sign in.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  okIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, padding: 3 },
  switchOn: { backgroundColor: colors.success },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  mapBox: { height: 180, borderRadius: radius.lg, overflow: 'hidden' },
});
