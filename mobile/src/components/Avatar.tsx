import { StyleSheet, View } from 'react-native';
import { colors, useInverse } from '../theme';
import { initials } from '../utils/format';
import { Text } from './Text';

export function Avatar({ name, size = 44, tint: tintProp = colors.primary }: { name: string; size?: number; tint?: string }) {
  const inverse = useInverse();
  const tint = inverse && tintProp === colors.primary ? colors.onHero : tintProp;
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}1F`, borderColor: `${tint}40` }]}>
      <Text variant="title" color={tint} style={{ fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 } });
