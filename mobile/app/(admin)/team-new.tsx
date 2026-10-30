import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api, ApiError } from '../../src/api/client';
import { Avatar, Button, Input, Screen, ScreenHeader, SectionHeader, Text } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors, space } from '../../src/theme';
import { toast } from '../../src/store/feedback';
import { firstName } from '../../src/utils/format';

/** Create a crew of two or more technicians so a job can be allocated to the whole team.
 *  The team leader becomes the job's assignee and files the report on everyone's behalf. */
export default function TeamNew() {
  const { data } = useApi<{ users: { id: string; name: string; staffNo: string; active: true }[] }>('/users?role=TECHNICIAN');
  const people = (data?.users ?? []).filter((u) => u.active);
  const [name, setName] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleMember = (id: string) => {
    setMemberIds((s) => {
      const next = s.includes(id) ? s.filter((m) => m !== id) : [...s, id];
      if (!next.includes(leaderId ?? '')) setLeaderId(next.length ? next[0] : null);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim()) return toast.warning('Give the team a name');
    if (memberIds.length < 2) return toast.warning('Choose at least two technicians');
    if (!leaderId) return toast.warning('Choose the team leader');
    setBusy(true);
    try {
      await api<{ team: { id: string; name: string } }>('/teams', {
        body: { name: name.trim(), memberIds, leaderId },
      });
      toast.success('Team created', 'Jobs can now be allocated to the whole crew.');
      router.replace('/team');
    } catch (e) {
      toast.error('Could not create team', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const members = people.filter((p) => memberIds.includes(p.id));

  return (
    <Screen footer={<Button label="Create team" icon="people" size="lg" loading={busy} disabled={!name.trim() || memberIds.length < 2 || !leaderId} onPress={submit} />}>
      <ScreenHeader title="New team" subtitle="A crew that takes jobs together" />
      <SectionHeader title="Team name" />
      <Input label="Name or number" icon="people-outline" value={name} onChangeText={setName} placeholder="e.g. Team 3 or Kilimani crew" maxLength={60} />
      <SectionHeader title="Members" />
      <Text variant="bodySm" color={colors.textMuted} style={{ paddingHorizontal: space.md }}>
        Pick at least two active technicians. Everyone in the team sees the job and its alerts.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.md }}>
        {people.map((p) => {
          const on = memberIds.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => toggleMember(p.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={p.name}
            >
              <Avatar name={p.name} size={26} tint={on ? colors.brand : colors.textMuted} />
              <Text variant="bodySm" numberOfLines={1} style={{ maxWidth: 120 }}>
                {firstName(p.name)}
              </Text>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={on ? colors.brand : colors.textDim} />
            </Pressable>
          );
        })}
      </View>
      {members.length ? (
        <>
          <SectionHeader title="Team leader" />
          <Text variant="bodySm" color={colors.textMuted} style={{ paddingHorizontal: space.md }}>
            The leader starts the job and files the report for everyone.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.md }}>
            {members.map((p) => {
              const on = leaderId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setLeaderId(p.id)}
                  style={[styles.chip, on && styles.chipLeader]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${p.name} leads`}
                >
                  <Ionicons name={on ? 'star' : 'star-outline'} size={16} color={on ? colors.white : colors.textMuted} />
                  <Text variant="bodySm" color={on ? colors.white : colors.text} fixedColor={on} style={{ fontWeight: on ? 600 : 400 }}>
                    {firstName(p.name)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.glassBorder, backgroundColor: colors.glassStrong },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  chipLeader: { borderColor: colors.brand, backgroundColor: colors.brand, paddingLeft: 10 },
});
