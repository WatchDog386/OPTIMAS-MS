import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, authHeader, photoUrl } from '../api/client';
import type { PhotoInfo } from '../api/approvals';
import { closePhoto, usePhotoViewer } from '../store/photoViewer';
import { colors, fonts, radius } from '../theme';
import { dateTime, flagLabel, humanize } from '../utils/format';
import { NATIVE, haptic, spring } from '../utils/motion';
import { Text } from './Text';

/**
 * Full-screen proof photo: tap the picture to zoom, and below it everything the photo proves —
 * who took it, when (phone time and when the server got it), where (with a map), how accurate, any warnings,
 * and what it was used for.
 */
export function PhotoViewerHost() {
  const open = usePhotoViewer((s) => s.open);
  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={closePhoto} statusBarTranslucent>
      {open ? <Viewer key={open.id} id={open.id} title={open.title} subtitle={open.subtitle} /> : null}
    </Modal>
  );
}

function Viewer({ id, title, subtitle }: { id: string; title?: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<PhotoInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const zoom = useRef(new Animated.Value(1)).current;
  const uri = photoUrl(id);

  useEffect(() => {
    api<{ photo: PhotoInfo }>(`/capture/photos/${id}/info`)
      .then((r) => setInfo(r.photo))
      .catch(() => setFailed(true));
  }, [id]);

  const toggleZoom = () => {
    haptic.tap();
    setZoomed((z) => !z);
    Animated.spring(zoom, { toValue: zoomed ? 1 : 2.2, ...spring.settle, useNativeDriver: NATIVE }).start();
  };

  const mapUrl = info?.lat != null && info?.lng != null ? `https://www.google.com/maps/search/?api=1&query=${info.lat},${info.lng}` : null;
  const taken = info?.deviceTime ?? info?.receivedAt;
  const late = info?.deviceTime && info.receivedAt && Math.abs(new Date(info.receivedAt).getTime() - new Date(info.deviceTime).getTime()) > 5 * 60_000;

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={closePhoto} hitSlop={10} style={styles.round} accessibilityRole="button" accessibilityLabel="Close photo">
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="title" color="#FFFFFF" fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
            {title ?? (info ? humanize(info.purpose) : 'Photo')}
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.7)" fixedColor numberOfLines={1}>
            {subtitle ?? (info ? `${info.user.name} · ${dateTime(taken)}` : ' ')}
          </Text>
        </View>
        <Pressable onPress={toggleZoom} hitSlop={10} style={styles.round} accessibilityRole="button" accessibilityLabel={zoomed ? 'Zoom out' : 'Zoom in'}>
          <Ionicons name={zoomed ? 'contract-outline' : 'expand-outline'} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <Pressable onPress={toggleZoom} style={styles.stage} accessibilityLabel="Photo, tap to zoom">
        <Animated.View style={{ width: '100%', height: '100%', transform: [{ scale: zoom }] }}>
          <Image source={{ uri, headers: uri.startsWith('data:') ? undefined : authHeader() }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        </Animated.View>
      </Pressable>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 18, gap: 12 }}>
        {!info && !failed ? <ActivityIndicator color={colors.navy} /> : null}
        {failed ? (
          <Text variant="bodySm" color={colors.textMuted}>
            Details for this photo are not available.
          </Text>
        ) : null}
        {info ? (
          <>
            {info.flags.length ? (
              <View style={styles.flags}>
                {info.flags.map((f) => (
                  <View key={f} style={styles.flag}>
                    <Ionicons name="warning" size={13} color={colors.warning} />
                    <Text variant="label" style={{ fontFamily: fonts.semibold }} color={colors.warning}>
                      {flagLabel[f] ?? humanize(f)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.flag, { backgroundColor: colors.successSoft, alignSelf: 'flex-start' }]}>
                <Ionicons name="shield-checkmark" size={13} color={colors.success} />
                <Text variant="label" style={{ fontFamily: fonts.semibold }} color={colors.success}>
                  No warnings
                </Text>
              </View>
            )}
            <Row icon="person-outline" label="Taken by" value={`${info.user.name} · ${info.user.staffNo}`} />
            <Row icon="time-outline" label="Taken at" value={dateTime(taken)} />
            {late ? <Row icon="cloud-upload-outline" label="Reached the server" value={dateTime(info.receivedAt)} /> : null}
            <Row
              icon="location-outline"
              label="Location"
              value={info.lat != null && info.lng != null ? `${info.lat.toFixed(5)}, ${info.lng.toFixed(5)}${info.accuracyM != null ? ` · ±${Math.round(info.accuracyM)} m` : ''}` : 'No GPS on this photo'}
              action={mapUrl ? { label: 'Map', onPress: () => void Linking.openURL(mapUrl) } : undefined}
            />
            {info.usedFor?.kind === 'TASK' ? (
              <Row
                icon="briefcase-outline"
                label="Job"
                value={`${info.usedFor.code} · ${info.usedFor.title}`}
                action={{
                  label: 'Open',
                  onPress: () => {
                    const taskId = (info.usedFor as { id: string }).id;
                    closePhoto();
                    router.push(`/task/${taskId}`);
                  },
                }}
              />
            ) : null}
            {info.deviceId ? <Row icon="phone-portrait-outline" label="Phone" value={info.deviceId.slice(0, 18)} /> : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, action }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={17} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" color={colors.textMuted}>
          {label}
        </Text>
        <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
          {value}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} style={styles.rowAction} accessibilityRole="button">
          <Text variant="label" color={colors.onPrimary} fixedColor style={{ fontFamily: fonts.semibold }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050607' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10, zIndex: 2 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, overflow: 'hidden' },
  sheet: { maxHeight: '42%', backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.warningSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  rowAction: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
});
