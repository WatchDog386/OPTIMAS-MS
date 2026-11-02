import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api/client';
import { Button, Glass, Input, Loading, MapCanvas, Screen, ScreenHeader, Segmented, Text, type MapPin } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { toast } from '../../src/store/feedback';
import { colors, radius, space } from '../../src/theme';
import { distanceLabel, metres, watchFix, type Fix } from '../../src/utils/location';

type Office = { lat: number; lng: number; radiusM: number; name: string; source: 'app' | 'settings' | 'address' };
const RADII = [
  { value: '150', label: '150 m' },
  { value: '300', label: '300 m' },
  { value: '500', label: '500 m' },
  { value: '1000', label: '1 km' },
];
const SOURCE: Record<Office['source'], string> = { app: 'Set from a phone at the office', settings: 'From the server settings', address: 'Found from the address on the map' };

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
  const away = office && fix ? metres([fix.lat, fix.lng], [office.lat, office.lng]) : null;

  const save = async () => {
    if (!fix) return toast.warning('Waiting for GPS', 'Stand outside or near a window for a moment, then try again.');
    if ((fix.accuracy ?? 999) > 100) return toast.warning('GPS not accurate enough yet', `It is ±${Math.round(fix.accuracy ?? 0)} m. Wait a few seconds near a window and try again.`);
    setBusy(true);
    try {
      await api('/attendance/office', { method: 'PUT', body: { lat: fix.lat, lng: fix.lng, radiusM: Number(radiusM), name: name.trim() || 'Office' } });
      toast.success('Office location saved', 'Check-ins and check-outs are now measured from here.');
      refresh();
    } catch (e) {
      toast.error('Not saved', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Use my current location" icon="locate" size="lg" loading={busy} disabled={!fix} onPress={save} />}>
      <ScreenHeader title="Office location" subtitle="Where staff check in and out" />
      <View style={styles.map}>
        {pins.length ? <MapCanvas pins={pins} fitKey={`${pins.length}`} style={{ flex: 1 }} /> : null}
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
        Stand inside the office and tap “Use my current location”. Your phone’s GPS becomes the office.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { height: 260, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#E9ECEA', marginBottom: space.xs },
});
