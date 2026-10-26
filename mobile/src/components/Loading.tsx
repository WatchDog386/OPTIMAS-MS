import { View } from 'react-native';
import { GlassBackground } from './Glass';
import { BarsLoader } from './Loaders';

/** Full-screen placeholder while a screen's first data loads. */
export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <GlassBackground />
      <BarsLoader />
    </View>
  );
}
