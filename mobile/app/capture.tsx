import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../src/utils/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../src/api/client';
import { keepPhoto, phoneOffline } from '../src/offline/outbox';
import type { CapturePurpose } from '../src/api/types';
import { Button, Text } from '../src/components';
import { resolveCapture, type CaptureResult } from '../src/store/bridge';
import { colors, fonts, radius, space } from '../src/theme';
import { useStatusBarColor } from '../src/utils/statusBar';
import { appendFile, grabCameraFrame, photoFromPhoneCamera } from '../src/utils/upload';
import { distanceLabel, metres, watchFix, type Fix } from '../src/utils/location';
import { PRECISE_ENOUGH_M } from '../src/components/OfficeCheck';
import { useApi } from '../src/hooks/useApi';

/**
 * Camera-only proof capture. There is deliberately NO gallery picker in this app:
 * every photo is taken live, bound to a single-use server challenge, geotagged and hashed server-side.
 */
const copy: Record<CapturePurpose, { title: string; hint: string; facing: 'front' | 'back' }> = {
  CHECK_IN: { title: 'Morning check-in', hint: 'Full upper body in frame — uniform and staff ID clearly visible', facing: 'front' },
  CHECK_OUT: { title: 'Evening check-out', hint: 'Face and uniform clearly visible', facing: 'front' },
  TASK_START: { title: 'Task start photo', hint: 'Show the site / equipment before you begin work', facing: 'back' },
  TASK_END: { title: 'Task completion photo', hint: 'Show the finished installation — router, cabling and labels', facing: 'back' },
  ROUTER_LABEL: { title: "Customer's router label", hint: 'The sticker under the router: brand, model, SN and MAC readable', facing: 'back' },
};

async function deviceId() {
  try {
    if (Platform.OS === 'android') return Application.getAndroidId();
    if (Platform.OS === 'ios') return (await Application.getIosIdForVendorAsync()) ?? undefined;
  } catch {
    /* not available */
  }
  return undefined;
}

