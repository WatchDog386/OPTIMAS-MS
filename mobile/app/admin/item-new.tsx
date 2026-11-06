import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Item, Label } from '../../src/api/types';
import { Badge, Button, Input, PageHeader, QrCode, Screen, SectionHeader, Text } from '../../src/components';
import { requestScan } from '../../src/store/bridge';
import { colors, fonts, radius, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

type Category = Item['category'];
type Mode = 'serialised' | 'bulk';

const CATEGORIES: { value: Category; label: string }[] = [
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

interface CatalogLabel {
  serial: string;
  item: string;
  sku: string;
  code: string;
}

/** Add a product: scan each serial, or enter a quantity and auto-generate serials + labels for items without barcodes. */
export default function CatalogEntry() {
  const [mode, setMode] = useState<Mode>('serialised');
  const [category, setCategory] = useState<Category>('ROUTER');
  const [form, setForm] = useState({ name: '', quantity: '', reorderLevel: '' });
  const [serials, setSerials] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [labels, setLabels] = useState<CatalogLabel[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addSerials = (more: string[]) => {
    if (!more.length) return;
    setSerials((s) => {
      const known = new Set(s.map((x) => x.toUpperCase()));
      const added = more.map((v) => v.trim().toUpperCase()).filter((v) => v && !known.has(v));
      return [...s, ...added];
    });
  };

  const removeSerial = (s: string) => setSerials((l) => l.filter((x) => x !== s));

  const scan = async () => {
    const r = await requestScan({ multiple: true, title: 'Scan serial numbers' });
    if (r) addSerials(r);
  };

  const submit = async () => {
    setErrors({});
    if (!form.name.trim()) { setErrors({ name: 'Product name is required' }); return; }

    const reorder = Number(form.reorderLevel);
    if (!Number.isInteger(reorder) || reorder < 0) { setErrors({ reorderLevel: 'Enter a valid reorder level' }); return; }

    if (mode === 'serialised') {
      if (!serials.length) { setErrors({ serials: 'Scan at least one serial number' }); return; }
    } else {
      const qty = Number(form.quantity);
      if (!qty || qty < 1 || qty > 500) { setErrors({ quantity: 'Enter a quantity between 1 and 500' }); return; }
    }

    setBusy(true);
    try {
      if (mode === 'serialised') {
        await api<{ item: Item; count: number }>('/inventory/items/catalog-entry', {
          body: { name: form.name, category, reorderLevel: reorder, serials },
        });
        toast.success('Saved', `${serials.length} unit(s) of ${form.name} added to the store.`);
        router.replace('/admin/items');
      } else {
        const r = await api<{ item: Item; labels: Label[]; count: number }>('/inventory/items/catalog-entry-bulk', {
          body: { name: form.name, category, quantity: Number(form.quantity), reorderLevel: reorder },
        });
        setLabels(r.labels.map((l) => ({ serial: l.serial, item: l.item, sku: l.sku, code: l.code })));
        toast.success('Saved', `${r.count} unit(s) of ${form.name} added with labels.`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not save product' });
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.print();
  };

  // Print stylesheet on web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '@media print { [data-noprint] { display: none !important; } body { background: #fff !important; } [data-label] { break-inside: avoid; page-break-inside: avoid; } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <Screen footer={<Button label={mode === 'serialised' ? 'Save product' : 'Generate serials + labels'} icon={mode === 'serialised' ? 'save' : 'barcode-outline'} size="lg" loading={busy} disabled={!form.name.trim() || (mode === 'serialised' ? !serials.length : !Number(form.quantity)) || busy} onPress={submit} />}>
      <PageHeader title="Add product" subtitle="Serialised items: scan each. Bulk items: enter quantity, auto-generate labels" />

      <SectionHeader title="Product" />
      <View style={styles.card}>
        <View style={styles.modeRow}>
          <Pressable style={[styles.modeChip, mode === 'serialised' && styles.modeChipOn]} onPress={() => setMode('serialised')}>
            <Text variant="label">Scan each serial</Text>
          </Pressable>
          <Pressable style={[styles.modeChip, mode === 'bulk' && styles.modeChipOn]} onPress={() => setMode('bulk')}>
            <Text variant="label">Bulk · auto-generate serials</Text>
          </Pressable>
        </View>
        <Input label="Product name" icon="pricetag-outline" placeholder="Huawei AX3 Router" value={form.name} onChangeText={set('name')} error={errors.name} />
        <SectionHeader title="Category" />
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.value} style={[styles.chip, category === c.value && styles.chipOn]} onPress={() => setCategory(c.value)}>
              <Text variant="label">{c.label}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'bulk' ? (
          <Input label="Quantity" icon="cube-outline" keyboardType="number-pad" placeholder="How many units" value={form.quantity} onChangeText={(v) => set('quantity')(v.replace(/\D/g, ''))} error={errors.quantity} />
        ) : null}
        <Input label="Reorder level" icon="trending-down-outline" keyboardType="number-pad" placeholder="Reorder when stock drops to" value={form.reorderLevel} onChangeText={(v) => set('reorderLevel')(v.replace(/\D/g, ''))} error={errors.reorderLevel} />
        {errors._ ? <Text variant="bodySm" color={colors.danger}>{errors._}</Text> : null}
      </View>

      {mode === 'serialised' ? (
        <>
          <SectionHeader title={`Serial numbers (${serials.length})`} />
          <View style={styles.card}>
            <View style={styles.scanRow}>
              <Button label={serials.length ? `Scan more · ${serials.length}` : 'Scan serial'} icon="barcode-outline" variant="secondary" onPress={scan} />
              <View style={{ flex: 1 }}>
                <Input label="Or type a serial" icon="keypad-outline" autoCapitalize="characters" autoCorrect={false} value={manual} onChangeText={setManual} />
              </View>
              <Button label="Add" icon="add" disabled={!manual.trim()} onPress={() => { addSerials([manual]); setManual(''); }} />
            </View>
            {serials.length ? (
              <View style={styles.chipList}>
                {serials.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => removeSerial(s)} accessibilityLabel={`Remove ${s}`}>
                    <Text variant="label">{s}</Text>
                    <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text variant="bodySm" color={colors.textMuted}>
                Scan each device's serial number. Each unit gets its own entry.
              </Text>
            )}
          </View>
        </>
      ) : (
        <View style={{ gap: 10 }}>
          <SectionHeader title="Bulk serials" />
          <Text variant="bodySm" color={colors.textMuted}>
            Each unit gets its own auto-generated serial number and a printable barcode label.
          </Text>
          <Button label={`Generate ${form.quantity || 0} serials + labels`} icon="sparkles" variant="secondary" disabled={busy || !form.name.trim() || !Number(form.quantity)} onPress={submit} />
        </View>
      )}

      {labels.length ? (
        <>
          <View {...web({ noprint: '1' })} style={{ gap: 10 }}>
            <SectionHeader title={`Print labels (${labels.length})`} />
            <Button label={`Print ${labels.length} label${labels.length === 1 ? '' : 's'}`} icon="print-outline" variant="secondary" onPress={print} />
          </View>
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
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  modeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  scanRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { width: 300, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  brand: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: '#000' },
  mono: { fontFamily: fonts.semibold, fontSize: 11, color: '#000', letterSpacing: 0.3 },
});
