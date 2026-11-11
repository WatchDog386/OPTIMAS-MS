import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { Task, TaskStatus } from '../api/types';
import { fonts, isDark } from '../theme';
import { dayLabel, firstName, isLaterDay, statusLabel, taskTypeIcon, time } from '../utils/format';
import { SME } from './SmeKit';
import { Text } from './Text';

/*
 * Jobs as a list, like the rows on the Profile page. Each row is tinted a muted colour for the job's
 * state (not assigned, assigned, in progress, done, verified, returned), so rows stand apart from the
 * page and from each other, and the job opens on that same colour.
 */

/** A job state's muted colours: `ink` for icons and labels, `bg` for the row, `chip` for its pill. */
export const JOB_STATE: Record<TaskStatus, { ink: string; bg: string; chip: string }> = isDark
  ? {
      OPEN: { ink: '#D2AE6E', bg: '#262219', chip: '#3A3222' },
      ASSIGNED: { ink: '#8FADD3', bg: '#1C222B', chip: '#283240' },
      IN_PROGRESS: { ink: '#D49F6C', bg: '#28211A', chip: '#3C3024' },
      COMPLETED: { ink: '#A9C27F', bg: '#20251B', chip: '#2F3826' },
      VERIFIED: { ink: '#7FBF9A', bg: '#1A251F', chip: '#25362C' },
      REJECTED: { ink: '#D48A8A', bg: '#2A1D1D', chip: '#3D2828' },
      CANCELLED: { ink: '#9A9AA2', bg: '#222224', chip: '#323236' },
    }
  : {
      OPEN: { ink: '#8A6A2E', bg: '#F4EEE2', chip: '#E9DEC6' },
      ASSIGNED: { ink: '#45648C', bg: '#E8EDF4', chip: '#D5DFEC' },
      IN_PROGRESS: { ink: '#8E5F33', bg: '#F3EBE2', chip: '#E8D8C6' },
      COMPLETED: { ink: '#56703A', bg: '#ECF0E5', chip: '#DAE3CC' },
      VERIFIED: { ink: '#3E7556', bg: '#E5EFE9', chip: '#CFE2D7' },
      REJECTED: { ink: '#9A4646', bg: '#F4E7E7', chip: '#EACFCF' },
      CANCELLED: { ink: '#6B6B73', bg: '#EDEDEF', chip: '#DCDCE0' },
    };

/** The order states are listed in: what needs attention first. */
const ORDER: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'COMPLETED', 'REJECTED', 'VERIFIED', 'CANCELLED'];
const GROUP_TITLE: Record<TaskStatus, string> = {
  OPEN: 'Not assigned',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Done · to verify',
  VERIFIED: 'Verified',
  REJECTED: 'Returned',
  CANCELLED: 'Cancelled',
};

/** One job as a row: state-coloured icon, title, customer and who has it, and the state on the right. */
export function TaskCard({ task, showAssignee }: { task: Task; showAssignee?: boolean }) {
  const s = JOB_STATE[task.status];
  const who = task.team ? `${task.team.name}` : showAssignee ? (task.assignee?.name ?? 'Not assigned yet') : null;
  const later = isLaterDay(task.scheduledFor);
  const by = task.createdBy?.name ? `By ${firstName(task.createdBy.name)}` : null;
  // Who posted it comes right after the code, so it is never cut off
  const unseen = task.status === 'ASSIGNED' && task.assignee && !task.seenAt && !later;
  const sub = [task.code, by, unseen ? 'Not opened yet' : null, task.customerName, who, later ? `For ${dayLabel(task.scheduledFor)}` : task.dueAt && task.status !== 'VERIFIED' && task.status !== 'CANCELLED' ? `Due ${time(task.dueAt)}` : null].filter(Boolean).join(' · ');
  const urgent = task.priority === 'URGENT' || task.priority === 'HIGH';
  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${statusLabel(task.status)}`}
      style={({ pressed }) => [styles.row, { backgroundColor: s.bg }, pressed && { transform: [{ scale: 0.99 }], opacity: 0.9 }]}
    >
      <View style={[styles.icon, { backgroundColor: s.chip }]}>
        <Ionicons name={taskTypeIcon[task.type]} size={18} color={s.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {urgent ? <View style={styles.urgent} accessibilityLabel={`${task.priority.toLowerCase()} priority`} /> : null}
          <Text variant="body" color={SME.fg} fixedColor numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 14, flexShrink: 1 }}>
            {task.title}
          </Text>
        </View>
        <Text variant="label" color={SME.fg3} fixedColor numberOfLines={1} style={{ fontSize: 12 }}>
          {sub}
        </Text>
      </View>
      <View style={[styles.chip, { backgroundColor: s.chip }]}>
        <Text variant="label" color={s.ink} fixedColor style={{ fontFamily: fonts.semibold, fontSize: 11 }}>
          {later ? dayLabel(task.scheduledFor) : statusLabel(task.status)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={SME.fg4} />
    </Pressable>
  );
}

/** Jobs grouped by their state, each group a titled list (like the Profile page's sections). */
export function TaskList({ tasks, showAssignee, renderAfter }: { tasks: Task[]; showAssignee?: boolean; renderAfter?: (t: Task) => React.ReactNode }) {
  // Tasks for later days (the Scheduled filter): grouped by their day instead
  if (tasks.length && tasks.every((t) => isLaterDay(t.scheduledFor))) {
    const days = [...new Set(tasks.map((t) => t.scheduledFor!.slice(0, 10)))].sort();
    return (
      <View style={{ gap: 18 }}>
        {days.map((d) => {
          const items = tasks.filter((t) => t.scheduledFor!.slice(0, 10) === d);
          return (
            <View key={d} style={{ gap: 8 }}>
              <View style={styles.head}>
                <Ionicons name="calendar-outline" size={14} color={SME.fg3} />
                <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 15, flex: 1 }}>
                  {dayLabel(d)}
                </Text>
                <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
                  {items.length}
                </Text>
              </View>
              {items.map((t) => (
                <TaskCard key={t.id} task={t} showAssignee={showAssignee} />
              ))}
            </View>
          );
        })}
      </View>
    );
  }
  const groups = ORDER.map((st) => ({ st, items: tasks.filter((t) => t.status === st) })).filter((g) => g.items.length);
  return (
    <View style={{ gap: 18 }}>
      {groups.map((g) => (
        <View key={g.st} style={{ gap: 8 }}>
          <View style={styles.head}>
            <View style={[styles.dot, { backgroundColor: JOB_STATE[g.st].ink }]} />
            <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.medium, fontSize: 15, flex: 1 }}>
              {GROUP_TITLE[g.st]}
            </Text>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
              {g.items.length}
            </Text>
          </View>
          {g.items.map((t) => (
            <View key={t.id} style={{ gap: 8 }}>
              <TaskCard task={t} showAssignee={showAssignee} />
              {renderAfter?.(t)}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  urgent: { width: 7, height: 7, borderRadius: 4, backgroundColor: isDark ? '#E07070' : '#C24444' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
