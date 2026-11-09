import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api/client';
import { Button, Glass, Input, Loading, MapCanvas, Screen, ScreenHeader, Segmented, Text, type MapCircle, type MapPin } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { toast } from '../../src/store/feedback';
import { confirmAction } from '../../src/utils/confirm';
import { colors, radius, space } from '../../src/theme';
import { distanceLabel, metres, watchFix, type Fix } from '../../src/utils/location';

type Office = { lat: number; lng: number; radiusM: number; name: string; source: 'app' | 'settings' | 'address' };
const RADII = [
  { value: '150', label: '150 m' },
  { value: '300', label: '300 m' },
  { value: '500', label: '500 m' },
  { value: '1000', label: '1 km' },
];
const SOURCE: Record<Office['source'], string> = { app: 'Set in the app (map or phone location)', settings: 'From the server settings', address: 'Found from the address on the map' };

/**
 * The office where staff check in and out. Stand at the office and tap "Use my current location": the
 * phone's GPS becomes the office, and check-ins further than the distance chosen are flagged.
 */
export default function OfficeLocation() {
  const { data, refresh, loading } = useApi<{ office: Office | null }>('/attendance/office');
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsOff, setGpsOff] = useState(false);
  const [radiusM, setRadiusM] = useState('300');
  const [name, setName] = useState('Barber & Spa, Kahawa Station Rd, Githurai');
  const [busy, setBusy] = useState(false);
  // A spot tapped on the map, waiting to be saved
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => watchFix(setFix, () => setGpsOff(true)), []);
  useEffect(() => {
    if (!data?.office) return;
    setRadiusM(String(data.office.radiusM));
    setName(data.office.name);
  }, [data]);

  if (!data && loading) return <Loading />;
  const office = data?.office ?? null;
  const pins: MapPin[] = [];
  if (office) pins.push({ id: 'office', kind: 'site', lat: office.lat, lng: office.lng, label: 'Office' });
  if (fix) pins.push({ id: 'me', kind: 'me', lat: fix.lat, lng: fix.lng, live: true });
  if (picked) pins.push({ id: 'picked', kind: 'job', lat: picked.lat, lng: picked.lng, label: 'New', selected: true });
  const away = office && fix ? metres([fix.lat, fix.lng], [office.lat, office.lng]) : null;
  // The check-in zone around the office (and around a spot about to be saved), and the GPS accuracy
  const circles: MapCircle[] = [];
  if (office) circles.push({ id: 'zone', lat: office.lat, lng: office.lng, radiusM: Number(radiusM) || office.radiusM, color: '#2DA043' });
  if (picked) circles.push({ id: 'picked-zone', lat: picked.lat, lng: picked.lng, radiusM: Number(radiusM), color: '#2563EB', dashed: true });
  if (fix?.accuracy) circles.push({ id: 'accuracy', lat: fix.lat, lng: fix.lng, radiusM: fix.accuracy, color: '#2563EB', dashed: true });

  /** Saves a spot as the office, after saying how far that moves it. */
  const saveSpot = async (spot: { lat: number; lng: number }, how: string) => {
    const moves = office ? metres([spot.lat, spot.lng], [office.lat, office.lng]) : null;
    const ok = await confirmAction(
      'Move the office here?',
      `${how}${moves != null ? ` This moves the office ${distanceLabel(moves)} from where it is now.` : ''} Check-ins further than ${distanceLabel(Number(radiusM))} from this spot will be flagged.`,
      'Save office',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api('/attendance/office', { method: 'PUT', body: { lat: spot.lat, lng: spot.lng, radiusM: Number(radiusM), name: name.trim() || 'Office' } });
      toast.success('Office location saved', 'Check-ins and check-outs are now measured from here.');
      setPicked(null);
      refresh();
    } catch (e) {
      toast.error('Not saved', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const useMyLocation = async () => {
    if (!fix) return toast.warning('Waiting for GPS', 'Stand outside or near a window for a moment, then try again.');
    if ((fix.accuracy ?? 999) > 100) return toast.warning('GPS not accurate enough yet', `It is ±${Math.round(fix.accuracy ?? 0)} m. Wait a few seconds near a window and try again.`);
    await saveSpot(fix, 'Only do this while you are standing inside the office.');
  };

  /** Undo a wrong spot: back to the office address (Barber & Spa, Kahawa Station Rd, Kahawa West). */
  const reset = async () => {
    if (!(await confirmAction('Reset the office?', 'The office goes back to its address, Barber & Spa, Kahawa Station Road, Kahawa West.', 'Reset'))) return;
    setBusy(true);
    try {
      const r = await api<{ office: Office | null }>('/attendance/office', { method: 'DELETE' });
      toast.success('Office reset', r.office ? `${r.office.name}` : 'The address could not be found on the map. Tap the office on the map instead.');
      setPicked(null);
      refresh();
    } catch (e) {
      toast.error('Not reset', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        picked ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Cancel" variant="secondary" onPress={() => setPicked(null)} style={{ flex: 1 }} />
            <Button label="Save this spot" icon="checkmark" loading={busy} onPress={() => void saveSpot(picked, 'You tapped this spot on the map.')} style={{ flex: 1.5 }} />
          </View>
        ) : (
          <Button label="Use my current location" icon="locate" size="lg" variant="outline" loading={busy} disabled={!fix} onPress={() => void useMyLocation()} />
        )
      }
    >
      <ScreenHeader title="Office location" subtitle="Where staff check in and out" />
      <View style={styles.map}>
        <MapCanvas pins={pins} circles={circles} fitKey={`${office?.lat ?? ''}${office?.lng ?? ''}`} onMapPress={(at) => at && setPicked(at)} style={{ flex: 1 }} />
      </View>
      <Glass strong style={{ gap: 6 }}>
        {office ? (
          <>
            <Text variant="title">{office.name}</Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {office.lat.toFixed(5)}, {office.lng.toFixed(5)} · within {distanceLabel(office.radiusM)} counts as at the office
            </Text>
            <Text variant="label" color={colors.textMuted}>
              {SOURCE[office.source]}
            </Text>
          </>
        ) : (
          <Text variant="body" color={colors.warning}>
            The office location is not set yet, so check-ins cannot be checked against it.
          </Text>
        )}
        <Text variant="bodySm" color={gpsOff ? colors.danger : colors.textMuted}>
          {gpsOff ? 'Location is off on this phone. Allow location for this site.' : fix ? `Your GPS: ±${Math.round(fix.accuracy ?? 0)} m${away != null ? ` · ${distanceLabel(away)} from the saved office` : ''}` : 'Getting your GPS location…'}
        </Text>
      </Glass>
      <Input label="Office name" icon="business-outline" value={name} onChangeText={setName} />
      <Text variant="label" color={colors.textMuted}>
        Counts as at the office within
      </Text>
      <Segmented options={RADII} value={radiusM} onChange={setRadiusM} />
      <Text variant="bodySm" color={colors.textMuted}>
        Tap the office on the map to place it exactly, then Save this spot. Or stand inside the office and use your location.
      </Text>
      {office?.source === 'app' ? <Button label="Reset to the office address" icon="refresh" variant="secondary" loading={busy} onPress={() => void reset()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 260, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#E9ECEA', marginBottom: space.xs },
});
