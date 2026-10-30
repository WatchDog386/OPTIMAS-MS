import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Charts } from '../../src/api/insights';
import { Glass, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { AreaChart, BarChart, Donut, StackedBars } from '../../src/components/Charts';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, space } from '../../src/theme';
import { humanize } from '../../src/utils/format';

type Days = '7' | '14' | '30';
const TYPE_COLOR = [colors.navy, colors.highlight, colors.accent, colors.garnet, '#9AA39E'];
const short = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const kes = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

/** Reports in pictures: jobs, cash, attendance, job mix and stock movement. */
export default function ChartsScreen() {
  const [days, setDays] = useState<Days>('14');
  const { data, refresh, refreshing } = useApi<Charts>(`/insights/charts?days=${days}`);
  const rows = data?.perDay ?? [];
  const sum = (f: (r: Charts['perDay'][number]) => number) => rows.reduce((n, r) => n + f(r), 0);
  const jobs = sum((r) => r.completed);
  const cash = sum((r) => r.collected);
  const present = sum((r) => r.present);
  const late = sum((r) => r.late);
  const typeTotal = (data?.byType ?? []).reduce((n, t) => n + t.count, 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Reports & charts" subtitle="How the work is going" />
      <Segmented<Days>
        options={[
          { value: '7', label: '7 days' },
          { value: '14', label: '14 days' },
          { value: '30', label: '30 days' },
        ]}
        value={days}
        onChange={setDays}
      />

      <ChartCard title="Jobs completed" big={String(jobs)} note={`avg ${rows.length ? (jobs / rows.length).toFixed(1) : 0} a day`}>
        <BarChart data={rows.map((r) => ({ label: short(r.date), value: r.completed }))} />
      </ChartCard>

      <ChartCard title="Cash collected" big={`KES ${cash.toLocaleString('en-KE')}`} note="on installation jobs">
        <AreaChart data={rows.map((r) => ({ label: short(r.date), value: r.collected }))} format={kes} />
      </ChartCard>

      <ChartCard title="Attendance" big={`${present - late} on time`} note={`${late} late arrivals`}>
        <StackedBars data={rows.map((r) => ({ label: short(r.date), a: r.present - r.late, b: r.late }))} />
        <Legend items={[{ label: 'On time', color: colors.charcoal }, { label: 'Late', color: colors.warning }]} />
      </ChartCard>

      <Glass strong style={{ gap: space.lg }}>
        <Text variant="h2">Job mix</Text>
        <View style={styles.donutRow}>
          <Donut total={String(typeTotal)} slices={(data?.byType ?? []).map((t, i) => ({ label: t.type, value: t.count, color: TYPE_COLOR[i % TYPE_COLOR.length] }))} />
          <View style={{ flex: 1, gap: 10 }}>
            {(data?.byType ?? []).map((t, i) => (
              <View key={t.type} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: TYPE_COLOR[i % TYPE_COLOR.length] }]} />
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {humanize(t.type)}
                </Text>
                <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
                  {t.count} · {typeTotal ? Math.round((t.count / typeTotal) * 100) : 0}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Glass>

      <ChartCard title="Devices installed" big={String(sum((r) => r.installed))} note={`${sum((r) => r.issued)} issued · ${sum((r) => r.returned)} returned`}>
        <BarChart data={rows.map((r) => ({ label: short(r.date), value: r.installed }))} color={colors.accent} />
      </ChartCard>

      <ChartCard title="Cable used" big={`${sum((r) => r.consumed).toLocaleString('en-KE')} m`} note="drop cable on jobs">
        <AreaChart data={rows.map((r) => ({ label: short(r.date), value: r.consumed }))} color={colors.garnet} format={(n) => `${n}m`} />
      </ChartCard>
    </Screen>
  );
}

function ChartCard({ title, big, note, children }: { title: string; big: string; note: string; children: React.ReactNode }) {
  return (
    <Glass strong style={{ gap: space.md }}>
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

function Legend({ items }: { items: { label: string; color: string }[] }) {
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

const styles = StyleSheet.create({
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
