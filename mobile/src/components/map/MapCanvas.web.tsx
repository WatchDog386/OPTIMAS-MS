import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../../theme';
import type { MapCanvasProps } from './types';

// The map library (Leaflet) is downloaded only when a page actually shows a map, not with the rest of the app
const LeafletMap = lazy(() => import('./LeafletMap.web'));

/** Interactive street map for the web app; see LeafletMap.web.tsx. */
export function MapCanvas(props: MapCanvasProps) {
  return (
    <Suspense
      fallback={
        <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, props.style]}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      }
    >
      <LeafletMap {...props} />
    </Suspense>
  );
}
