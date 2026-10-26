import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { GlassCircle } from './Glass';
import { NotificationBell } from './NotificationBell';
import { InstallButton } from './InstallPrompt';

/** Row of round frosted buttons above the profile hero. */
export function GlassTopBar({ profileHref, calendarHref, calendarIcon = 'calendar-outline' }: { profileHref: string; calendarHref: string; calendarIcon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.row}>
      <GlassCircle onPress={() => router.push(profileHref as never)} label="Profile">
        <Ionicons name="person-outline" size={20} color={colors.text} />
      </GlassCircle>
      <View style={{ flex: 1 }} />
      <InstallButton />
      <NotificationBell />
      <GlassCircle onPress={() => router.push(calendarHref as never)} label="Attendance">
        <Ionicons name={calendarIcon} size={20} color={colors.text} />
      </GlassCircle>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 } });
