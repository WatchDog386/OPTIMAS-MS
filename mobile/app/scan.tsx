import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../src/utils/nav';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '../src/components';
import { resolveScan } from '../src/store/bridge';
import { colors, fonts, radius, space } from '../src/theme';
import { useStatusBarColor } from '../src/utils/statusBar';

/**
 * Every barcode a product or device can carry: shop barcodes (EAN/UPC), shipping and carton codes,
 * the serial-number labels on routers and ONTs, and QR / Data Matrix stickers.
 */
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'pdf417', 'aztec'];

/** Browsers without a built-in barcode reader use a small decoder; serve it from our own server, not a CDN. */
let decoderReady: Promise<void> | null = null;
function useLocalDecoder() {
  if (Platform.OS !== 'web') return;
  decoderReady ??= import('barcode-detector')
    .then(({ setZXingModuleOverrides }) => {
      setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? '/zxing_reader.wasm' : prefix + path) });
    })
    .catch(() => undefined);
}
useLocalDecoder();

/** An Optimas label reads as "OPTIMAS:<serial>:<signature>": show the serial (the server checks the rest). */
const shown = (code: string) => (code.startsWith('OPTIMAS:') ? `🏷 ${code.slice(8, code.lastIndexOf(':'))}` : code);

/** Barcode / QR scanner for products and for router & ONT serial numbers. Supports single or continuous (multi) scanning. */
export default function Scan() {
  useStatusBarColor('#000000'); // camera pages are black edge to edge
  const params = useLocalSearchParams<{ multiple?: string; title?: string }>();
  const multiple = !!params.multiple;
  const [permission, requestPermission] = useCameraPermissions();
  const [serials, setSerials] = useState<string[]>([]);
  const [manual, setManual] = useState('');
  const [torch, setTorch] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const done = useRef(false);
  const lastScan = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  useEffect(() => () => {
    if (!done.current) resolveScan(null);
  }, []);

  const finish = (list: string[]) => {
    done.current = true;
    resolveScan(list);
    goBack();
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
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={onScanned}
        onMountError={({ message }) => setCameraError(message || 'The camera could not start.')}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.round} accessibilityLabel="Close scanner">
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <Text variant="title" color={colors.white}>
            {params.title || 'Scan serial number'}
          </Text>
          {Platform.OS === 'web' ? (
            <View style={{ width: 44 }} />
          ) : (
            <Pressable onPress={() => setTorch((t) => !t)} style={styles.round} accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}>
              <Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color={colors.white} />
            </Pressable>
          )}
        </View>

        <View style={styles.windowWrap}>
          <View style={styles.window} />
          <Text variant="label" color={colors.white} align="center" style={styles.windowHint}>
            {cameraError ?? 'Hold the barcode inside the frame'}
          </Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.manualRow}>
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="Or type the number"
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
                    <Text variant="label">{shown(s)}</Text>
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
  windowWrap: { alignItems: 'center', gap: space.md },
  window: { alignSelf: 'center', width: '84%', height: 190, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.brand },
  windowHint: { backgroundColor: colors.scrim, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, gap: space.md },
  manualRow: { flexDirection: 'row', gap: space.sm },
  manualInput: { flex: 1, height: 50, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: space.lg, fontFamily: fonts.semibold, borderWidth: 1, borderColor: colors.border },
  addBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
});
