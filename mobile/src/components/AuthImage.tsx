import { Image, StyleSheet, View, type ImageStyle } from 'react-native';
import { authHeader, photoUrl } from '../api/client';
import { colors, radius } from '../theme';

/** Displays a protected proof photo (requests carry the bearer token). */
export function AuthImage({ photoId, style }: { photoId: string; style?: ImageStyle }) {
  const uri = photoUrl(photoId);
  return (
    <View style={[styles.frame, style]}>
      {/* Demo photos are drawn locally (data: addresses): no server, so no token to send */}
      <Image source={{ uri, headers: uri.startsWith('data:') ? undefined : authHeader() }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceHigh, borderRadius: radius.md, overflow: 'hidden', aspectRatio: 3 / 4 },
});
