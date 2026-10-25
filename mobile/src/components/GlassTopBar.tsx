import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { GlassCircle } from './Glass';
import { NotificationBell } from './NotificationBell';

/** Row of round frosted buttons above the profile hero. */
export function GlassTopBar({ profileHref, calendarHref }: { profileHref: '/profile' | '/more'; calendarHref: string }) {
  return (
    <View style={styles.row}>
      <GlassCircle onPress={() => router.push(profileHref)} label="Profile">
        <Ionicons name="person-outline" size={20} color={colors.text} />
      </GlassCircle>
      <View style={{ flex: 1 }} />
      <NotificationBell />
      <GlassCircle onPress={() => router.push(calendarHref as never)} label="Attendance">
        <Ionicons name="calendar-outline" size={20} color={colors.text} />
      </GlassCircle>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 } });
