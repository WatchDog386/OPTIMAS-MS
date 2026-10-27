import { Image, Pressable, StyleSheet, View, type ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authHeader, photoUrl } from '../api/client';
import { openPhoto } from '../store/photoViewer';
import { colors, radius } from '../theme';

/** Displays a protected proof photo (requests carry the bearer token). Tap to open it full screen with its details. */
export function AuthImage({ photoId, style, title, subtitle, flagged }: { photoId: string; style?: ImageStyle; title?: string; subtitle?: string; flagged?: boolean }) {
  const uri = photoUrl(photoId);
  return (
    <Pressable onPress={() => openPhoto(photoId, { title, subtitle })} style={({ pressed }) => [styles.frame, style, pressed && { opacity: 0.85 }]} accessibilityRole="imagebutton" accessibilityLabel={title ? `${title} photo, open full screen` : 'Photo, open full screen'}>
      {/* Demo photos are drawn locally (data: addresses): no server, so no token to send */}
      <Image source={{ uri, headers: uri.startsWith('data:') ? undefined : authHeader() }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
