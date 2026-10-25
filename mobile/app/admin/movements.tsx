import type { Movement } from '../../src/api/types';
import { ListRow, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { dateTime, humanize } from '../../src/utils/format';

const icon: Record<string, { name: 'arrow-down' | 'arrow-up' | 'checkmark' | 'return-down-back' | 'flame' | 'wifi' | 'warning' | 'build' | 'create'; tint: string }> = {
  RECEIVE: { name: 'arrow-down', tint: colors.info },
  ISSUE: { name: 'arrow-up', tint: colors.primary },
  ACCEPT: { name: 'checkmark', tint: colors.success },
  RETURN: { name: 'return-down-back', tint: colors.accent },
  CONSUME: { name: 'flame', tint: colors.warning },
  INSTALL: { name: 'wifi', tint: colors.success },
  REPORT_LOST: { name: 'warning', tint: colors.danger },
  REPORT_FAULTY: { name: 'build', tint: colors.danger },
  ADJUST: { name: 'create', tint: colors.textMuted },
};

export default function Movements() {
  const { data, refresh, refreshing } = useApi<{ movements: Movement[] }>('/inventory/movements?limit=150');
  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Stock ledger" subtitle="Immutable record of every movement" />
      {data?.movements.map((m) => {
        const i = icon[m.type] ?? icon.ADJUST;
        const who = [m.fromUser && `from ${m.fromUser.name}`, m.toUser && `to ${m.toUser.name}`, m.task && m.task.code].filter(Boolean).join(' · ');
        return (
          <ListRow
            key={m.id}
            icon={i.name}
            iconTint={i.tint}
            title={`${humanize(m.type)} · ${m.item.name}`}
            subtitle={`${m.unit ? `S/N ${m.unit.serialNumber}` : `${m.quantity} ${m.item.unit ?? ''}`}${who ? ` · ${who}` : ''}\n${dateTime(m.createdAt)} · by ${m.actor.name}`}
          />
        );
      })}
      {!data?.movements.length ? (
        <Text variant="bodySm" color={colors.textMuted}>
          No movements yet.
        </Text>
      ) : null}
    </Screen>
  );
}
