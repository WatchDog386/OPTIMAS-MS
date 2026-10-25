import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '../src/components';
import { resolveScan } from '../src/store/bridge';
import { colors, fonts, radius, space } from '../src/theme';

/** Barcode / QR scanner for router & ONT serial numbers. Supports single or continuous (multi) scanning. */
export default function Scan() {
  const params = useLocalSearchParams<{ multiple?: string; title?: string }>();
  const multiple = !!params.multiple;
  const [permission, requestPermission] = useCameraPermissions();
  const [serials, setSerials] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const done = useRef(false);
  const lastScan = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  useEffect(() => () => {
    if (!done.current) resolveScan(null);
  }, []);

  const finish = (list: string[]) => {
    done.current = true;
    resolveScan(list);
    router.back();
  };

  const add = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    if (!multiple) return finish([value]);
    setSerials((s) => (s.includes(value) ? s : [value, ...s]));
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (data === lastScan.current.value && now - lastScan.current.at < 2500) return;
    lastScan.current = { value: data, at: now };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    add(data);
  };

  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Ionicons name="barcode-outline" size={48} color={colors.primary} />
        <Text variant="h2" align="center">
          Camera access needed to scan serials
        </Text>
        <Button label="Allow camera" icon="camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'qr', 'datamatrix'] }}
        onBarcodeScanned={onScanned}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.round} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <Text variant="title" color={colors.white}>
            {params.title || 'Scan serial number'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.window} />

        <View style={styles.sheet}>
          <View style={styles.manualRow}>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="Or type serial number"
              placeholderTextColor={colors.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.manualInput}
              onSubmitEditing={() => {
                add(manual);
                setManual('');
              }}
            />
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                add(manual);
                setManual('');
              }}
            >
              <Ionicons name="add" size={22} color={colors.onPrimary} />
            </Pressable>
          </View>
          {multiple ? (
            <>
              <Text variant="label" color={colors.textMuted}>
                {serials.length} scanned
              </Text>
              <View style={styles.chips}>
                {serials.slice(0, 12).map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => setSerials((l) => l.filter((x) => x !== s))}>
                    <Text variant="label">{s}</Text>
                    <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
              <Button label={`Done (${serials.length})`} icon="checkmark" onPress={() => finish(serials)} />
            </>
          ) : null}
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
  window: { alignSelf: 'center', width: '80%', height: 170, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.brand },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, gap: space.md },
  manualRow: { flexDirection: 'row', gap: space.sm },
  manualInput: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.lg, fontFamily: fonts.semibold, borderWidth: 1, borderColor: colors.border },
  addBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
});
