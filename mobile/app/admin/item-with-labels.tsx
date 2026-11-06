import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, ApiError } from '../../src/api/client';
import type { Item, ItemWithLabelsResult, Label } from '../../src/api/types';
import { Badge, Button, EmptyState, Input, PageHeader, QrCode, Screen, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

const CATEGORIES: { value: Item['category']; label: string }[] = [
  { value: 'ROUTER', label: 'Router' },
  { value: 'ONT', label: 'ONT' },
  { value: 'CABLE', label: 'Cable' },
  { value: 'CONNECTOR', label: 'Connector' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'TOOL', label: 'Tool' },
];

/** data-* attributes on the web (react-native-web's dataSet), for the print stylesheet. */
const web = (data: Record<string, string>) => ({ dataSet: data }) as object;

/** What the label's QR code holds: a link to "Check a device" for this code, on this app's address. */
const labelLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://ms.optimaswifi.co.ke'}/verify?c=${encodeURIComponent(code)}`;

export default function ItemWithLabels() {
  const [category, setCategory] = useState<Item['category']>('ROUTER');
  const [form, setForm] = useState({ name: '', quantity: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ItemWithLabelsResult | null>(null);
  const catalogue = useApi<{ items: Item[] }>('/inventory/items');

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErrors({});
    if (!form.name.trim()) { setErrors({ name: 'Product name is required' }); return; }
    const qty = Number(form.quantity);
    if (!qty || qty < 1 || qty > 500) { setErrors({ quantity: 'Enter a quantity between 1 and 500' }); return; }

    setBusy(true);
    try {
      const r = await api<ItemWithLabelsResult>('/inventory/items/with-labels', {
        body: { name: form.name, quantity: qty, category },
      });
      setResult(r);
      toast.success('Labels ready', `${r.count} barcode label${r.count === 1 ? '' : 's'} generated for ${r.item.name}.`);
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not generate labels' });
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.print();
  };

  const labels = result?.labels ?? [];

  // Print stylesheet on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '@media print { [data-noprint] { display: none !important; } body { background: #fff !important; } [data-label] { break-inside: avoid; page-break-inside: avoid; } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <Screen>
      <View {...web({ noprint: '1' })} style={{ gap: 12 }}>
        <PageHeader title="Product + labels" subtitle="Add a product and print barcode labels" right={null} />
        <SectionHeader title="Product" />
        <View style={{ gap: 10 }}>
          <Input label="Product name" icon="pricetag-outline" placeholder="Huawei AX3 Router" value={form.name} onChangeText={set('name')} error={errors.name} />
          <Input label="Quantity" icon="cube-outline" keyboardType="number-pad" placeholder="How many labels" value={form.quantity} onChangeText={set('quantity')} error={errors.quantity} />
          <SectionHeader title="Category" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Button key={c.value} label={c.label} variant={category === c.value ? 'primary' : 'secondary'} onPress={() => setCategory(c.value)} />
            ))}
          </View>
          {errors._ ? <Text variant="bodySm" color={colors.danger}>{errors._}</Text> : null}
        </View>
        <Button label="Generate labels" icon="barcode-outline" size="lg" loading={busy} disabled={!form.name.trim() || busy} onPress={submit} />
        {result && <Button label={`Print ${result.count} label${result.count === 1 ? '' : 's'}`} icon="print-outline" variant="secondary" onPress={print} />}
        {result && <Button label="Add another product" icon="add-outline" variant="ghost" onPress={() => setResult(null)} />}
      </View>

      {labels.length ? (
        <View style={styles.sheet}>
          {labels.map((l) => (
            <View key={l.serial} style={styles.label} {...web({ label: '1' })}>
              <QrCode value={labelLink(l.code)} size={110} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" style={styles.brand}>
                  OPTIMAS NETWORKS
                </Text>
                <Text variant="label" numberOfLines={2} style={{ fontFamily: fonts.semibold, color: '#000' }}>
                  {l.item}
                </Text>
                <Text variant="label" style={styles.mono}>
                  S/N {l.serial}
                </Text>
                <Text variant="label" style={{ fontSize: 9, color: '#444' }}>
                  Property of Optimas · scan to check
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon="pricetags-outline" title="No labels yet" message="Enter a product name and quantity, then generate labels." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { width: 300, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  brand: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: '#000' },
  mono: { fontFamily: fonts.semibold, fontSize: 11, color: '#000', letterSpacing: 0.3 },
});
