import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from '../../src/api/types';
import { EmptyState, Screen, Segmented, TaskCard, Text } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { useApi } from '../../src/hooks/useApi';
import { colors, shadow } from '../../src/theme';

const FILTERS = [
  { value: 'ASSIGNED,IN_PROGRESS', label: 'Open' },
  { value: 'COMPLETED', label: 'To verify' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED,CANCELLED', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminJobs() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [filter, setFilter] = useState(params.status ?? FILTERS[0].value);
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading } = useApi<{ tasks: Task[] }>(`/tasks${filter ? `?status=${filter}` : ''}`);
  const canCreate = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={refreshing} onRefresh={refresh}>
        <Text variant="h1">Jobs</Text>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        {data?.tasks.map((t) => <TaskCard key={t.id} task={t} showAssignee />)}
        {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title="No jobs" message="Nothing matches this filter." /> : null}
      </Screen>
      {canCreate ? (
        <Pressable style={[styles.fab, shadow.glow]} onPress={() => router.push('/admin/task-new')} accessibilityLabel="New job">
          <Ionicons name="add" size={28} color={colors.onPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
