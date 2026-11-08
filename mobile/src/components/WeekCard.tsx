import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { fonts } from '../theme';
import { Text } from './Text';

/*
 * "Jobs done this week" as a wallet card: deep green with fine wavy lines and a large faint rounded
 * shape on the right, white lettering, the week as small bars, and two outlined buttons underneath.
 */

const LIME = '#8DC63F';

export function WeekCard({
  title = 'Jobs done this week',
  owner,
  data,
  actions,
}: {
  title?: string;
  /** Small capitals under the title (e.g. the person's name). */
  owner?: string;
  data: { label: string; value: number }[];
  actions: { label: string; onPress: () => void }[];
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.card}>
      <LinearGradient colors={['#0F5C45', '#0B4C39', '#08402F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Fine wavy lines and a large rounded shape, as on a bank card */}
      <Svg width="100%" height="100%" viewBox="0 0 340 220" preserveAspectRatio="xMaxYMid slice" style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: 9 }, (_, i) => (
          <Path key={i} d={`M120 ${150 + i * 7} C 190 ${95 + i * 9}, 250 ${215 - i * 4}, 345 ${120 + i * 8}`} stroke="rgba(255,255,255,0.10)" strokeWidth={1} fill="none" />
        ))}
        <Rect x={250} y={-30} width={130} height={150} rx={34} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={24} />
      </Svg>

      <View style={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.medium, fontSize: 15 }}>
              {title}
            </Text>
            {owner ? (
              <Text variant="label" color="rgba(255,255,255,0.78)" fixedColor numberOfLines={1} style={{ fontSize: 11, letterSpacing: 0.3 }}>
                {owner.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.middle}>
          <Text variant="display" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30 }}>
            {total} {total === 1 ? 'job' : 'jobs'}
          </Text>
          <View style={styles.bars} accessibilityLabel={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
            {data.map((d, i) => (
              <View key={d.label + i} style={styles.barCol}>
                <View style={styles.track}>
                  <View style={[styles.fill, { height: `${Math.max(8, (d.value / max) * 100)}%`, backgroundColor: i === data.length - 1 ? LIME : 'rgba(255,255,255,0.55)', opacity: d.value ? 1 : 0.35 }]} />
                </View>
                <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor style={{ fontSize: 9 }}>
                  {d.label.slice(0, 2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text variant="body" color="#FFFFFF" fixedColor style={{ fontFamily: fonts.medium, fontSize: 14 }}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: '#0B4C39' },
  body: { padding: 16, paddingTop: 14, gap: 12 },
  middle: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 44 },
  barCol: { alignItems: 'center', gap: 3, width: 16 },
  track: { width: 8, height: 30, justifyContent: 'flex-end' },
  fill: { width: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  btn: { flex: 1, height: 42, borderRadius: 8, borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
});
