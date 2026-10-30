import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Leaderboard } from '../../src/api/insights';
import { Avatar, Glass, Screen, ScreenHeader, Segmented, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, radius, space } from '../../src/theme';
import { duration, firstName } from '../../src/utils/format';

type Range = 'week' | 'month';
const MEDAL = ['#F2C94C', '#BFC5CC', '#D79A6B'];

/** Who is doing the most and best work: jobs, customer rating and attendance rolled into one score. */
export default function LeaderboardScreen() {
  const [range, setRange] = useState<Range>('week');
  const { data, refresh, refreshing } = useApi<Leaderboard>(`/insights/leaderboard?range=${range}`);
  const leaders = data?.leaders ?? [];
  const podium = [leaders[1], leaders[0], leaders[2]]; // 2nd · 1st · 3rd
  const totalJobs = leaders.reduce((n, l) => n + l.jobs, 0);
  const rated = leaders.filter((l) => l.rating.average != null);
  const teamRating = rated.length ? rated.reduce((n, l) => n + (l.rating.average ?? 0), 0) / rated.length : null;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Leaderboard" subtitle="Technician performance" />
      <Segmented<Range>
        options={[
          { value: 'week', label: 'This week' },
          { value: 'month', label: 'Last 30 days' },
        ]}
        value={range}
        onChange={setRange}
      />

      <Glass strong style={styles.summary}>
        <Summary value={String(totalJobs)} label="Jobs done" />
        <View style={styles.divider} />
        <Summary value={teamRating ? teamRating.toFixed(1) : '–'} label="Team rating" icon="star" />
        <View style={styles.divider} />
        <Summary value={String(leaders.length)} label="Technicians" />
      </Glass>

      {leaders.length >= 3 ? (
        <Glass strong style={styles.podiumCard}>
          <View style={styles.podium}>
            {podium.map((l, i) => {
              const place = i === 1 ? 0 : i === 0 ? 1 : 2;
              const heights = [118, 150, 96];
              return (
                <Pressable key={l.user.id} style={styles.podiumCol} onPress={() => router.push(`/admin/user/${l.user.id}`)} accessibilityRole="button" accessibilityLabel={`${l.user.name}, place ${place + 1}`}>
                  {place === 0 ? <Ionicons name="trophy" size={22} color={MEDAL[0]} style={{ marginBottom: 4 }} /> : null}
                  <Avatar name={l.user.name} tint={place === 0 ? colors.navy : colors.primary} />
                  <Text variant="label" style={{ fontFamily: fonts.semibold, marginTop: 6 }} numberOfLines={1}>
                    {firstName(l.user.name)}
                  </Text>
                  <Text variant="label" color={colors.textMuted}>
                    {l.jobs} jobs
                  </Text>
                  <View style={[styles.block, { height: heights[place], backgroundColor: place === 0 ? colors.highlight : colors.surfaceAlt }]}>
                    <Text variant="h1" style={{ fontFamily: fonts.bold, fontSize: 22 }}>
                      {l.rank}
                    </Text>
                    <Text variant="label" color={colors.textMuted}>
                      {l.score} pts
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Glass>
      ) : null}

      <Glass strong style={{ padding: 0, overflow: 'hidden' }}>
        {leaders.map((l, i) => (
          <Pressable key={l.user.id} onPress={() => router.push(`/admin/user/${l.user.id}`)} style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <View style={[styles.rank, l.rank <= 3 && { backgroundColor: MEDAL[l.rank - 1] }]}>
              <Text variant="label" style={{ fontFamily: fonts.bold }} color={l.rank <= 3 ? colors.text : colors.textMuted}>
                {l.rank}
              </Text>
            </View>
            <Avatar name={l.user.name} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title" numberOfLines={1}>
                {l.user.name}
              </Text>
              <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                {l.user.region ?? l.user.staffNo} · avg {duration(l.avgMinutes)} · {l.daysPresent} days in{l.lateDays ? ` · ${l.lateDays} late` : ''}
              </Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(100, (l.score / (leaders[0]?.score || 1)) * 100)}%` }]} />
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text variant="h2" style={{ fontFamily: fonts.bold }}>
                {l.score}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={12} color="#F5B400" />
                <Text variant="label" color={colors.textMuted}>
                  {l.rating.average != null ? l.rating.average.toFixed(1) : '–'}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </Glass>
      <Text variant="label" color={colors.textDim} style={{ textAlign: 'center' }}>
        Score = 10 per job + 8 × customer rating + 2 per day present − 3 per late arrival.
      </Text>
    </Screen>
  );
}

function Summary({ value, label, icon }: { value: string; label: string; icon?: 'star' }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text variant="h1" style={{ fontFamily: fonts.semibold, fontSize: 22 }}>
          {value}
        </Text>
        {icon ? <Ionicons name={icon} size={16} color="#F5B400" /> : null}
      </View>
      <Text variant="label" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.lg },
  divider: { width: 1, height: 34, backgroundColor: colors.border },
  podiumCard: { paddingTop: space.xl, paddingBottom: 0, overflow: 'hidden' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  podiumCol: { flex: 1, alignItems: 'center' },
  block: { width: '100%', marginTop: 10, borderTopLeftRadius: 18, borderTopRightRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.border },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 5, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden', marginTop: 4 },
  barFill: { height: 5, borderRadius: radius.pill, backgroundColor: colors.navy },
});
