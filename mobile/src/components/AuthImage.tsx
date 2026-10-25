import { Image, StyleSheet, View, type ImageStyle } from 'react-native';
import { authHeader, photoUrl } from '../api/client';
import { colors, radius } from '../theme';

/** Displays a protected proof photo (requests carry the bearer token). */
export function AuthImage({ photoId, style }: { photoId: string; style?: ImageStyle }) {
  return (
    <View style={[styles.frame, style]}>
      <Image source={{ uri: photoUrl(photoId), headers: authHeader() }} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, overflow: 'hidden', aspectRatio: 3 / 4 },
});
