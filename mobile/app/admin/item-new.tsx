import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import type { Item } from '../../src/api/types';
import { Badge, Button, Input, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { requestScan } from '../../src/store/bridge';
import { colors, radius, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';

type Category = Item['category'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'ROUTER', label: 'Router' },
  { value: 'ONT', label: 'ONT' },
  { value: 'CABLE', label: 'Cable' },
  { value: 'CONNECTOR', label: 'Connector' },
  { value: 'ACCESSORY', label: 'Accessory' },
  { value: 'TOOL', label: 'Tool' },
];

/** Add a product and scan each unit's serial number. One save creates the item and every unit. */
export default function CatalogEntry() {
  const [category, setCategory] = useState<Category>('ROUTER');
  const [form, setForm] = useState({ name: '', reorderLevel: '' });
  const [serials, setSerials] = useState<string[]>([]);
  const [manual, setManual] = useState('');
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
    if (!serials.length) { setErrors({ serials: 'Scan at least one serial number' }); return; }
    const reorder = Number(form.reorderLevel);
    if (!Number.isInteger(reorder) || reorder < 0) { setErrors({ reorderLevel: 'Enter a valid reorder level' }); return; }

    setBusy(true);
    try {
      await api<{ item: Item; count: number }>('/inventory/items/catalog-entry', {
        body: { name: form.name, category, reorderLevel: reorder, serials },
      });
      toast.success('Saved', `${serials.length} unit(s) of ${form.name} added to the store.`);
      router.replace('/admin/items');
    } catch (e) {
      if (e instanceof ApiError && e.details) setErrors(Object.fromEntries(e.details.map((d) => [d.field, d.message])));
      else setErrors({ _: e instanceof ApiError ? e.message : 'Could not save product' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Save product" icon="save" size="lg" loading={busy} disabled={!form.name.trim() || !serials.length || busy} onPress={submit} />}>
      <ScreenHeader title="Add product" subtitle="Name it, scan each serial, then save" />

      <SectionHeader title="Product" />
      <View style={styles.card}>
        <Input label="Product name" icon="pricetag-outline" placeholder="Huawei AX3 Router" value={form.name} onChangeText={set('name')} error={errors.name} />
        <SectionHeader title="Category" />
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.value} style={[styles.chip, category === c.value && styles.chipOn]} onPress={() => setCategory(c.value)}>
              <Text variant="label">{c.label}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Reorder level" icon="trending-down-outline" keyboardType="number-pad" placeholder="Reorder when stock drops to" value={form.reorderLevel} onChangeText={(v) => set('reorderLevel')(v.replace(/\D/g, ''))} error={errors.reorderLevel} />
        {errors._ ? <Text variant="bodySm" color={colors.danger}>{errors._}</Text> : null}
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  scanRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
