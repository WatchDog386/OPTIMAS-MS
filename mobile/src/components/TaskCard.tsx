import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Task } from '../api/types';
import { colors, radius, space } from '../theme';
import { humanize, priorityTone, taskStatusTone, taskTypeIcon, time } from '../utils/format';
import { Badge } from './Badge';
import { Card } from './Card';
import { Text } from './Text';

export function TaskCard({ task, showAssignee }: { task: Task; showAssignee?: boolean }) {
  return (
    <Card onPress={() => router.push(`/task/${task.id}`)}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Ionicons name={taskTypeIcon[task.type]} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color={colors.textDim}>
            {task.code} · {humanize(task.type)}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {task.title}
          </Text>
        </View>
        <Badge label={humanize(task.status)} tone={taskStatusTone[task.status]} />
      </View>
      <View style={styles.meta}>
        <Meta icon="person-outline" text={task.customerName} />
        <Meta icon="location-outline" text={task.address} />
        {task.team ? (
          <Meta icon="people-outline" text={`${task.team.name} · led by ${task.assignee.name}`} />
        ) : showAssignee ? (
          <Meta icon="construct-outline" text={task.assignee.name} />
        ) : null}
      </View>
      <View style={styles.bottom}>
        <Badge label={humanize(task.priority)} tone={priorityTone[task.priority]} dot={false} />
        {task.dueAt ? (
          <Text variant="label" color={colors.textMuted}>
            Due {time(task.dueAt)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={14} color={colors.textDim} />
      <Text variant="bodySm" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  meta: { gap: 6, marginTop: space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
});
