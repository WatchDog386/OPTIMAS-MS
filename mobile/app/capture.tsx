import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../src/utils/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../src/api/client';
import type { CapturePurpose } from '../src/api/types';
import { Button, Text } from '../src/components';
import { resolveCapture, type CaptureResult } from '../src/store/bridge';
import { colors, fonts, radius, space } from '../src/theme';
import { useStatusBarColor } from '../src/utils/statusBar';
import { appendFile, grabCameraFrame, photoFromPhoneCamera } from '../src/utils/upload';

/**
 * Camera-only proof capture. There is deliberately NO gallery picker in this app:
 * every photo is taken live, bound to a single-use server challenge, geotagged and hashed server-side.
 */
const copy: Record<CapturePurpose, { title: string; hint: string; facing: 'front' | 'back' }> = {
  CHECK_IN: { title: 'Morning check-in', hint: 'Full upper body in frame — uniform and staff ID clearly visible', facing: 'front' },
  CHECK_OUT: { title: 'Evening check-out', hint: 'Face and uniform clearly visible', facing: 'front' },
  TASK_START: { title: 'Job start photo', hint: 'Show the site / equipment before you begin work', facing: 'back' },
  TASK_END: { title: 'Job completion photo', hint: 'Show the finished installation — router, cabling and labels', facing: 'back' },
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
  const location = useRef<Location.LocationObject | null>(null);

  // Start acquiring a GPS fix as soon as the camera opens.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        location.current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      }
    })();
    return () => {
      if (!done.current) resolveCapture(null);
    };
  }, []);

  /** `given`: a photo already taken with the phone's own camera app; otherwise the live camera here. */
  const shoot = async (given?: { blob: Blob; uri: string; dataUri: () => string | Promise<string> }) => {
    if ((!given && !camera.current) || busy) return;
    setError(null);
    setBusy(true);
    try {
      // 1. Ask the server for a fresh single-use challenge. With no signal there is no challenge:
      //    the photo is still taken live in this camera and kept on the phone to be sent later.
      let challenge: { challengeId: string; nonce: string } | null = null;
      try {
        challenge = await api<{ challengeId: string; nonce: string }>('/capture/challenge', {
          body: { purpose, taskId: params.taskId || undefined },
        });
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'NETWORK')) throw e;
      }
      // 2. Take the photo live.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      // Web: the frame straight from the live picture as a JPEG file; phones: the camera's own photo
      const frame = given ?? (await grabCameraFrame());
      const photo = frame ? { uri: frame.uri } : await camera.current!.takePictureAsync({ quality: 0.6, exif: false, shutterSound: false, imageType: 'jpg' });
      setPreview(photo.uri);
      // 3. Upload with location + device metadata.
      const loc = location.current ?? (await Location.getLastKnownPositionAsync().catch(() => null));
      if (!challenge) {
        done.current = true;
        resolveCapture({
          photoId: '',
          // Kept on the phone until there is signal again, so it must be a lasting copy
          uri: frame ? await frame.dataUri() : photo.uri,
          flags: ['OFFLINE_CAPTURE'],
          pending: {
            capturedAt: new Date().toISOString(),
            lat: loc?.coords.latitude,
            lng: loc?.coords.longitude,
            accuracyM: loc?.coords.accuracy ?? undefined,
            deviceId: await deviceId(),
          },
        } satisfies CaptureResult);
        goBack();
        return;
      }
      const form = new FormData();
      if (frame) form.append('photo', frame.blob, 'capture.jpg');
      else await appendFile(form, 'photo', photo.uri, 'capture.jpg', 'image/jpeg');
      form.append('challengeId', challenge.challengeId);
      form.append('nonce', challenge.nonce);
      form.append('deviceTime', new Date().toISOString());
      if (loc) {
        form.append('lat', String(loc.coords.latitude));
        form.append('lng', String(loc.coords.longitude));
        if (loc.coords.accuracy != null) form.append('accuracyM', String(loc.coords.accuracy));
      }
      const id = await deviceId();
      if (id) form.append('deviceId', id);
      const result = await api<{ photoId: string; flags: string[] }>('/capture/upload', { body: form });
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
            {busy ? 'Verifying photo…' : 'Time, GPS and device are recorded with this photo'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
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
