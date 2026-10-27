import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { Text } from '../Text';
import type { MapCanvasProps } from './types';

/** The interactive map runs in the web app (see MapCanvas.web.tsx); native builds show a placeholder. */
export function MapCanvas({ style }: MapCanvasProps) {
  return (
    <View style={[styles.box, style]}>
      <Ionicons name="map-outline" size={32} color={colors.textDim} />
      <Text variant="bodySm" color={colors.textMuted} align="center">
        The live map is available in the Optimas web app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceAlt, padding: 24 },
});
