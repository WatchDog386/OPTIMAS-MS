import { Pressable, StyleSheet } from 'react-native';
import { fonts } from '../theme';
import { SME } from './SmeKit';
import { Text } from './Text';

/** "Show earlier jobs (N)": older jobs, kept out of the today-only list until asked for. */
export function EarlierJobs({ count, onPress }: { count: number; onPress: () => void }) {
  if (!count) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.link}>
      <Text variant="label" color={SME.fg3} fixedColor style={{ fontFamily: fonts.medium, fontSize: 13 }}>
        Show earlier jobs ({count})
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ link: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, backgroundColor: SME.surface } });
