import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { TeamMember } from '../api/types';
import { useApi } from '../hooks/useApi';
import { colors, radius, space } from '../theme';
import { firstName } from '../utils/format';
import { Avatar } from './Avatar';
import { Text } from './Text';

/** Horizontal technician selector showing who is on duty today. */
export function TechPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { data } = useApi<{ users: TeamMember[] }>('/users?role=TECHNICIAN');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
      {data?.users
        .filter((u) => u.active)
        .map((u) => {
          const active = value === u.id;
          const onDuty = u.today && !u.today.checkOutAt;
          return (
            <Pressable key={u.id} onPress={() => onChange(u.id)} style={[styles.card, active && styles.active]}>
              <View>
                <Avatar name={u.name} size={44} tint={active ? colors.primary : colors.textMuted} />
                <View style={[styles.dot, { backgroundColor: onDuty ? colors.success : colors.textDim }]} />
              </View>
              <Text variant="label" color={active ? colors.text : colors.textMuted} numberOfLines={1}>
                {firstName(u.name)}
              </Text>
              <Text variant="label" color={colors.textDim}>
                {u.openTasks} {u.openTasks === 1 ? 'job' : 'jobs'} · {u.unitsInCustody} dev
              </Text>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { width: 104, alignItems: 'center', gap: 4, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  active: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
});
