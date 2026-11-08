import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Charts } from '../api/insights';
import { useApi } from '../hooks/useApi';
import { colors, fonts, space } from '../theme';

// On-time bars: the dark-mode green in light and dark mode alike; late ones amber
const ON_TIME = '#7CB83A';
const LATE = '#D97706';
import { StackedBars } from './Charts';
import { Glass } from './Glass';
import { Text } from './Text';

export const shortDate = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

/** A chart with its title, headline figure and note (Reports & charts). */
export function ChartCard({ title, big, note, children, compact }: { title: string; big: string; note: string; children: ReactNode; compact?: boolean }) {
  return (
    <Glass strong radius={compact ? 12 : 28} style={{ gap: compact ? space.sm : space.md, ...(compact ? { paddingVertical: 14 } : null) }}>
      <View>
        <Text variant="label" color={colors.textMuted}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <Text variant="h1" style={{ fontFamily: fonts.semibold, fontSize: 22 }}>
            {big}
          </Text>
          <Text variant="label" color={colors.textMuted}>
            {note}
          </Text>
        </View>
      </View>
      {children}
    </Glass>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.lg }}>
      {items.map((i) => (
        <View key={i.label} style={styles.legendRow}>
          <View style={[styles.swatch, { backgroundColor: i.color }]} />
          <Text variant="label" color={colors.textMuted}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The Attendance chart: on time and late, day by day. `rows` from the charts already loaded, or fetched here. */
export function AttendanceChartCard({ rows: given, days = 14 }: { rows?: Charts['perDay']; days?: number }) {
  const { data } = useApi<Charts>(given ? null : `/insights/charts?days=${days}`);
  const rows = given ?? data?.perDay ?? [];
  const present = rows.reduce((n, r) => n + r.present, 0);
  const late = rows.reduce((n, r) => n + r.late, 0);
  return (
    <ChartCard compact title="Attendance" big={`${present - late} on time`} note={`${late} late arrivals`}>
      <StackedBars height={104} data={rows.map((r) => ({ label: shortDate(r.date), a: r.present - r.late, b: r.late }))} a={ON_TIME} b={LATE} />
      <Legend items={[{ label: 'On time', color: ON_TIME }, { label: 'Late', color: LATE }]} />
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
