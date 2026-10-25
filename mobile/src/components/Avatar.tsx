import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { initials } from '../utils/format';
import { Text } from './Text';

export function Avatar({ name, size = 44, tint = colors.primary }: { name: string; size?: number; tint?: string }) {
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}26`, borderColor: `${tint}55` }]}>
      <Text variant="title" color={tint} style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 } });
