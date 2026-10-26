import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import type { TaskType } from '../src/api/types';
import { Button, Glass, Input, Screen, ScreenHeader, Segmented, Text } from '../src/components';
import { colors } from '../src/theme';
import { toast } from '../src/store/feedback';

const TYPES: { value: TaskType; label: string }[] = [
  { value: 'REPAIR', label: 'Fault / no internet' },
  { value: 'RELOCATION', label: 'Move router' },
  { value: 'INSTALLATION', label: 'New connection' },
  { value: 'MAINTENANCE', label: 'Other' },
];

/** Customer: ask for a technician visit. */
export default function RequestNew() {
  const params = useLocalSearchParams<{ type?: TaskType }>();
  const [type, setType] = useState<TaskType>(params.type ?? 'REPAIR');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api('/customer/requests', { body: { type, description, phone: phone || undefined } });
      toast.success('Request sent', 'Thank you. A supervisor will assign a technician and you will be notified.');
      router.back();
    } catch (e) {
      toast.error('Could not send', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Send request" icon="send" size="lg" loading={busy} disabled={description.trim().length < 5} onPress={submit} />}>
      <ScreenHeader title="Request service" subtitle="Tell us what you need" />
      <Glass strong style={{ gap: 14 }}>
        <Text variant="label" color={colors.textMuted}>
          What do you need?
        </Text>
        <Segmented options={TYPES} value={type} onChange={setType} />
        <Input label="Describe the problem" multiline value={description} onChangeText={setDescription} placeholder="e.g. Internet drops every evening, red light on the router" />
        <Input label="Phone to reach you (optional)" icon="call-outline" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      </Glass>
    </Screen>
  );
}
