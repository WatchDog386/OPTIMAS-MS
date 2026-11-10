import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { api, ApiError } from '../src/api/client';
import { Button, EmptyState, Input, Loading, Screen, ScreenHeader, Text } from '../src/components';
import { SME } from '../src/components/SmeKit';
import { WA_GREEN } from '../src/components/TempPasswordCard';
import { useApi } from '../src/hooks/useApi';
import { celebrate, toast } from '../src/store/feedback';
import { fonts, isDark, space } from '../src/theme';
import { whatsapp } from '../src/utils/contact';
import { kes } from '../src/utils/format';

interface Mine {
  report: {
    canSubmit: boolean;
    reason: string | null;
    team: { id: string; name: string } | null;
    members: { id: string; name: string; leader: boolean }[];
    text: string;
    tasksDone: number;
    collected: number;
    cable: number;
    routers: number;
  };
  sent: { id: string; at: string; tasksDone: number } | null;
}

/**
 * The end-of-day report: put together from today's task reports (members, then each task with its
 * location, status, signal, what the client paid, materials, drop cable and FAT), sent to the office
 * and, if wanted, on WhatsApp. On team tasks the team leader sends it for everyone.
 */
export default function DayReport() {
  const { data, reload, refresh, refreshing } = useApi<Mine>('/day-reports/mine');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!data) return <Loading />;
  const r = data.report;
  const full = note.trim() ? `${r.text}\n\n*Comments*\n${note.trim()}` : r.text;

  const send = async () => {
    setBusy(true);
    try {
      await api('/day-reports', { body: { note: note.trim() || undefined } });
      celebrate('Report sent', r.team ? `${r.team.name}'s report is with the office.` : 'Your report is with the office.');
      await reload();
    } catch (e) {
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        r.canSubmit ? (
          <View style={{ gap: space.sm }}>
            <Button label={data.sent ? 'Send updated report' : 'Send to the office'} icon="send" size="lg" loading={busy} onPress={send} />
            <Button label="Share on WhatsApp" icon="logo-whatsapp" onPress={() => void whatsapp(null, full.replace(/\n/g, '\n'))} style={{ backgroundColor: WA_GREEN, borderColor: WA_GREEN }} textColor="#FFFFFF" />
          </View>
        ) : undefined
      }
    >
      <ScreenHeader title="Daily report" subtitle={r.team ? `${r.team.name} · you send it as team leader` : 'Your tasks today'} />

      {!r.canSubmit ? (
        <EmptyState icon="document-text-outline" title="Nothing to send" message={r.reason ?? 'Finish a task first.'} />
      ) : (
        <>
          {data.sent ? (
            <View style={styles.sent}>
              <Ionicons name="checkmark-circle" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
              <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, flex: 1 }}>
                Sent at {new Date(data.sent.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })} · {data.sent.tasksDone} task{data.sent.tasksDone === 1 ? '' : 's'}. Finished more since? Send it again.
              </Text>
            </View>
          ) : null}

          <View style={styles.stats}>
            <Stat label="Tasks done" value={String(r.tasksDone)} />
            <Stat label="Client paid" value={kes(r.collected)} />
            <Stat label="Drop cable" value={`${r.cable} m`} />
          </View>

          <View style={styles.paper}>
            <ReportText text={full} />
          </View>
          <Input label="Comments for the office (optional)" multiline value={note} onChangeText={setNote} placeholder="Anything else the office should know" />
          <Button label="Open my tasks" icon="briefcase-outline" variant="ghost" onPress={() => router.push('/jobs')} />
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" color={SME.fg} fixedColor style={{ fontFamily: fonts.semibold }}>
        {value}
      </Text>
      <Text variant="label" color={SME.fg3} fixedColor style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

/** The report as it reads on WhatsApp: *bold* lines shown bold, the rest as written. */
export function ReportText({ text }: { text: string }) {
  return (
    <View style={{ gap: 2 }}>
      {text.split('\n').map((line, i) => {
        const bold = /^\*.*\*/.test(line.trim());
        const clean = line.replace(/\*/g, '');
        return (
          <Text key={i} variant="bodySm" color={bold ? SME.fg : SME.fg2} fixedColor style={[{ fontSize: 13, lineHeight: 19 }, bold && { fontFamily: fonts.semibold, fontSize: 14, marginTop: i ? 4 : 0 }, !clean.trim() && { height: 6 }]}>
            {clean}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sent: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : '#E3F4EA' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 14, backgroundColor: SME.surface },
  paper: { padding: 16, borderRadius: 16, backgroundColor: SME.surface },
});
