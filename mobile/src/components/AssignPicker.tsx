import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { JobTeam, TeamMember } from '../api/types';
import { useApi } from '../hooks/useApi';
import { colors, fonts, space } from '../theme';
import { firstName } from '../utils/format';
import { Avatar } from './Avatar';
import { Input } from './Input';
import { Segmented } from './Segmented';
import { TechPicker } from './TechPicker';
import { Text } from './Text';

/** Who a job goes to: one technician, a saved team, or a team made right here. */
export type Assignment =
  | { mode: 'individual'; assigneeId: string | null }
  | { mode: 'team'; teamId: string | null; newTeam: { name: string; memberIds: string[]; leaderId: string | null } | null };

export const NO_ASSIGNMENT: Assignment = { mode: 'individual', assigneeId: null };

/** What is missing before the job can be sent, or null when it is ready. */
export function assignmentProblem(a: Assignment): string | null {
  if (a.mode === 'individual') return a.assigneeId ? null : 'Choose a technician';
  if (a.newTeam) {
    if (!a.newTeam.name.trim()) return 'Give the team a name or number';
    if (a.newTeam.memberIds.length < 2) return 'Choose at least two technicians for the team';
    if (!a.newTeam.leaderId) return 'Choose the team leader';
    return null;
  }
  return a.teamId ? null : 'Choose a team, or make a new one';
}

/** The request fields for the API: `assigneeId`, `teamId` or `newTeam`. */
export function assignmentBody(a: Assignment): Record<string, unknown> {
  if (a.mode === 'individual') return { assigneeId: a.assigneeId, teamId: null };
  if (a.newTeam) return { newTeam: { name: a.newTeam.name.trim(), memberIds: a.newTeam.memberIds, leaderId: a.newTeam.leaderId } };
  return { teamId: a.teamId };
}

/**
 * "Individual" picks one technician. "Team" picks a saved team or makes one: a name or number, the
 * members, and the leader who files the report for everyone.
 */
export function AssignPicker({ value, onChange }: { value: Assignment; onChange: (a: Assignment) => void }) {
  const teams = useApi<{ teams: JobTeam[] }>('/teams');
  const techs = useApi<{ users: TeamMember[] }>('/users?role=TECHNICIAN');
  const people = (techs.data?.users ?? []).filter((u) => u.active);

  const setMode = (mode: 'individual' | 'team') =>
    onChange(mode === 'individual' ? { mode, assigneeId: null } : { mode, teamId: null, newTeam: teams.data?.teams.length ? null : { name: '', memberIds: [], leaderId: null } });

  return (
    <View style={{ gap: space.md }}>
      <Segmented
        options={[
          { value: 'individual', label: 'Individual' },
          { value: 'team', label: 'Team' },
        ]}
        value={value.mode}
        onChange={setMode}
      />

      {value.mode === 'individual' ? (
        <TechPicker value={value.assigneeId} onChange={(id) => onChange({ mode: 'individual', assigneeId: id })} />
      ) : (
        <>
          <View style={styles.wrap}>
            {(teams.data?.teams ?? []).map((t) => {
              const on = value.teamId === t.id && !value.newTeam;
              return (
                <Pressable key={t.id} onPress={() => onChange({ mode: 'team', teamId: t.id, newTeam: null })} style={[styles.team, on && styles.teamOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Ionicons name="people" size={18} color={on ? colors.brand : colors.textMuted} />
                  <View style={{ flexShrink: 1 }}>
                    <Text variant="bodySm" style={{ fontFamily: fonts.semibold }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text variant="label" color={colors.textMuted} numberOfLines={1}>
                      {t.members.length} people · leader {firstName(t.leader.name)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => onChange({ mode: 'team', teamId: null, newTeam: value.newTeam ?? { name: '', memberIds: [], leaderId: null } })}
              style={[styles.team, !!value.newTeam && styles.teamOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: !!value.newTeam }}
            >
              <Ionicons name="add-circle-outline" size={18} color={value.newTeam ? colors.brand : colors.textMuted} />
              <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
                New team
              </Text>
            </Pressable>
          </View>

          {value.newTeam ? (
            <NewTeam
              team={value.newTeam}
              people={people}
              onChange={(newTeam) => onChange({ mode: 'team', teamId: null, newTeam })}
            />
          ) : null}

          <View style={styles.note}>
            <Ionicons name="document-text-outline" size={16} color={colors.brand} />
            <Text variant="label" color={colors.textMuted} style={{ flex: 1 }}>
              Everyone in the team sees the job and its alerts. The team leader starts it and files the report on behalf of everyone.
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function NewTeam({ team, people, onChange }: { team: { name: string; memberIds: string[]; leaderId: string | null }; people: TeamMember[]; onChange: (t: typeof team) => void }) {
  const toggle = (id: string) => {
    const memberIds = team.memberIds.includes(id) ? team.memberIds.filter((m) => m !== id) : [...team.memberIds, id];
    onChange({ ...team, memberIds, leaderId: team.leaderId && memberIds.includes(team.leaderId) ? team.leaderId : null });
  };
  const members = people.filter((p) => team.memberIds.includes(p.id));
  return (
    <View style={{ gap: space.md }}>
      <Input label="Team name or number" icon="people-outline" value={team.name} onChangeText={(name) => onChange({ ...team, name })} placeholder="e.g. Team 3 or Kilimani crew" maxLength={60} />

      <Text variant="label" color={colors.textMuted}>
        Members · {team.memberIds.length} chosen
      </Text>
      <View style={styles.wrap}>
        {people.map((p) => {
          const on = team.memberIds.includes(p.id);
          return (
            <Pressable key={p.id} onPress={() => toggle(p.id)} style={[styles.person, on && styles.personOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={p.name}>
              <Avatar name={p.name} size={28} tint={on ? colors.brand : colors.textMuted} />
              <Text variant="bodySm" numberOfLines={1} style={{ maxWidth: 110 }}>
                {firstName(p.name)}
              </Text>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.brand : colors.textDim} />
            </Pressable>
          );
        })}
      </View>

      {members.length ? (
        <>
          <Text variant="label" color={colors.textMuted}>
            Team leader · files the report
          </Text>
          <View style={styles.wrap}>
            {members.map((p) => {
              const on = team.leaderId === p.id;
              return (
                <Pressable key={p.id} onPress={() => onChange({ ...team, leaderId: p.id })} style={[styles.person, on && styles.leaderOn]} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${p.name} leads`}>
                  <Ionicons name={on ? 'star' : 'star-outline'} size={16} color={on ? colors.white : colors.textMuted} />
                  <Text variant="bodySm" color={on ? colors.white : colors.text} fixedColor={on} style={{ fontFamily: on ? fonts.semibold : fonts.regular }}>
                    {firstName(p.name)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  team: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.glassBorder, backgroundColor: colors.glassStrong },
  teamOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.glassBorder, backgroundColor: colors.glassStrong },
  personOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  leaderOn: { borderColor: colors.brand, backgroundColor: colors.brand, paddingLeft: 10 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: colors.surfaceAlt },
});
