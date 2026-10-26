import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Glass } from './Glass';
import { CountUp, ProgressRing } from './Motion';
import { Text } from './Text';

/*
 * Summary cards in the "notched" style: a rounded card whose top edge has a small centre bite holding a
 * chevron tab, with a dark strip or capsule attached to it. Used for the admin dashboard's
 * "Jobs done this week" and "Attendance today".
 */

const RADIUS = 28;
const BITE_HALF = 34;
const BITE_DEPTH = 17;

/** Rounded rectangle with a smooth bite out of the middle of the top edge. */
function notchedTopPath(w: number, h: number) {
  const cx = w / 2;
  const left = cx - BITE_HALF;
  const right = cx + BITE_HALF;
  const a = BITE_HALF * 0.55;
  const b = BITE_HALF * 0.62;
  const r = RADIUS;
  return [
    `M ${r} 0`,
    `H ${left}`,
    `C ${cx - a} 0 ${cx - b} ${BITE_DEPTH} ${cx} ${BITE_DEPTH}`,
    `C ${cx + b} ${BITE_DEPTH} ${cx + a} 0 ${right} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

/** The card shape itself; `onTab` makes the chevron in the bite tappable. */
export function NotchCard({ children, style, onTab, tabLabel = 'Open' }: { children: ReactNode; style?: StyleProp<ViewStyle>; onTab?: () => void; tabLabel?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View style={[styles.card, style]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Path d={notchedTopPath(box.w, box.h)} fill="#FFFFFF" stroke="rgba(28,29,31,0.07)" strokeWidth={1} />
        </Svg>
      ) : null}
      <Pressable onPress={onTab} disabled={!onTab} hitSlop={8} accessibilityRole="button" accessibilityLabel={tabLabel} style={styles.tab}>
        <Ionicons name="chevron-up" size={15} color={colors.textMuted} />
      </Pressable>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

/** Dark rounded chip with an icon, like the "Tour to Mecca" pill in the reference. */
function Chip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={13} color={colors.highlight} />
      <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

const dayRange = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const fmt = (d: Date, month: boolean) => d.toLocaleDateString('en-KE', month ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return start.getMonth() === end.getMonth() ? `${fmt(start, false)} – ${fmt(end, true)}` : `${fmt(start, true)} – ${fmt(end, true)}`;
};

/* ───────────────────────── Jobs done this week ───────────────────────── */

export function JobsWeekCard({
  week,
  open,
  verifying,
  onAll,
}: {
  /** Jobs finished per day, oldest first (today last) */
  week: { label: string; value: number }[];
  /** Jobs still assigned or in progress */
  open: number;
  /** Jobs finished and waiting for a supervisor to verify */
  verifying: number;
  onAll: () => void;
}) {
  const total = week.reduce((n, d) => n + d.value, 0);
  const rate = total + open > 0 ? total / (total + open) : 0;
  return (
    <View>
      <NotchCard onTab={onAll} tabLabel="All jobs" style={{ zIndex: 2 }}>
        <View style={styles.rowBetween}>
          <Chip icon="briefcase" label="This week" />
          <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
            {dayRange(week.length)}
          </Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 18 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
              Jobs done
            </Text>
            <CountUp value={total} style={styles.big} />
            <Text variant="label" color={colors.textMuted}>
              {open} open{verifying ? ` · ${verifying} to verify` : ''}
            </Text>
          </View>
          <ProgressRing size={96} stroke={9} progress={rate}>
            <Text variant="h2" style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 }}>
              {Math.round(rate * 100)}%
            </Text>
            <Text variant="label" color={colors.textMuted} style={{ fontSize: 10.5 }}>
              completed
            </Text>
          </ProgressRing>
        </View>
      </NotchCard>

      {/* Dark strip tucked under the card: jobs per day */}
      <Pressable onPress={onAll} accessibilityRole="button" accessibilityLabel="Jobs per day, open all jobs" style={styles.strip}>
        {week.map((d, i) => {
          const today = i === week.length - 1;
          return (
            <View key={`${d.label}${i}`} style={[styles.day, today && styles.dayToday]}>
              <Text variant="label" color={today ? colors.onHighlight : 'rgba(255,255,255,0.6)'} fixedColor style={{ fontSize: 11, fontFamily: fonts.medium }}>
                {d.label}
              </Text>
              <Text variant="title" color={today ? colors.onHighlight : colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 }}>
                {d.value}
              </Text>
            </View>
          );
        })}
      </Pressable>
    </View>
  );
}

/* ───────────────────────── Attendance today ───────────────────────── */

export interface AttendancePerson {
  id: string;
  name: string;
  state: 'in' | 'late' | 'absent';
}

const STATE_DOT = { in: colors.success, late: '#F59E0B', absent: colors.danger } as const;

function Avatar({ state }: { state: AttendancePerson['state'] }) {
  return (
    <View style={styles.avatar}>
      <Ionicons name="person" size={17} color={colors.white} />
      <View style={[styles.avatarDot, { backgroundColor: STATE_DOT[state] }]} />
    </View>
  );
}

/** Thin progress bar that fills smoothly. */
function Bar({ value }: { value: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, value)), duration: 900, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: false }).start();
  }, [value, v]);
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

export function AttendanceCard({
  checkedIn,
  total,
  late,
  absent,
  checkedOut,
  people,
  pendingReviews,
  onRegister,
  onReviews,
}: {
  checkedIn: number;
  total: number;
  late: number;
  absent: number;
  checkedOut: number;
  people: AttendancePerson[];
  pendingReviews: number;
  onRegister: () => void;
  onReviews: () => void;
}) {
  const rate = total ? checkedIn / total : 0;
  const shown = people.slice(0, 3);
  const more = Math.max(0, people.length - shown.length);
  const date = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
  return (
    <View>
      <NotchCard onTab={onRegister} tabLabel="Open the attendance register">
        <View style={styles.rowBetween}>
          <Chip icon="calendar" label="Today" />
          <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium, marginRight: 62 }}>
            {date}
          </Text>
        </View>
        <View style={{ marginTop: 18, marginRight: 70, gap: 2, minHeight: 92 }}>
          <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
            Attendance today
          </Text>
          <CountUp value={`${checkedIn}/${total}`} style={styles.big} />
          <Text variant="label" color={colors.textMuted}>
            checked in
          </Text>
        </View>

        {/* Dark capsule of people, with a colour dot for their status */}
        <Pressable onPress={onRegister} accessibilityRole="button" accessibilityLabel="Who is in today" style={styles.capsule}>
          {shown.map((p) => (
            <Avatar key={p.id} state={p.state} />
          ))}
          {more ? (
            <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 12 }}>
              +{more}
            </Text>
          ) : null}
          {!people.length ? <Ionicons name="people" size={20} color="rgba(255,255,255,0.6)" /> : null}
        </Pressable>
      </NotchCard>

      <Glass strong radius={24} style={{ marginTop: 10, gap: 12, paddingVertical: 14 }}>
        <View style={styles.progressRow}>
          <Text variant="title" style={{ fontFamily: fonts.bold, fontSize: 17, minWidth: 46 }}>
            {Math.round(rate * 100)}%
          </Text>
          <Bar value={rate} />
          <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.medium }}>
            {checkedIn} of {total}
          </Text>
        </View>
        <View style={styles.progressRow}>
          <Text variant="label" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
            {late} late · {absent} absent · {checkedOut} out
          </Text>
          <Pressable onPress={onReviews} accessibilityRole="button" accessibilityLabel="Dress-code photos to review" style={styles.roundBtn}>
            <Ionicons name="shirt-outline" size={18} color={colors.text} />
            {pendingReviews ? (
              <View style={styles.badge}>
                <Text variant="label" color={colors.white} fixedColor style={{ fontFamily: fonts.bold, fontSize: 10 }}>
                  {pendingReviews}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable onPress={onRegister} accessibilityRole="button" accessibilityLabel="Attendance register" style={[styles.roundBtn, { backgroundColor: colors.highlight }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.onHighlight} />
          </Pressable>
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    // Web only: a soft shadow that follows the notched outline (box-shadow would stay rectangular)
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0px 10px 16px rgba(28,29,31,0.09))' } as ViewStyle) : null),
  },
  tab: { position: 'absolute', top: 0, left: '50%', width: 40, height: 22, marginLeft: -20, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  body: { padding: 18, paddingTop: 30 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.charcoal },
  big: { fontFamily: fonts.semibold, fontSize: 44, lineHeight: 50, letterSpacing: -1, color: colors.text },
  strip: {
    flexDirection: 'row',
    gap: 6,
    marginHorizontal: 14,
    marginTop: -24,
    paddingTop: 34,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: colors.charcoal,
    zIndex: 1,
  },
  day: { flex: 1, alignItems: 'center', gap: 1, paddingVertical: 7, borderRadius: 16 },
  dayToday: { backgroundColor: colors.highlight },
  capsule: { position: 'absolute', top: 14, right: 16, width: 46, paddingVertical: 10, gap: 8, borderRadius: 23, alignItems: 'center', backgroundColor: colors.charcoal },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  avatarDot: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.charcoal },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(28,29,31,0.08)', overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: colors.highlight },
  roundBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,29,31,0.06)' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});
