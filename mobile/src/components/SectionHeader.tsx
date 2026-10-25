import { Pressable, StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { Text } from './Text';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <Text variant="h2">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text variant="label" color={colors.primary}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
});
