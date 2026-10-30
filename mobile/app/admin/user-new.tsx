import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Role, User } from '../../src/api/types';
import { Button, PageHeader, Screen, TempPasswordCard, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { whatsapp, whatsappNumber } from '../../src/utils/contact';
import { APP_SIGNIN_URL } from '../../src/components/TempPasswordCard';

/** Staff-number prefixes per role (FBI-TEC-001, FBI-ADM-002 …). */
const STAFF_PREFIX: Partial<Record<Role, string>> = { ADMIN: 'ADM', SUPERVISOR: 'SUP', STOREKEEPER: 'STR', TECHNICIAN: 'TEC', CUSTOMER_CARE: 'CC' };

/** The next number of the form FBI-XXX-### that is not taken yet. */
function suggestStaffNo(list: { staffNo: string }[], code: string): string {
  let max = 0;
  const re = new RegExp(`^FBI-${code}-(\\d+)$`);
  for (const u of list) {
    const m = re.exec(u.staffNo);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `FBI-${code}-${String(max + 1).padStart(3, '0')}`;
}

/** The next five-digit account number after the highest one on record. */
function suggestAccountNo(list: { staffNo: string }[]): string {
  let max = 9999;
  for (const u of list) {
    const m = /^FBI-CUS-(\d+)$/.exec(u.staffNo);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `FBI-CUS-${String(max + 1).padStart(5, '0')}`;
}

type Delivery = 'whatsapp' | 'screen';

/**
 * Create a staff member or a customer login (laid out like M-PESA's pay screen: a pill bar for the kind of
 * account, labelled boxes, how to send the details, and one Continue button). The server issues a
 * one-time password; WhatsApp opens with it typed in, ready to send.
 */
export default function UserNew() {
  const params = useLocalSearchParams<{ role?: Role }>();
  const actor = useAuth((s) => s.user)!;
  const roles: { value: Role; label: string }[] =
    actor.role === 'ADMIN'
      ? [
          { value: 'TECHNICIAN', label: 'Technician' },
          { value: 'CUSTOMER', label: 'Customer' },
          { value: 'CUSTOMER_CARE', label: 'Customer care' },
          { value: 'STOREKEEPER', label: 'Storekeeper' },
          { value: 'SUPERVISOR', label: 'Supervisor' },
          { value: 'ADMIN', label: 'Admin' },
        ]
      : actor.role === 'CUSTOMER_CARE'
        ? [{ value: 'CUSTOMER', label: 'Customer' }]
        : [
            { value: 'TECHNICIAN', label: 'Technician' },
            { value: 'CUSTOMER', label: 'Customer' },
          ];
  const [role, setRole] = useState<Role>(params.role && roles.some((r) => r.value === params.role) ? params.role : roles[0].value);
  const [form, setForm] = useState({ staffNo: '', name: '', phone: '', email: '', region: '', customerAccount: '', address: '' });
  const [delivery, setDelivery] = useState<Delivery>('whatsapp');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ user: User; temporaryPassword: string } | null>(null);
  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };
  const customer = role === 'CUSTOMER';
  // Everyone already on the books, to number the person being created after the last one
  const staff = useApi<{ users: { staffNo: string }[] }>(actor.role === 'CUSTOMER_CARE' ? null : '/users');
  const customers = useApi<{ users: { staffNo: string }[] }>('/users?role=CUSTOMER');

  // Pre-fill the number when the role turns (editable, so the office can follow its own scheme)
  useEffect(() => {
    if (customer) {
      if (customers.data) setForm((f) => ({ ...f, customerAccount: suggestAccountNo(customers.data!.users) }));
    } else {
      const code = STAFF_PREFIX[role];
      if (code && staff.data) setForm((f) => ({ ...f, staffNo: suggestStaffNo(staff.data!.users, code) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, staff.data, customers.data]);

  const wa = whatsappNumber(form.phone);
  const ready = form.name.trim().length >= 2 && (customer ? !!form.customerAccount.trim() : !!form.staffNo.trim()) && (delivery === 'screen' || !!wa);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const body = Object.fromEntries(
        Object.entries({ ...form, role }).filter(([k, v]) => v !== '' && (customer ? !['staffNo', 'region'].includes(k) : !['customerAccount', 'address'].includes(k))),
      );
      setCreated(await api<{ user: User; temporaryPassword: string }>('/users', { body }));
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not create the account' });
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const message = `Optimas MS sign-in for ${created.user.name}\nOpen: ${APP_SIGNIN_URL}\nUser: ${created.user.staffNo}\nTemporary password: ${created.temporaryPassword}\nYou will be asked to choose your own password when you sign in.`;
    return (
      <Screen
        footer={
          <View style={{ gap: 10 }}>
            {delivery === 'whatsapp' && created.user.phone ? (
              <Pressable onPress={() => void whatsapp(created.user.phone, message)} style={({ pressed }) => [styles.continue, { backgroundColor: '#25D366' }, pressed && styles.pressed]} accessibilityRole="button">
                <Ionicons name="logo-whatsapp" size={20} color={colors.white} />
                <Text variant="title" color={colors.white} fixedColor style={styles.continueText}>
                  Send on WhatsApp
                </Text>
              </Pressable>
            ) : null}
            <Button label="Done" icon="checkmark" size="lg" variant={delivery === 'whatsapp' ? 'secondary' : 'primary'} onPress={() => router.replace(`/admin/user/${created.user.id}`)} />
          </View>
        }
      >
        <PageHeader title="Account created" right={null} />
        <TempPasswordCard loginId={created.user.staffNo} password={created.temporaryPassword} name={created.user.name} phone={created.user.phone} />
        <Text variant="bodySm" color={colors.textMuted}>
          {delivery === 'whatsapp' ? 'Tap Send on WhatsApp: the chat opens with the details typed in, so you only press Send.' : `Give these details to ${created.user.name.split(' ')[0]} in person or by a private message.`} They choose their own password the first time they sign in. Lost them? Open the account and tap “Resend sign-in details”.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Pressable onPress={submit} disabled={!ready || busy} style={({ pressed }) => [styles.continue, (!ready || busy) && { opacity: 0.45 }, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ disabled: !ready || busy }}>
          <Text variant="title" color={colors.white} fixedColor style={styles.continueText}>
            {busy ? 'Creating…' : 'Continue'}
          </Text>
        </Pressable>
      }
    >
      <PageHeader title="New account" right={null} />

      {/* The kind of account, as a pill bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsIn}>
        {roles.map((r) => {
          const on = r.value === role;
          return (
            <Pressable key={r.value} onPress={() => setRole(r.value)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text variant="bodySm" color={on ? colors.white : colors.textMuted} fixedColor={on} style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 15 }}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Field
        label={customer ? 'Enter Account Number' : 'Enter Staff Number'}
        value={customer ? form.customerAccount : form.staffNo}
        onChangeText={set(customer ? 'customerAccount' : 'staffNo')}
        autoCapitalize="characters"
        placeholder={customer ? 'FBI-CUS-12345' : 'FBI-TEC-004'}
        icon={customer ? 'card-outline' : 'id-card-outline'}
        hint={customer ? 'They sign in with this number' : role === 'CUSTOMER_CARE' ? 'Customer care · chats, requests and customer logins' : 'They sign in with this number'}
        error={customer ? errors.customerAccount : errors.staffNo}
      />
      <Field label={customer ? 'Enter Customer / Premises Name' : 'Enter Full Name'} value={form.name} onChangeText={set('name')} icon="person-outline" error={errors.name} hint={form.name.trim().length >= 2 ? form.name.trim().toUpperCase() : undefined} />
      <Field
        label="Enter Phone Number"
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        placeholder="07XX XXX XXX"
        icon="logo-whatsapp"
        error={errors.phone}
        hint={wa ? `WHATSAPP +${wa}` : undefined}
      />
      <Field label="Enter Email (optional)" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" error={errors.email} />
      {customer ? (
        <Field label="Enter Installation Address" value={form.address} onChangeText={set('address')} icon="location-outline" multiline error={errors.address} />
      ) : (
        <Field label="Enter Region / Area (optional)" value={form.region} onChangeText={set('region')} icon="map-outline" error={errors.region} />
      )}

      <Text variant="title" style={styles.section}>
        Send Sign-in Details By
      </Text>
      <View style={styles.methods}>
        <Method on={delivery === 'whatsapp'} onPress={() => setDelivery('whatsapp')} icon="logo-whatsapp" iconColor="#25D366" title="WhatsApp" sub={wa ? `+${wa}` : 'Needs a phone number'} />
        <Method on={delivery === 'screen'} onPress={() => setDelivery('screen')} icon="eye-outline" iconColor={colors.text} title="Show on screen" sub="Give in person" />
      </View>

      {errors._ ? (
        <Text variant="bodySm" color={colors.danger}>
          {errors._}
        </Text>
      ) : null}
      <Text variant="label" color={colors.textMuted}>
        A one-time password is made and shown once. The person sets their own password when they first sign in.
      </Text>
    </Screen>
  );
}

/** A labelled box (label above, value inside, an icon on the right, green confirmation text under it). */
function Field({ label, icon, hint, error, multiline, ...input }: { label: string; icon: keyof typeof Ionicons.glyphMap; hint?: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="body" style={{ fontSize: 16 }}>
        {label}
      </Text>
      <View style={[styles.box, focused && styles.boxOn, !!error && { borderColor: colors.danger }]}>
        <TextInput
          {...input}
          multiline={multiline}
          placeholderTextColor={colors.textDim}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { minHeight: 64, textAlignVertical: 'top', paddingTop: 16 }]}
          accessibilityLabel={label}
        />
        <Ionicons name={icon} size={22} color={focused ? colors.brand : colors.textMuted} />
      </View>
      {error ? (
        <Text variant="label" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="label" color={colors.brand} style={{ fontFamily: fonts.bold, letterSpacing: 0.4 }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A choice card with a ticked corner when chosen (like M-PESA's payment method cards). */
function Method({ on, onPress, icon, iconColor, title, sub }: { on: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; sub: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.method, on && styles.methodOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <Ionicons name={icon} size={26} color={iconColor} />
      <View style={{ flex: 1 }}>
        <Text variant="title" style={{ fontFamily: fonts.semibold }} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="label" color={colors.textMuted} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {on ? (
        <>
          <View style={styles.corner} pointerEvents="none" />
          <Ionicons name="checkmark" size={13} color={colors.white} style={styles.tick} />
        </>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexGrow: 0, borderRadius: 32, backgroundColor: colors.surfaceAlt },
  tabsIn: { padding: 6, gap: 4 },
  tab: { height: 50, paddingHorizontal: 20, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.brand },
  section: { fontFamily: fonts.bold, fontSize: 16, marginTop: 6 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingRight: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.white },
  boxOn: { borderColor: colors.brand, borderWidth: 2 },
  input: { flex: 1, minHeight: 56, paddingHorizontal: 16, fontFamily: fonts.regular, fontSize: 17, color: colors.text, outlineStyle: 'none' } as object,
  methods: { flexDirection: 'row', gap: 12 },
  method: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 72, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.white, overflow: 'hidden' },
  methodOn: { borderColor: colors.brand, borderWidth: 2 },
  // A green triangle in the top-right corner with a tick on it
  corner: { position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderTopWidth: 34, borderLeftWidth: 34, borderTopColor: colors.brand, borderLeftColor: 'transparent' },
  tick: { position: 'absolute', top: 3, right: 3 },
  continue: { height: 58, borderRadius: 12, backgroundColor: colors.brand, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontFamily: fonts.bold, fontSize: 17 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
