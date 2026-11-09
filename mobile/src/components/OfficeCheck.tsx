import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useApi } from '../hooks/useApi';
import { colors, fonts, isDark } from '../theme';
import { distanceLabel, metres, watchFix, type Fix } from '../utils/location';
import { MapCanvas, type MapCircle, type MapPin } from './map';
import { PulseDot } from './Motion';
import { Text } from './Text';

export type Office = { lat: number; lng: number; radiusM: number; name: string };
/** A reading this rough (metres) cannot place someone at the office. */
export const PRECISE_ENOUGH_M = 100;

export type OfficeState = 'loading' | 'off' | 'no-office' | 'searching' | 'weak' | 'at' | 'away';

/**
 * Where the person is compared with the office, live: the office, the latest GPS reading, how far apart they
 * are and what that means — at the office, away, still finding a precise position, or location off.
 */
export function useOfficeCheck() {
  const office = useApi<{ office: Office | null }>('/attendance/office');
  const [fix, setFix] = useState<Fix | null>(null);
  const [off, setOff] = useState(false);
  useEffect(() => {
    let stop = () => {};
    let gone = false;
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return setOff(true);
      }
      if (gone) return;
      stop = watchFix(
        (f) => {
          setFix(f);
          setOff(false);
        },
        () => setOff(true),
      );
    })();
    return () => {
      gone = true;
      stop();
    };
  }, []);

  const o = office.data?.office ?? null;
  const away = o && fix ? metres([fix.lat, fix.lng], [o.lat, o.lng]) : null;
  const rough = fix?.accuracy == null || fix.accuracy > PRECISE_ENOUGH_M;
  const state: OfficeState = !office.data
    ? 'loading'
    : off
      ? 'off'
      : !o
        ? 'no-office'
        : !fix
          ? 'searching'
          : away! > o.radiusM
            ? // Clearly outside, even allowing for the GPS error, or a precise reading outside
              rough && away! - (fix.accuracy ?? 0) <= o.radiusM
              ? 'weak'
              : 'away'
            : rough && (fix.accuracy ?? Infinity) > o.radiusM
              ? 'weak'
              : 'at';
  return { office: o, fix, away, state };
}

const TONE = {
  ok: { fg: '#2DA043', bg: isDark ? 'rgba(45,160,67,0.16)' : '#EAF7ED' },
  bad: { fg: '#DC2626', bg: isDark ? 'rgba(220,38,38,0.16)' : '#FEF2F2' },
  wait: { fg: '#D97706', bg: isDark ? 'rgba(217,119,6,0.16)' : '#FFFBEB' },
  info: { fg: colors.textMuted, bg: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F0' },
};

/** The headline and explanation for each state. */
export function officeMessage(state: OfficeState, away: number | null, fix: Fix | null, office: Office | null) {
  const acc = fix?.accuracy != null ? `±${distanceLabel(fix.accuracy)}` : '';
  switch (state) {
    case 'at':
      return { tone: TONE.ok, icon: 'checkmark-circle' as const, title: 'You are at the office', detail: `${distanceLabel(away ?? 0)} from the office pin · GPS ${acc}` };
    case 'away':
      return { tone: TONE.bad, icon: 'alert-circle' as const, title: `${distanceLabel(away ?? 0)} from the office`, detail: `Outside the ${distanceLabel(office?.radiusM ?? 300)} check-in zone. Your supervisor will be told.` };
    case 'weak':
      return { tone: TONE.wait, icon: 'locate' as const, title: 'Finding your exact position…', detail: `GPS ${acc} is too rough to confirm the office. Stand outside or near a window for a few seconds.` };
    case 'searching':
      return { tone: TONE.wait, icon: 'locate' as const, title: 'Finding your location…', detail: 'Keep the app open; this takes a few seconds.' };
    case 'off':
      return { tone: TONE.bad, icon: 'location' as const, title: 'Location is off', detail: 'Allow location for this app so your check-in shows you are at the office.' };
    case 'no-office':
      return { tone: TONE.info, icon: 'business' as const, title: 'Office location not set', detail: 'Your supervisor has not set the office on the map yet.' };
    default:
      return { tone: TONE.info, icon: 'locate' as const, title: 'Checking your location…', detail: '' };
  }
}

/** The location card on the check-in / check-out screen: a live map with the office zone and you, and the verdict. */
export function OfficeCheckCard({ check }: { check: ReturnType<typeof useOfficeCheck> }) {
  const { office, fix, away, state } = check;
  const msg = officeMessage(state, away, fix, office);
  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = [];
    if (office) list.push({ id: 'office', kind: 'site', lat: office.lat, lng: office.lng, label: 'Office' });
    if (fix) list.push({ id: 'me', kind: 'me', lat: fix.lat, lng: fix.lng, heading: fix.heading, live: true });
    return list;
  }, [office, fix]);
  const circles = useMemo<MapCircle[]>(() => {
    const list: MapCircle[] = [];
    if (office) list.push({ id: 'zone', lat: office.lat, lng: office.lng, radiusM: office.radiusM, color: '#2DA043' });
    if (fix?.accuracy) list.push({ id: 'accuracy', lat: fix.lat, lng: fix.lng, radiusM: fix.accuracy, color: '#2563EB', dashed: true });
    return list;
  }, [office, fix]);
  // Re-frame when the picture changes meaningfully (first fix, or a much better one)
  const fitKey = `${office ? 1 : 0}-${fix ? 1 : 0}-${fix?.accuracy ? Math.round(Math.log2(fix.accuracy + 1)) : 0}`;

  return (
    <View style={styles.card}>
      {office || fix ? (
        <View style={styles.map}>
          <MapCanvas pins={pins} circles={circles} fitKey={fitKey} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      <View style={[styles.verdict, { backgroundColor: msg.tone.bg }]}>
        {state === 'searching' || state === 'weak' ? <PulseDot color={msg.tone.fg} size={8} /> : <Ionicons name={msg.icon} size={22} color={msg.tone.fg} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" color={msg.tone.fg} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            {msg.title}
          </Text>
          {msg.detail ? (
            <Text variant="label" color={colors.textMuted} style={{ fontSize: 12 }}>
              {msg.detail}
            </Text>
          ) : null}
        </View>
      </View>
      {office ? (
        <View style={styles.legend}>
          <View style={[styles.swatch, { backgroundColor: 'rgba(45,160,67,0.25)', borderColor: '#2DA043' }]} />
          <Text variant="label" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11, flex: 1 }}>
            Check-in zone · {distanceLabel(office.radiusM)} around {office.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, overflow: 'hidden', backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  map: { height: 190, backgroundColor: isDark ? '#1E1E1E' : '#E8EEF0' },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
});
