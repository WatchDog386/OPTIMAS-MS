import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, EmptyState, PageHeader, QrCode, Screen, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, fonts } from '../../src/theme';

/** data-* attributes on the web (react-native-web's dataSet), for the print stylesheet. */
const web = (data: Record<string, string>) => ({ dataSet: data }) as object;

/** What the label's QR code holds: a link to "Check a device" for this code, on this app's address. */
const labelLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://ms.optimaswifi.co.ke'}/verify?c=${encodeURIComponent(code)}`;

interface Label {
  serial: string;
  mac: string | null;
  item: string;
  sku: string;
  code: string;
}

/**
 * Printable Optimas labels: a signed QR code per device with its name, serial and MAC. Stick one on each
 * device (and its box) when it is received; scanning it anywhere proves it is the device Optimas
 * registered and shows who it was issued to.
 */
export default function Labels() {
  const { serials, itemId } = useLocalSearchParams<{ serials?: string; itemId?: string }>();
  const q = serials ? `serials=${encodeURIComponent(serials)}` : itemId ? `itemId=${encodeURIComponent(itemId)}` : '';
  const { data, loading } = useApi<{ labels: Label[] }>(q ? `/inventory/labels?${q}` : null);
  const labels = data?.labels ?? [];

  // When printing, only the labels go on the paper
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = '@media print { [data-noprint] { display: none !important; } body { background: #fff !important; } [data-label] { break-inside: avoid; } }';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <Screen>
      <View {...web({ noprint: '1' })} style={{ gap: 12 }}>
        <PageHeader title="Device labels" right={null} />
        <Text variant="bodySm" color={colors.textMuted}>
          Print on sticker paper and stick one on each device, matching the serial number. Scanning a label proves it is ours and shows who it was issued to. A copied or changed label shows as fake.
        </Text>
        {labels.length ? <Button label={`Print ${labels.length} label${labels.length === 1 ? '' : 's'}`} icon="print-outline" onPress={() => Platform.OS === 'web' && window.print()} /> : null}
      </View>
      {!loading && !labels.length ? <EmptyState icon="pricetags-outline" title="No devices to label" message="Receive devices first, or open labels from an item that has units in the store." /> : null}
      <View style={styles.sheet}>
        {labels.map((l) => (
          <View key={l.serial} style={styles.label} {...web({ label: '1' })}>
            {/* A link, so any phone's own camera / QR scanner opens Optimas on this device's check */}
            <QrCode value={labelLink(l.code)} size={110} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" style={styles.brand}>
                OPTIMAS NETWORKS
              </Text>
              <Text variant="label" numberOfLines={2} style={{ fontFamily: fonts.semibold, color: '#000' }}>
                {l.item}
              </Text>
              <Text variant="label" style={styles.mono}>
                S/N {l.serial}
              </Text>
              {l.mac ? (
                <Text variant="label" style={styles.mono}>
                  MAC {l.mac}
                </Text>
              ) : null}
              <Text variant="label" style={{ fontSize: 9, color: '#444' }}>
                Property of Optimas · scan to check
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  label: { width: 300, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  brand: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1, color: '#000' },
  mono: { fontFamily: fonts.semibold, fontSize: 11, color: '#000', letterSpacing: 0.3 },
});
