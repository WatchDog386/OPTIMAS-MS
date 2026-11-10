import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SME } from '../../src/components/SmeKit';
import { fonts, isDark } from '../../src/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { EarlierJobs, EmptyState, HeaderButton, PageHeader, Screen, Segmented, TaskList, Text } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { useTodayJobs } from '../../src/hooks/useTodayJobs';

const FILTERS = [
  { value: 'OPEN', label: 'To assign' },
  { value: 'ASSIGNED,IN_PROGRESS', label: 'Open' },
  { value: 'COMPLETED', label: 'To verify' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED,CANCELLED', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function AdminJobs() {
  const params = useLocalSearchParams<{ status?: string; due?: string }>();
  const [due, setDue] = useState<'soon' | 'overdue' | undefined>(params.due === 'soon' || params.due === 'overdue' ? params.due : undefined);
  const [filter, setFilter] = useState(params.status ?? (due ? '' : 'ASSIGNED,IN_PROGRESS'));
  const role = useAuth((s) => s.user?.role);
  const { data, refresh, refreshing, loading, earlier, earlierShown, showEarlier } = useTodayJobs(filter, { due });
  const canCreate = role === 'ADMIN' || role === 'SUPERVISOR';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader title="Tasks" right={canCreate ? <HeaderButton icon="add" label="New task" primary onPress={() => router.push('/admin/task-new')} /> : undefined} />
      {due ? (
        <Pressable onPress={() => setDue(undefined)} accessibilityRole="button" style={styles.due}>
          <Ionicons name={due === 'soon' ? 'time-outline' : 'alert-circle-outline'} size={16} color={due === 'soon' ? '#B45309' : '#B91C1C'} />
          <Text variant="bodySm" color={due === 'soon' ? '#B45309' : '#B91C1C'} fixedColor style={{ flex: 1, fontFamily: fonts.medium }}>
            {due === 'soon' ? 'Open tasks due in the next 2 hours' : 'Open tasks past their due time'}
          </Text>
          <Ionicons name="close" size={16} color={SME.fg3} />
        </Pressable>
      ) : null}
      <Segmented
        options={FILTERS}
        value={filter}
        onChange={(v) => {
          setDue(undefined);
          setFilter(v);
        }}
      />
      {data?.tasks.length ? <TaskList tasks={data.tasks} showAssignee /> : null}
      {!loading && !data?.tasks.length ? <EmptyState icon="briefcase-outline" title={earlierShown ? 'No tasks' : 'No tasks today'} message={earlierShown ? 'Nothing matches this filter.' : 'Only tasks created today are listed here.'} /> : null}
      <EarlierJobs count={earlier} onPress={showEarlier} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  due: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFF7E6' },
});
