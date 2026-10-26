import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import { Badge, EmptyState, Input, Screen, ScreenHeader, Section, SectionRow, Text } from '../src/components';
import { isManager, useAuth } from '../src/store/auth';
import { colors } from '../src/theme';
import { humanize, taskStatusTone, unitStatusTone } from '../src/utils/format';
import type { TaskStatus, UnitStatus } from '../src/api/types';

interface Results {
  tasks: { id: string; code: string; title: string; status: TaskStatus; customerName: string; assignee: { name: string } }[];
  units: { id: string; serialNumber: string; status: UnitStatus; customerAccount: string | null; item: { name: string }; holder: { name: string } | null }[];
  staff: { id: string; name: string; staffNo: string; role: string; active: boolean }[];
  customers: { id: string; name: string; customerAccount: string | null; phone: string | null; active: boolean }[];
  requests: { id: string; type: string; status: string; description: string; customer: { name: string } }[];
}

/** One search box across jobs, devices, people and requests. */
export default function Search() {
  const role = useAuth((s) => s.user?.role);
  const manager = isManager(role);
  const people = role === 'ADMIN' || role === 'SUPERVISOR';
  const [q, setQ] = useState('');
  const [data, setData] = useState<Results | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        setData(await api<Results>(`/search?q=${encodeURIComponent(term)}`));
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Search failed');
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const empty = data && !data.tasks.length && !data.units.length && !data.staff.length && !data.customers.length && !data.requests.length;

  return (
    <Screen>
      <ScreenHeader title="Search" subtitle={manager ? 'Jobs, devices, people and requests' : 'Your jobs and devices'} />
      <Input icon="search" placeholder="Job code, customer, serial, phone, name…" value={q} onChangeText={setQ} autoFocus autoCorrect={false} returnKeyType="search" />
      {busy ? <ActivityIndicator color={colors.text} /> : null}
      {error ? (
        <Text variant="bodySm" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {!q.trim() ? <EmptyState icon="search-outline" title="Find anything" message="Search by job code (JOB-…), customer name or account, router serial number, phone or staff number." /> : null}
      {empty ? <EmptyState icon="file-tray-outline" title="No matches" message={`Nothing found for “${q.trim()}”.`} /> : null}

      {data?.tasks.length ? (
        <Section title="Jobs">
          {data.tasks.map((t) => (
            <SectionRow key={t.id} icon="briefcase-outline" tint={colors.text} tintBg={colors.highlight} title={`${t.code} · ${t.title}`} subtitle={`${t.customerName} · ${t.assignee.name}`} right={<Badge label={humanize(t.status)} tone={taskStatusTone[t.status]} />} onPress={() => router.push(`/task/${t.id}`)} />
          ))}
        </Section>
      ) : null}
      {data?.units.length ? (
        <Section title="Devices">
          {data.units.map((u) => (
            <SectionRow
              key={u.id}
              icon="wifi"
              tint={colors.text}
              tintBg={colors.highlight}
              title={u.serialNumber}
              subtitle={`${u.item.name}${u.holder ? ` · ${u.holder.name}` : ''}${u.customerAccount ? ` · ${u.customerAccount}` : ''}`}
              right={<Badge label={humanize(u.status)} tone={unitStatusTone[u.status]} />}
              onPress={() => router.push(manager ? `/admin/unit?serial=${encodeURIComponent(u.serialNumber)}` : '/stock')}
            />
          ))}
        </Section>
      ) : null}
      {data?.staff.length ? (
        <Section title="Staff">
          {data.staff.map((s) => (
            <SectionRow key={s.id} icon="person-outline" title={s.name} subtitle={`${s.staffNo} · ${humanize(s.role)}${s.active ? '' : ' · deactivated'}`} onPress={people ? () => router.push(`/admin/user/${s.id}`) : undefined} />
          ))}
        </Section>
      ) : null}
      {data?.customers.length ? (
        <Section title="Customers">
          {data.customers.map((c) => (
            <SectionRow key={c.id} icon="home-outline" title={c.name} subtitle={[c.customerAccount, c.phone].filter(Boolean).join(' · ')} onPress={() => router.push(`/admin/user/${c.id}`)} />
          ))}
        </Section>
      ) : null}
      {data?.requests.length ? (
        <Section title="Customer requests">
          {data.requests.map((r) => (
            <SectionRow key={r.id} icon="chatbubbles-outline" title={`${humanize(r.type)} · ${r.customer.name}`} subtitle={r.description} right={<Badge label={humanize(r.status)} tone="neutral" />} onPress={() => router.push('/admin/requests')} />
          ))}
        </Section>
      ) : null}
      <View style={{ height: 40 }} />
    </Screen>
  );
}
