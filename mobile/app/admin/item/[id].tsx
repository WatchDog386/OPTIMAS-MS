import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../../src/utils/nav';
import { api, ApiError } from '../../../src/api/client';
import type { Item } from '../../../src/api/types';
import { Badge, Button, Glass, Input, Loading, Screen, ScreenHeader, Section, Segmented, StatGrid, StatTile, Text } from '../../../src/components';
import { useApi } from '../../../src/hooks/useApi';
import { colors } from '../../../src/theme';
import { confirmAction } from '../../../src/utils/confirm';
import { toast } from '../../../src/store/feedback';
import { humanize } from '../../../src/utils/format';

/** Item page: stock levels, edit details, stock-take adjustments and archiving. */
export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, reload, refresh, refreshing } = useApi<{ items: Item[] }>('/inventory/items');
  const item = data?.items.find((i) => i.id === id);
  const [form, setForm] = useState({ name: '', unit: '', unitPrice: '', reorderLevel: '' });
  const [dir, setDir] = useState<'add' | 'remove'>('remove');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (item) setForm({ name: item.name, unit: item.unit, unitPrice: String(item.unitPrice), reorderLevel: String(item.reorderLevel) });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <Loading />;
  if (!item) {
    return (
      <Screen>
        <ScreenHeader title="Item not found" subtitle="It may have been archived" />
      </Screen>
    );
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await reload();
    } catch (e) {
      toast.error('Not possible', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run('save', async () => {
      await api(`/inventory/items/${item.id}`, { method: 'PATCH', body: { name: form.name, unit: form.unit, unitPrice: Number(form.unitPrice || 0), reorderLevel: Number(form.reorderLevel || 0) } });
      toast.success('Saved', `${form.name} updated.`);
    });

  const adjust = () =>
    run('adjust', async () => {
      const n = Number(qty);
      await api('/inventory/adjust', { body: { itemId: item.id, quantity: dir === 'add' ? n : -n, reason } });
      toast.success('Stock adjusted', `${dir === 'add' ? '+' : '−'}${n} ${item.unit} recorded in the ledger.`);
      setQty('');
      setReason('');
    });

  const archive = () =>
    run('archive', async () => {
      if (!(await confirmAction('Archive item', `${item.name} will be hidden from the catalogue. History is kept.`, 'Archive'))) return;
      await api(`/inventory/items/${item.id}`, { method: 'PATCH', body: { active: false } });
      toast.success('Item archived');
      goBack();
    });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={item.name} subtitle={`${item.sku} · ${humanize(item.category)} · ${item.tracking === 'SERIALIZED' ? 'serial-tracked' : 'counted in bulk'}`} right={item.lowStock ? <Badge label="Low stock" tone="danger" /> : undefined} />
      <StatGrid>
        <StatTile icon="cube" label="In store" value={item.stock?.inStore ?? 0} hint={`${item.unit}`} tint={item.lowStock ? colors.danger : colors.info} />
        <StatTile icon="person" label="With technicians" value={item.stock?.withTechnicians ?? 0} hint={item.unit} tint={colors.accent} />
      </StatGrid>

      <Section title="Details">
        <View style={{ gap: 12 }}>
          <Input label="Name" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input label="Unit" value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} />
          <Input label="Unit price (KES)" keyboardType="number-pad" value={form.unitPrice} onChangeText={(v) => setForm((f) => ({ ...f, unitPrice: v.replace(/\D/g, '') }))} />
          <Input label="Reorder level" keyboardType="decimal-pad" value={form.reorderLevel} onChangeText={(v) => setForm((f) => ({ ...f, reorderLevel: v.replace(/[^0-9.]/g, '') }))} />
          <Button label="Save details" icon="checkmark" loading={busy === 'save'} onPress={save} />
        </View>
      </Section>

      {item.tracking === 'SERIALIZED' ? (
        <Button label="Print labels for units in the store" icon="qr-code-outline" variant="secondary" onPress={() => router.push(`/admin/labels?itemId=${item.id}`)} />
      ) : null}
      {item.tracking === 'BULK' ? (
        <Section title="Stock-take adjustment" subtitle="Correct the store quantity after a count. Recorded in the ledger with your reason.">
          <View style={{ gap: 12 }}>
            <Segmented
              options={[
                { value: 'remove', label: 'Remove (damaged / short)' },
                { value: 'add', label: 'Add (found / over)' },
              ]}
              value={dir}
              onChange={setDir}
            />
            <Input label={`Quantity (${item.unit})`} keyboardType="decimal-pad" value={qty} onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ''))} />
            <Input label="Reason" placeholder="e.g. 2 packs water damaged in store" value={reason} onChangeText={setReason} />
            <Button label="Record adjustment" icon="swap-vertical" variant="secondary" loading={busy === 'adjust'} disabled={!Number(qty) || reason.trim().length < 5} onPress={adjust} />
          </View>
        </Section>
      ) : (
        <Glass strong>
          <Text variant="bodySm" color={colors.textMuted}>
            Serialised units are added with Receive (scan each serial). Damaged or missing units are recorded from Trace device (report lost) or Returns (faulty).
          </Text>
          <Button label="Receive stock" icon="add-circle" variant="secondary" onPress={() => router.push(`/admin/receive?itemId=${item.id}`)} />
        </Glass>
      )}

      <Button label="Archive item" icon="archive-outline" variant="danger" loading={busy === 'archive'} onPress={archive} />
    </Screen>
  );
}
