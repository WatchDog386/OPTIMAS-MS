import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Role, User } from '../../src/api/types';
import { Button, Glass, Input, Screen, ScreenHeader, Segmented, TempPasswordCard, Text } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';

/** Create a staff member or a customer login. The server issues a one-time password. */
export default function UserNew() {
  const params = useLocalSearchParams<{ role?: Role }>();
  const actor = useAuth((s) => s.user)!;
  const roles: { value: Role; label: string }[] =
    actor.role === 'ADMIN'
      ? [
          { value: 'TECHNICIAN', label: 'Technician' },
          { value: 'STOREKEEPER', label: 'Storekeeper' },
          { value: 'SUPERVISOR', label: 'Supervisor' },
          { value: 'ADMIN', label: 'Admin' },
          { value: 'CUSTOMER', label: 'Customer' },
        ]
      : [
          { value: 'TECHNICIAN', label: 'Technician' },
          { value: 'CUSTOMER', label: 'Customer' },
        ];
  const [role, setRole] = useState<Role>(params.role && roles.some((r) => r.value === params.role) ? params.role : 'TECHNICIAN');
  const [form, setForm] = useState({ staffNo: '', name: '', phone: '', email: '', region: '', customerAccount: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ user: User; temporaryPassword: string } | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const customer = role === 'CUSTOMER';

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
    return (
      <Screen footer={<Button label="Done" icon="checkmark" size="lg" onPress={() => router.replace(`/admin/user/${created.user.id}`)} />}>
        <ScreenHeader title="Account created" subtitle={created.user.name} />
        <TempPasswordCard loginId={created.user.staffNo} password={created.temporaryPassword} name={created.user.name} />
        <Text variant="bodySm" color={colors.textMuted}>
          Give these details to {created.user.name.split(' ')[0]} in person or by a private message. They must choose their own password the first time they sign in.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label="Create account" icon="person-add" size="lg" loading={busy} disabled={form.name.trim().length < 2 || (customer ? !form.customerAccount.trim() : !form.staffNo.trim())} onPress={submit} />}>
      <ScreenHeader title="New account" subtitle={customer ? 'Customer login (signs in with the account number)' : 'Staff login'} />
      <Segmented options={roles} value={role} onChange={setRole} />
      <Glass strong style={{ gap: 14 }}>
        {customer ? (
          <Input label="Account number" icon="card-outline" autoCapitalize="characters" placeholder="OPT-CUS-12345" value={form.customerAccount} onChangeText={set('customerAccount')} error={errors.customerAccount} />
        ) : (
          <Input label="Staff number" icon="id-card-outline" autoCapitalize="characters" placeholder="OPT-TEC-004" value={form.staffNo} onChangeText={set('staffNo')} error={errors.staffNo} />
        )}
        <Input label={customer ? 'Customer / premises name' : 'Full name'} icon="person-outline" value={form.name} onChangeText={set('name')} error={errors.name} />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" placeholder="+2547…" value={form.phone} onChangeText={set('phone')} error={errors.phone} />
        <Input label="Email (optional)" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} error={errors.email} />
        {customer ? (
          <Input label="Installation address" icon="location-outline" multiline value={form.address} onChangeText={set('address')} error={errors.address} />
        ) : (
          <Input label="Region / area (optional)" icon="map-outline" value={form.region} onChangeText={set('region')} error={errors.region} />
        )}
        {errors._ ? (
          <Text variant="bodySm" color={colors.danger}>
            {errors._}
          </Text>
        ) : null}
      </Glass>
      <Text variant="bodySm" color={colors.textMuted}>
        A one-time password is generated and shown once. The person must set their own password when they first sign in.
      </Text>
    </Screen>
  );
}
