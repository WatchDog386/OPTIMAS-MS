import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Ratings } from '../../src/api/insights';
import { Avatar, Glass, Screen, ScreenHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts, radius, space } from '../../src/theme';
import { date } from '../../src/utils/format';

const GOLD = '#F5B400';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={n <= Math.round(value) ? GOLD : 'rgba(28,29,31,0.25)'} />
      ))}
    </View>
  );
}

/** What customers say after each visit: the average, the spread, who earns it and the latest comments. */
export default function RatingsScreen() {
  const { data, refresh, refreshing } = useApi<Ratings>('/insights/ratings');
  const max = Math.max(1, ...(data?.distribution ?? []).map((d) => d.count));
  const happy = data && data.count ? Math.round(((data.distribution.filter((d) => d.stars >= 4).reduce((n, d) => n + d.count, 0)) / data.count) * 100) : 0;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title="Customer ratings" subtitle="Last 90 days" />

      <Glass strong style={styles.hero}>
        <View style={{ alignItems: 'center', gap: 4, width: 110 }}>
          <Text variant="h1" style={{ fontFamily: fonts.bold, fontSize: 46, lineHeight: 52 }}>
            {data?.average != null ? data.average.toFixed(1) : '–'}
          </Text>
          <Stars value={data?.average ?? 0} size={16} />
          <Text variant="label" color={colors.textMuted}>
            {data?.count ?? 0} ratings
          </Text>
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          {[5, 4, 3, 2, 1].map((s) => {
            const count = data?.distribution.find((d) => d.stars === s)?.count ?? 0;
            return (
              <View key={s} style={styles.distRow}>
                <Text variant="label" color={colors.textMuted} style={{ width: 12 }}>
                  {s}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(count / max) * 100}%`, backgroundColor: s >= 4 ? colors.charcoal : s === 3 ? colors.warning : colors.danger }]} />
                </View>
                <Text variant="label" color={colors.textMuted} style={{ width: 26, textAlign: 'right' }}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      </Glass>

      <Glass strong style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.happy}>
          <Ionicons name="happy-outline" size={22} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title">{happy}% happy customers</Text>
          <Text variant="label" color={colors.textMuted}>
            Rated 4 or 5 stars
          </Text>
        </View>
      </Glass>

      {data && data.count === 0 ? (
        <Glass strong style={{ alignItems: 'center', gap: 6 }}>
          <Ionicons name="star-outline" size={28} color={colors.textDim} />
          <Text variant="bodySm" color={colors.textMuted} align="center">
            No ratings yet. Customers can rate a visit from their app once the job is completed.
          </Text>
        </Glass>
      ) : null}

      <Text variant="h2" style={{ marginLeft: 4 }}>
        By technician
      </Text>
      <Glass strong style={{ padding: 0, overflow: 'hidden' }}>
        {(data?.byTechnician ?? []).map((t, i) => (
          <View key={t.user.id} style={[styles.row, i > 0 && styles.rowLine]}>
            <Avatar name={t.user.name} />
            <View style={{ flex: 1 }}>
              <Text variant="title">{t.user.name}</Text>
              <Text variant="label" color={colors.textMuted}>
                {t.count} ratings
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text variant="h2" style={{ fontFamily: fonts.bold }}>
                {t.average.toFixed(1)}
              </Text>
              <Stars value={t.average} size={11} />
            </View>
          </View>
        ))}
      </Glass>

      <Text variant="h2" style={{ marginLeft: 4 }}>
        Latest feedback
      </Text>
      {(data?.recent ?? []).map((r) => (
        <Glass key={r.id} strong style={{ gap: 8 }} >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stars value={r.rating} />
            <Text variant="label" color={colors.textDim}>
              {date(r.ratedAt)}
            </Text>
          </View>
          {r.feedback ? <Text variant="body">“{r.feedback}”</Text> : <Text variant="bodySm" color={colors.textDim}>No comment left.</Text>}
          <Text
            variant="label"
            color={colors.textMuted}
            onPress={() => router.push(`/task/${r.id}`)}
            accessibilityRole="link"
          >
            {r.customerName} · {r.technician} · {r.code}
          </Text>
        </Glass>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  happy: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.border },
});