export default function Capture() {
  useStatusBarColor('#000000'); // camera pages are black edge to edge
  const params = useLocalSearchParams<{ purpose: CapturePurpose; taskId?: string; title?: string }>();
  const purpose = params.purpose ?? 'CHECK_IN';
  const meta = copy[purpose];
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState(meta.facing);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const done = useRef(false);
  const location = useRef<Fix | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsOff, setGpsOff] = useState(false);
  const [gpsWait, setGpsWait] = useState(false);
  // Check-in and check-out are checked against the office
  const atOffice = purpose === 'CHECK_IN' || purpose === 'CHECK_OUT';
  const office = useApi<{ office: { lat: number; lng: number; radiusM: number; name: string } | null }>(atOffice ? '/attendance/office' : null);

  // Follow the GPS for as long as the camera is open, so the photo carries a fresh, accurate position
  // (straight from the browser on the web, where the older one-off reading often came back empty)
  useEffect(() => {
    let stop = () => {};
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return setGpsOff(true);
      }
      stop = watchFix(
        (f) => {
          location.current = f;
          setFix(f);
          setGpsOff(false);
        },
        () => setGpsOff(true),
      );
    })();
    return () => {
      stop();
      if (!done.current) resolveCapture(null);
    };
  }, []);

  /**
   * Waits a few seconds for a GPS fix (the shutter is often pressed before it arrives). For check-in and
   * check-out it also waits for a precise one: a phone's first reading often comes from Wi-Fi or the mobile
   * network and can be hundreds of metres out, which would wrongly place someone at (or away from) the office.
   */
  const precise = (f: Fix | null) => !!f && f.accuracy != null && f.accuracy <= PRECISE_ENOUGH_M;
  const waitForFix = async (ms = 10_000) => {
    const until = Date.now() + ms;
    while (!gpsOff && Date.now() < until && (atOffice ? !precise(location.current) : !location.current)) await new Promise((r) => setTimeout(r, 250));
    return location.current;
  };

  /** `given`: a photo already taken with the phone's own camera app; otherwise the live camera here. */
  const shoot = async (given?: { blob: Blob; uri: string; dataUri: () => string | Promise<string> }) => {
    if ((!given && !camera.current) || busy) return;
    setError(null);
    setBusy(true);
    try {
      // 1. Ask the server for a fresh single-use challenge. With no signal the photo is still taken, and
      //    kept on the phone (with when and where it was taken) until it can be sent (see offline/outbox.ts)
      let challenge: { challengeId: string; nonce: string } | null = null;
      if (!phoneOffline()) {
        try {
          challenge = await api<{ challengeId: string; nonce: string }>('/capture/challenge', {
            body: { purpose, taskId: params.taskId || undefined },
          });
        } catch (e) {
          if (!(e instanceof ApiError && e.code === 'NETWORK')) throw e;
        }
      }
      const takenAt = new Date().toISOString();
      // 2. Take the photo live.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      // Web: the frame straight from the live picture as a JPEG file; phones: the camera's own photo
      const frame = given ?? (await grabCameraFrame());
      const photo = frame ? { uri: frame.uri } : await camera.current!.takePictureAsync({ quality: 0.6, exif: false, shutterSound: false, imageType: 'jpg' });
      setPreview(photo.uri);
      // 3. Upload with location + device metadata (waiting a moment for the GPS if it is not ready yet)
      const ready = atOffice ? precise(location.current) : !!location.current;
      if (!ready) setGpsWait(true);
      const loc = ready ? location.current : await waitForFix(atOffice ? 12_000 : 10_000);
      setGpsWait(false);
      const id = await deviceId();
      const keepOffline = async () => {
        const ref = await keepPhoto(
          { uri: frame ? await frame.dataUri() : photo.uri, purpose, taskId: params.taskId || undefined, capturedAt: takenAt, lat: loc?.lat, lng: loc?.lng, accuracyM: loc?.accuracy ?? undefined, deviceId: id },
          `${meta.title} (taken offline)`,
        );
        done.current = true;
        resolveCapture({ photoId: ref, uri: photo.uri, flags: ['OFFLINE_CAPTURE'], offline: true } satisfies CaptureResult);
        goBack();
      };
      if (!challenge) return void (await keepOffline());
      const form = new FormData();
      if (frame) form.append('photo', frame.blob, 'capture.jpg');
      else await appendFile(form, 'photo', photo.uri, 'capture.jpg', 'image/jpeg');
      form.append('challengeId', challenge.challengeId);
      form.append('nonce', challenge.nonce);
      form.append('deviceTime', takenAt);
      if (loc) {
        form.append('lat', String(loc.lat));
        form.append('lng', String(loc.lng));
        if (loc.accuracy != null) form.append('accuracyM', String(loc.accuracy));
      }
      if (id) form.append('deviceId', id);
      let result: { photoId: string; flags: string[] };
      try {
        result = await api<{ photoId: string; flags: string[] }>('/capture/upload', { body: form });
      } catch (e) {
        // The signal dropped while sending: keep it on the phone instead
        if (e instanceof ApiError && e.code === 'NETWORK') return void (await keepOffline());
        throw e;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      done.current = true;
      resolveCapture({ photoId: result.photoId, uri: photo.uri, flags: result.flags } satisfies CaptureResult);
      goBack();
    } catch (e) {
      setPreview(null);
      // Say what went wrong, so it can be put right
      const why = e instanceof Error && e.message ? ` (${e.message.slice(0, 120)})` : '';
      setError(e instanceof ApiError ? e.message : `Could not take the photo${why}. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  // The phone's own camera app (sharper, works on every phone); the photo must be taken now
  const phoneCamera = async () => {
    setError(null);
    try {
      const p = await photoFromPhoneCamera(facing);
      if (p) await shoot(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the camera');
    }
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Ionicons name="camera-outline" size={48} color={colors.primary} />
        <Text variant="h2" align="center">
          Camera access needed
        </Text>
        <Text variant="body" color={colors.textMuted} align="center">
          Proof photos must be taken live with the in-app camera. Uploading from the gallery is not allowed.
        </Text>
        <Button label="Allow camera" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {preview ? (
        <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} />
      ) : (
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing={facing} animateShutter />
      )}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.round} accessibilityLabel="Close camera">
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text variant="label" color={colors.white}>
              LIVE CAMERA
            </Text>
          </View>
          <Pressable
            onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
            style={styles.round}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={24} color={colors.white} />
          </Pressable>
        </View>

        <View style={[styles.frame, facing === 'front' && styles.frameSelfie]} />

        <View style={styles.bottom}>
          <View style={styles.hintCard}>
            <Text variant="title">{params.title || meta.title}</Text>
            <Text variant="bodySm" color={colors.textMuted}>
              {meta.hint}
            </Text>
            {error ? (
              <Text variant="bodySm" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <GpsLine fix={fix} off={gpsOff} office={atOffice ? (office.data?.office ?? null) : undefined} />
          </View>
          <Pressable onPress={() => void shoot()} disabled={busy} style={styles.shutterOuter} accessibilityLabel="Take photo">
            <View style={styles.shutterInner}>{busy ? <ActivityIndicator color={colors.onBrand} /> : null}</View>
          </Pressable>
          {Platform.OS === 'web' ? (
            <Pressable onPress={phoneCamera} disabled={busy} style={({ pressed }) => [styles.phoneCam, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Use phone camera">
              <Ionicons name="camera-outline" size={18} color={colors.white} />
              <Text variant="bodySm" color={colors.white} fixedColor style={{ fontFamily: fonts.semibold }}>
                Use phone camera
              </Text>
            </Pressable>
          ) : null}
          <Text variant="label" color={colors.white} align="center">
            {gpsWait ? 'Getting your GPS location…' : busy ? 'Verifying photo…' : 'Time, GPS and device are recorded with this photo'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** GPS status under the photo hint: accuracy, and for check-in/out how far the office is. */
function GpsLine({ fix, off, office }: { fix: Fix | null; off: boolean; office?: { lat: number; lng: number; radiusM: number; name: string } | null }) {
  if (off) {
    return (
      <View style={styles.gps}>
        <Ionicons name="location-outline" size={15} color={colors.danger} />
        <Text variant="label" color={colors.danger} style={{ flex: 1 }}>
          Location is off. Allow location for this site so your {office !== undefined ? 'check-in shows you are at the office' : 'photo has its GPS'}.
        </Text>
      </View>
    );
  }
  if (!fix) {
    return (
      <View style={styles.gps}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text variant="label" color={colors.textMuted}>
          Getting your GPS location…
        </Text>
      </View>
    );
  }
  const away = office ? metres([fix.lat, fix.lng], [office.lat, office.lng]) : null;
  const rough = fix.accuracy == null || fix.accuracy > PRECISE_ENOUGH_M;
  // A coloured status chip: green at the office, red away, amber while the reading is still rough
  const state = office === undefined ? (rough ? 'wait' : 'ok') : !office ? 'info' : away! > office.radiusM && !(rough && away! - (fix.accuracy ?? 0) <= office.radiusM) ? 'bad' : rough && (fix.accuracy ?? Infinity) > office.radiusM ? 'wait' : 'ok';
  const tone = { ok: '#2DA043', bad: '#DC2626', wait: '#D97706', info: colors.textMuted }[state];
  const title =
    office === undefined
      ? `GPS ±${distanceLabel(fix.accuracy ?? 0)}`
      : !office
        ? 'Office location not set yet'
        : state === 'ok'
          ? 'At the office'
          : state === 'bad'
            ? `${distanceLabel(away!)} from the office`
            : 'Finding your exact position…';
  return (
    <View style={[styles.gpsChip, { borderColor: tone, backgroundColor: `${tone}14` }]}>
      <Ionicons name={state === 'ok' ? 'checkmark-circle' : state === 'bad' ? 'alert-circle' : 'locate'} size={18} color={tone} />
      <View style={{ flex: 1 }}>
        <Text variant="label" color={tone} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 13 }}>
          {title}
        </Text>
        <Text variant="label" color={colors.textMuted} style={{ fontSize: 11 }}>
          GPS ±{distanceLabel(fix.accuracy ?? 0)}
          {office && away != null ? ` · ${distanceLabel(away)} to the office pin` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gps: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  gpsChip: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.lg, backgroundColor: colors.bg },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.sm },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.scrim, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  phoneCam: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  frame: { alignSelf: 'center', width: '78%', aspectRatio: 3 / 4, borderRadius: radius.xl, borderWidth: 2, borderColor: 'rgba(184,245,59,0.7)' },
  frameSelfie: { borderRadius: 999, width: '70%', aspectRatio: 0.8 },
  bottom: { padding: space.xl, gap: space.lg, alignItems: 'center' },
  hintCard: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 4 },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
