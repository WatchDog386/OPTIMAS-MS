import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../../src/api/client';
import type { BulkHolding, SerialUnit, StockCountResult } from '../../src/api/types';
import { Badge, Button, Card, EmptyState, ListRow, Screen, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { requestScan } from '../../src/store/bridge';
import { colors, space } from '../../src/theme';
import { dateTime } from '../../src/utils/format';

interface MyStock {
  pending: SerialUnit[];
  units: SerialUnit[];
  bulk: BulkHolding[];
  lastCount: StockCountResult | null;
  ageAlertDays: number;
}

export default function MyStock() {
  const { data, refresh, refreshing, reload } = useApi<MyStock>('/inventory/my');
  const [busy, setBusy] = useState<'accept' | 'count' | null>(null);

  const acceptAll = async () => {
    setBusy('accept');
    try {
      const r = await api<{ accepted: number }>('/inventory/accept', { body: {} });
      Alert.alert('Receipt confirmed', `${r.accepted} item(s) are now in your custody.`);
      await reload();
    } catch (e) {
      Alert.alert('Could not confirm', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const runCount = async () => {
    const serials = await requestScan({ multiple: true, title: 'Scan every router you hold' });
    if (!serials) return;
    setBusy('count');
    try {
      await api('/inventory/stock-count', { body: { serials } });
      await reload();
    } catch (e) {
      Alert.alert('Stock count failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  };

  const count = data?.lastCount;
  const total = (data?.units.length ?? 0) + (data?.pending.length ?? 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text variant="h1">My stock</Text>

      <Card variant="hero" style={styles.hero}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="overline" color={colors.textMuted}>
            Devices in custody
          </Text>
          <Text variant="display">{total}</Text>
          <Text variant="bodySm" color={colors.textMuted}>
            Routers & ONTs you are accountable for
          </Text>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="wifi" size={34} color={colors.brand} />
        </View>
      </Card>

      {data?.pending.length ? (
        <>
          <SectionHeader title="Awaiting your confirmation" />
          <Text variant="bodySm" color={colors.textMuted}>
            Only confirm items you have physically received. You cannot install unconfirmed devices.
          </Text>
          {data.pending.map((u) => (
            <ListRow key={u.id} icon="cube-outline" iconTint={colors.warning} title={u.item.name} subtitle={`S/N ${u.serialNumber}`} right={<Badge label="Issued" tone="warning" />} />
          ))}
          <Button label={`Confirm receipt (${data.pending.length})`} icon="checkmark-circle" loading={busy === 'accept'} onPress={acceptAll} />
        </>
      ) : null}

      <SectionHeader title="Routers & ONTs in hand" />
      {data?.units.length ? (
        data.units.map((u) => {
          const overdue = (u.daysHeld ?? 0) >= data.ageAlertDays;
          return (
            <ListRow
              key={u.id}
              icon="wifi"
              iconTint={overdue ? colors.danger : colors.info}
              title={u.item.name}
              subtitle={`S/N ${u.serialNumber}`}
              right={<Badge label={u.daysHeld ? `${u.daysHeld}d held` : 'Today'} tone={overdue ? 'danger' : 'info'} />}
            />
          );
        })
      ) : (
        <EmptyState icon="wifi-outline" title="No devices in hand" message="Devices issued to you by the store appear here." />
      )}

      <SectionHeader title="Materials" />
      {data?.bulk.length ? (
        data.bulk.map((b) => (
          <ListRow key={b.id} icon="git-commit-outline" iconTint={colors.accent} title={b.item.name} subtitle={b.item.sku} right={<Text variant="title">{`${b.quantity} ${b.item.unit}`}</Text>} />
        ))
      ) : (
        <Text variant="bodySm" color={colors.textMuted}>
          No cable or accessories issued.
        </Text>
      )}

      <SectionHeader title="Stock count" />
      <Card style={{ gap: space.md }}>
        <Text variant="bodySm" color={colors.textMuted}>
          Scan every router and ONT you physically have. Missing devices are reported to the store.
        </Text>
        {count ? (
          <View style={{ gap: space.sm }}>
            <Text variant="label" color={colors.textDim}>
              Last count · {dateTime(count.createdAt)}
            </Text>
            {count.missing.length === 0 && count.unexpected.length === 0 ? (
              <Badge label="All devices accounted for" tone="success" />
            ) : (
              <>
                {count.missing.length ? <Badge label={`Missing: ${count.missing.join(', ')}`} tone="danger" /> : null}
                {count.unexpected.length ? <Badge label={`Not on your record: ${count.unexpected.join(', ')}`} tone="warning" /> : null}
              </>
            )}
          </View>
        ) : null}
        <Button label="Start stock count" icon="barcode-outline" variant="secondary" loading={busy === 'count'} onPress={runCount} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', padding: space.xl },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.heroInset, alignItems: 'center', justifyContent: 'center' },
});
