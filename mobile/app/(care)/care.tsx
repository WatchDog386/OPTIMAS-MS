import { router } from 'expo-router';
import { View } from 'react-native';
import type { ConversationRow } from '../../src/api/field';
import type { ServiceRequest, Task, User } from '../../src/api/types';
import { Avatar, Badge, BellButton, Button, ListRow, Screen, ShiftCard, SectionHeader, Text, TileGrid } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { useAuth } from '../../src/store/auth';
import { colors, fonts } from '../../src/theme';
import { firstName } from '../../src/utils/format';

/** Customer care home: what is waiting (chats, requests), jobs on the road, and customers to help sign in. */
export default function CareHome() {
  const user = useAuth((s) => s.user)!;
  const chats = useApi<{ conversations: ConversationRow[] }>('/chat/conversations', { poll: 15_000 });
  const requests = useApi<{ requests: ServiceRequest[] }>('/requests?status=OPEN', { poll: 30_000 });
  const jobs = useApi<{ tasks: Task[] }>('/tasks?status=ASSIGNED,IN_PROGRESS', { poll: 30_000 });
  const customers = useApi<{ users: User[] }>('/users?role=CUSTOMER');
  const toAssign = useApi<{ tasks: Task[] }>('/tasks?status=OPEN', { poll: 30_000 });
  const register = useApi<{ records: { checkOutAt: string | null; user?: { role: string } }[]; absent: { role: string }[] }>('/attendance', { poll: 60_000 });
  const refresh = () => Promise.all([chats.refresh(), requests.refresh(), jobs.refresh(), customers.refresh(), toAssign.refresh(), register.refresh()]);
  const waitingJobs = toAssign.data?.tasks.length ?? 0;
  const techsIn = (register.data?.records ?? []).filter((r) => r.user?.role === 'TECHNICIAN' && !r.checkOutAt).length;
  const techsOut = (register.data?.absent ?? []).filter((p) => p.role === 'TECHNICIAN').length;

  const unread = (chats.data?.conversations ?? []).filter((c) => c.unread > 0).length;
  const openRequests = requests.data?.requests.length ?? 0;
  const onRoad = (jobs.data?.tasks ?? []).filter((t) => t.status === 'IN_PROGRESS').length;
  const waiting = (customers.data?.users ?? []).filter((u) => u.active && u.mustChangePassword);

  return (
    <Screen refreshing={chats.refreshing} onRefresh={refresh}>
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

      <ShiftCard />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="New job" icon="add-circle-outline" style={{ flex: 1 }} onPress={() => router.push('/admin/task-new')} />
        <Button label="Jobs" icon="briefcase-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/care-jobs')} />
      </View>

      <TileGrid
        columns={2}
        items={[
          { key: 'chats', title: 'Support chats', status: unread ? `${unread} waiting for a reply` : 'All answered', icon: 'chatbubbles-outline', badge: unread, onPress: () => router.push('/support') },
          { key: 'req', title: 'Customer requests', status: openRequests ? `${openRequests} new` : 'None new', icon: 'megaphone-outline', badge: openRequests, onPress: () => router.push('/care-requests') },
          { key: 'assign', title: 'Jobs to assign', status: waitingJobs ? `${waitingJobs} waiting for a technician` : 'Nothing waiting', icon: 'time-outline', badge: waitingJobs, onPress: () => router.push('/care-jobs') },
          { key: 'in', title: 'Who is in', status: `${techsIn} technicians in · ${techsOut} not in`, icon: 'people-outline', onPress: () => router.push('/team-today') },
          { key: 'jobs', title: 'Jobs today', status: `${jobs.data?.tasks.length ?? 0} open · ${onRoad} in progress`, icon: 'navigate-outline', onPress: () => router.push('/care-jobs') },
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
