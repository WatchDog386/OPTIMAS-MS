import { Image, Pressable, StyleSheet, View, type ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openPhoto } from '../store/photoViewer';
import { colors, radius } from '../theme';
import { useAuthPhotoUri } from '../hooks/useAuthPhotoUri';

/** Displays a protected proof photo (requests carry the bearer token). Tap to open it full screen with its details. */
export function AuthImage({ photoId, style, title, subtitle, flagged }: { photoId: string | null | undefined; style?: ImageStyle; title?: string; subtitle?: string; flagged?: boolean }) {
  const src = useAuthPhotoUri(photoId);
  return (
    <Pressable onPress={() => photoId && openPhoto(photoId, { title, subtitle })} style={({ pressed }) => [styles.frame, style, pressed && { opacity: 0.85 }]} accessibilityRole="imagebutton" accessibilityLabel={title ? `${title} photo, open full screen` : 'Photo, open full screen'}>
      <Image source={src} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.expand}>
        <Ionicons name={flagged ? 'warning' : 'expand-outline'} size={14} color={flagged ? colors.warning : '#FFFFFF'} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, overflow: 'hidden', aspectRatio: 3 / 4 },
  expand: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
