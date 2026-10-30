import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../src/utils/nav';
import { api, ApiError } from '../../src/api/client';
import type { Role, User } from '../../src/api/types';
import { Button, Glass, Input, Loading, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors } from '../../src/theme';
import { toast } from '../../src/store/feedback';

/** Edit a person's details (and, for admins, a staff member's role). */
export default function UserEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const actor = useAuth((s) => s.user)!;
  const { data } = useApi<{ user: User }>(`/users/${id}`);
  const [form, setForm] = useState({ name: '', phone: '', email: '', region: '', address: '', customerAccount: '' });
  const [role, setRole] = useState<Role>('TECHNICIAN');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const u = data.user;
    setForm({ name: u.name, phone: u.phone ?? '', email: u.email ?? '', region: u.region ?? '', address: u.address ?? '', customerAccount: u.customerAccount ?? '' });
    setRole(u.role);
  }, [data]);

  if (!data) return <Loading />;
  const u = data.user;
  const customer = u.role === 'CUSTOMER';
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = { name: form.name, phone: form.phone, email: form.email };
      if (customer) Object.assign(body, { address: form.address, customerAccount: form.customerAccount });
      else body.region = form.region;
      if (actor.role === 'ADMIN' && !customer && role !== u.role) body.role = role;
      await api(`/users/${u.id}`, { method: 'PATCH', body });
      toast.success('Changes saved');
      goBack();
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save changes" icon="checkmark" size="lg" loading={busy} disabled={form.name.trim().length < 2} onPress={save} />}>
      <ScreenHeader title="Edit details" subtitle={u.name} />
      {actor.role === 'ADMIN' && !customer ? (
        <>
          <Text variant="label" color={colors.textMuted}>
            Role
          </Text>
          <Segmented<Role>
            options={[
              { value: 'TECHNICIAN', label: 'Technician' },
              { value: 'STOREKEEPER', label: 'Storekeeper' },
              { value: 'CUSTOMER_CARE', label: 'Customer care' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
            value={role}
            onChange={setRole}
          />
        </>
      ) : null}
      <Glass strong style={{ gap: 14 }}>
        <Input label="Name" icon="person-outline" value={form.name} onChangeText={set('name')} error={errors.name} />
        <Input label="Phone" icon="call-outline" keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} error={errors.phone} />
        <Input label="Email" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={set('email')} error={errors.email} />
        {customer ? (
          <>
            <Input label="Account number" icon="card-outline" autoCapitalize="characters" value={form.customerAccount} onChangeText={set('customerAccount')} error={errors.customerAccount} />
            <Input label="Installation address" icon="location-outline" multiline value={form.address} onChangeText={set('address')} error={errors.address} />
          </>
        ) : (
          <Input label="Region / area" icon="map-outline" value={form.region} onChangeText={set('region')} error={errors.region} />
        )}
        {errors._ ? (
          <Text variant="bodySm" color={colors.danger}>
            {errors._}
          </Text>
        ) : null}
      </Glass>
    </Screen>
  );
}
