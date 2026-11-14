import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ConversationRow } from '../../src/api/field';
import type { ServiceRequest, Task, User } from '../../src/api/types';
import { Avatar, Badge, BellButton, Button, ListRow, Screen, SectionHeader, Text, TileGrid } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts, radius, space } from '../../src/theme';
import { firstName, time } from '../../src/utils/format';

/** Customer care home: what is waiting (chats, requests), jobs on the road, and customers to help sign in. */
export default function CareHome() {
  const user = useAuth((s) => s.user)!;
  const chats = useApi<{ conversations: ConversationRow[] }>('/chat/conversations', { poll: 15_000 });
  const requests = useApi<{ requests: ServiceRequest[] }>('/requests?status=OPEN', { poll: 30_000 });
  const jobs = useApi<{ tasks: Task[] }>('/tasks?status=ASSIGNED,IN_PROGRESS', { poll: 30_000 });
  const customers = useApi<{ users: User[] }>('/users?role=CUSTOMER');
  const toAssign = useApi<{ tasks: Task[] }>('/tasks?status=OPEN', { poll: 30_000 });
  const today = useApi<{ record: { checkInAt: string; checkOutAt: string | null; status: string; shiftStart: string } | null; shiftStart: string }>('/attendance/today', { poll: 60_000 });
  const register = useApi<{ records: { checkOutAt: string | null; user?: { role: string } }[]; absent: { role: string }[] }>('/attendance', { poll: 60_000 });
  const refresh = () => Promise.all([chats.refresh(), requests.refresh(), jobs.refresh(), customers.refresh(), toAssign.refresh(), register.refresh(), today.refresh()]);
  const waitingJobs = toAssign.data?.tasks.length ?? 0;
  const techsIn = (register.data?.records ?? []).filter((r) => r.user?.role === 'TECHNICIAN' && !r.checkOutAt).length;
  const techsOut = (register.data?.absent ?? []).filter((p) => p.role === 'TECHNICIAN').length;

  const unread = (chats.data?.conversations ?? []).filter((c) => c.unread > 0).length;
  const openRequests = requests.data?.requests.length ?? 0;
  const onRoad = (jobs.data?.tasks ?? []).filter((t) => t.status === 'IN_PROGRESS').length;
  const waiting = (customers.data?.users ?? []).filter((u) => u.active && u.mustChangePassword);

  const record = today.data?.record ?? null;
  const state: 'OFF' | 'ON' | 'DONE' = !record ? 'OFF' : record.checkOutAt ? 'DONE' : 'ON';

  return (
    <Screen refreshing={chats.refreshing} onRefresh={refresh} stickyHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 18 }}>
          Customer care
        </Text>
        <BellButton />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="title" style={{ fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 }}>
          Hello {firstName(user.name)}
        </Text>
        <Text variant="bodySm" color={colors.textMuted}>
          Here is what customers are waiting for.
        </Text>
      </View>

      {/* My shift — same prominent position as the technician dashboard */}
      <View style={styles.shift}>
        <View style={[styles.dot, { backgroundColor: state === 'ON' ? colors.success : state === 'DONE' ? colors.textDim : colors.warning }]} />
        <View style={{ flex: 1 }}>
          <Text variant="title" style={{ fontFamily: fonts.semibold }}>
            My shift
          </Text>
          <Text variant="label" color={colors.textMuted}>
            {state === 'OFF'
              ? `Not checked in · shift starts ${time(today.data?.shiftStart ?? '')}`
              : state === 'ON'
                ? `On shift since ${time(record!.checkInAt)}${record!.status === 'LATE' ? ' · late' : ''}`
                : `Shift complete · ${time(record!.checkInAt)} – ${time(record!.checkOutAt)}`}
          </Text>
        </View>
        {state !== 'DONE' ? (
          <Pressable onPress={() => router.push(state === 'OFF' ? '/check-in?mode=in' : '/check-in?mode=out')} style={styles.btn} accessibilityRole="button">
            <Ionicons name={state === 'OFF' ? 'scan-outline' : 'log-out-outline'} size={18} color={colors.onPrimary} />
            <Text variant="bodySm" color={colors.onPrimary} fixedColor style={{ fontFamily: fonts.semibold }}>
              {state === 'OFF' ? 'Check in' : 'Check out'}
            </Text>
          </Pressable>
        ) : (
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="New task" icon="add-circle-outline" style={{ flex: 1 }} onPress={() => router.push('/admin/task-new')} />
        <Button label="Tasks" icon="briefcase-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/care-jobs')} />
      </View>

      <TileGrid
        columns={2}
        items={[
          { key: 'chats', title: 'Support chats', status: unread ? `${unread} waiting for a reply` : 'All answered', icon: 'chatbubbles-outline', badge: unread, onPress: () => router.push('/support') },
          { key: 'req', title: 'Customer requests', status: openRequests ? `${openRequests} new` : 'None new', icon: 'megaphone-outline', badge: openRequests, onPress: () => router.push('/care-requests') },
          { key: 'assign', title: 'Tasks to assign', status: waitingJobs ? `${waitingJobs} waiting for a technician` : 'Nothing waiting', icon: 'time-outline', badge: waitingJobs, onPress: () => router.push('/care-jobs') },
          { key: 'in', title: 'Who is in', status: `${techsIn} technicians in · ${techsOut} not in`, icon: 'people-outline', onPress: () => router.push('/team-today') },
          { key: 'jobs', title: 'Tasks today', status: `${jobs.data?.tasks.length ?? 0} open · ${onRoad} in progress`, icon: 'navigate-outline', onPress: () => router.push('/care-jobs') },
          { key: 'report', title: 'Daily report', status: 'Upload the call-centre report', icon: 'cloud-upload-outline', onPress: () => router.push('/day-report') },
          { key: 'new', title: 'New customer login', status: 'Make an account and send it', icon: 'person-add-outline', onPress: () => router.push('/admin/user-new?role=CUSTOMER') },
        ]}
      />

      <SectionHeader title="Not signed in yet" />
      {waiting.length ? (
        waiting.slice(0, 20).map((c) => (
          <ListRow
            key={c.id}
            flat
            left={<Avatar name={c.name} size={40} tint={colors.accent} />}
            title={c.name}
            subtitle={`${c.customerAccount ?? c.staffNo}${c.phone ? ` · ${c.phone}` : ''}`}
            right={<Badge label="Resend" tone="info" dot={false} />}
            onPress={() => router.push(`/admin/user/${c.id}`)}
          />
        ))
      ) : (
        <Text variant="bodySm" color={colors.textMuted}>
          Every customer has signed in. 🎉
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shift: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.primary },
});
