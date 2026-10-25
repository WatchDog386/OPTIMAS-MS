import { StyleSheet, View } from 'react-native';
import type { Reconciliation } from '../../src/api/types';
import { Avatar, Badge, Card, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, radius, space } from '../../src/theme';
import { date, dateTime } from '../../src/utils/format';

/** Per-technician accountability: every issued device must be installed, returned or still in hand. */
export default function ReconciliationScreen() {
  const { data, refresh, refreshing } = useApi<Reconciliation>('/inventory/reconciliation');
  const sorted = [...(data?.technicians ?? [])].sort((a, b) => (a.risk === 'HIGH' ? -1 : b.risk === 'HIGH' ? 1 : 0));
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Reconciliation" subtitle={data ? `Generated ${dateTime(data.generatedAt)}` : undefined} />
      <Text variant="bodySm" color={colors.textMuted}>
        Issued = Installed + Returned + Lost + In hand. Devices held over {data?.ageAlertDays ?? 3} days are flagged.
      </Text>
      {sorted.map((r) => {
        const s = r.serialised;
        return (
          <Card key={r.technician.id} style={[{ gap: space.md }, r.risk === 'HIGH' && styles.risk]}>
            <View style={styles.row}>
              <Avatar name={r.technician.name} tint={r.risk === 'HIGH' ? colors.danger : colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{r.technician.name}</Text>
                <Text variant="bodySm" color={colors.textMuted}>
                  {r.technician.staffNo}
                </Text>
              </View>
              <Badge label={r.risk === 'HIGH' ? 'Attention' : r.risk === 'CLEAR' ? 'Clear' : 'OK'} tone={r.risk === 'HIGH' ? 'danger' : 'success'} />
            </View>
            <View style={styles.grid}>
              <Num label="Issued" value={s.issued} />
              <Num label="Installed" value={s.installed} tint={colors.success} />
              <Num label="Returned" value={s.returned} tint={colors.info} />
              <Num label="Lost" value={s.lost} tint={s.lost ? colors.danger : colors.textMuted} />
              <Num label="In hand" value={s.inHand} tint={colors.warning} />
            </View>
            {s.pendingAcceptance ? <Badge label={`${s.pendingAcceptance} not yet confirmed by technician`} tone="warning" /> : null}
            {s.overdue.map((o) => (
              <Badge key={o.serialNumber} label={`Overdue: ${o.serialNumber} since ${date(o.heldSince)}`} tone="danger" />
            ))}
            {r.lastCount?.missing.length ? <Badge label={`Missing at last count: ${r.lastCount.missing.join(', ')}`} tone="danger" /> : null}
            {r.bulkInHand.length ? (
              <Text variant="bodySm" color={colors.textMuted}>
                Materials: {r.bulkInHand.map((b) => `${b.quantity} ${b.unit} ${b.name}`).join(' · ')}
              </Text>
            ) : null}
            <Text variant="label" color={colors.textDim}>
              {r.lastCount ? `Last stock count ${dateTime(r.lastCount.at)}` : 'No stock count yet'}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
}

function Num({ label, value, tint = colors.text }: { label: string; value: number; tint?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="h2" color={tint}>
        {value}
      </Text>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grid: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingVertical: space.md },
  risk: { borderWidth: 1, borderColor: `${colors.danger}55` },
});
