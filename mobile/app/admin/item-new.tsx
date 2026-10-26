import { useState } from 'react';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Item } from '../../src/api/types';
import { Button, Glass, Input, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { colors } from '../../src/theme';
import { toast } from '../../src/store/feedback';
import { requestScan } from '../../src/store/bridge';

type Category = Item['category'];
type Tracking = Item['tracking'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'ROUTER', label: 'Router' },
  { value: 'ONT', label: 'ONT' },
  { value: 'CABLE', label: 'Cable' },
  { value: 'CONNECTOR', label: 'Connector' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'TOOL', label: 'Tool' },
];

/** Add a catalogue item. Routers/ONTs are serial-tracked; cable and parts are counted in bulk. */
export default function ItemNew() {
  const [category, setCategory] = useState<Category>('ROUTER');
  const [tracking, setTracking] = useState<Tracking>('SERIALIZED');
  const [form, setForm] = useState({ sku: '', name: '', unit: 'pcs', unitPrice: '', reorderLevel: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickCategory = (c: Category) => {
    setCategory(c);
    const serial = c === 'ROUTER' || c === 'ONT';
    setTracking(serial ? 'SERIALIZED' : 'BULK');
    setForm((f) => ({ ...f, unit: serial ? 'pcs' : c === 'CABLE' ? 'm' : f.unit }));
  };

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const { item } = await api<{ item: Item }>('/inventory/items', {
        body: {
          sku: form.sku,
          name: form.name,
          category,
          tracking,
          unit: form.unit || 'pcs',
          unitPrice: Number(form.unitPrice || 0),
          reorderLevel: Number(form.reorderLevel || 0),
        },
      });
      toast.success('Item added', `${item.name} is now in the catalogue.`);
      router.replace(`/admin/item/${item.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not add item' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Add to catalogue" icon="add" size="lg" loading={busy} disabled={form.sku.trim().length < 2 || form.name.trim().length < 2} onPress={submit} />}>
      <ScreenHeader title="New item" subtitle="Add something the store will stock" />
      <Text variant="label" color={colors.textMuted}>
        Category
      </Text>
      <Segmented options={CATEGORIES} value={category} onChange={pickCategory} />
      <Text variant="label" color={colors.textMuted}>
        Tracking
      </Text>
      <Segmented<Tracking>
        options={[
          { value: 'SERIALIZED', label: 'By serial number' },
          { value: 'BULK', label: 'By quantity' },
        ]}
        value={tracking}
        onChange={setTracking}
      />
      <Glass strong style={{ gap: 14 }}>
        <Input label="SKU / code" icon="barcode-outline" autoCapitalize="characters" placeholder="RTR-HW-AX3" value={form.sku} onChangeText={set('sku')} error={errors.sku} />
        <Button
          label="Scan product barcode"
          icon="scan-outline"
          variant="secondary"
          onPress={async () => {
            const r = await requestScan({ title: 'Scan the product barcode' });
            if (r?.[0]) set('sku')(r[0]);
          }}
        />
        <Input label="Name" icon="pricetag-outline" placeholder="Huawei AX3 Wi-Fi 6 Router" value={form.name} onChangeText={set('name')} error={errors.name} />
        <Input label="Unit" icon="cube-outline" placeholder="pcs, m, packs" value={form.unit} onChangeText={set('unit')} error={errors.unit} />
        <Input label="Unit price (KES)" icon="cash-outline" keyboardType="number-pad" value={form.unitPrice} onChangeText={(v) => set('unitPrice')(v.replace(/\D/g, ''))} error={errors.unitPrice} />
        <Input label="Reorder level" icon="trending-down-outline" keyboardType="decimal-pad" value={form.reorderLevel} onChangeText={(v) => set('reorderLevel')(v.replace(/[^0-9.]/g, ''))} error={errors.reorderLevel} />
        {errors._ ? (
          <Text variant="bodySm" color={colors.danger}>
            {errors._}
          </Text>
        ) : null}
      </Glass>
      <Text variant="bodySm" color={colors.textMuted}>
        {tracking === 'SERIALIZED' ? 'Each unit gets its own serial number when received, so it can be traced to a technician and a customer.' : 'Stock is counted in units (e.g. metres of cable) and consumed on jobs.'}
      </Text>
    </Screen>
  );
}
