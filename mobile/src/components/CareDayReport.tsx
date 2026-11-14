import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ApiError } from '../api/client';
import { useApi } from '../hooks/useApi';
import { submitFile, useOutbox } from '../offline/outbox';
import { celebrate, toast } from '../store/feedback';
import { fonts, isDark, space } from '../theme';
import { Button } from './Button';
import { Input } from './Input';
import { Loading } from './Loading';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';
import { SME } from './SmeKit';
import { Text } from './Text';

/*
 * Customer care's daily report. Theirs comes from the call-centre system: export it there, then here tap
 * "Choose report file", add a comment if needed, and "Send to the office". It opens on the way to
 * check-out, like the technicians' report. With no signal the file waits in the outbox.
 */

const ACCEPT = '.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp';
const MAX_MB = 15;
const GOOD = /\.(pdf|xlsx|xls|csv|docx|doc|txt|png|jpe?g|webp)$/i;

export const sizeLabel = (n?: number | null) => (!n ? '' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** The icon for a report file, by its kind. */
export function fileIcon(name?: string | null): keyof typeof Ionicons.glyphMap {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'document-text';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'grid';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
  return 'document';
}

/** Opens the phone's file picker (Downloads, Files, Drive …). */
function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.style.display = 'none';
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });
}

type Mine = { sent: { id: string; at: string; fileName?: string | null; fileSize?: number | null } | null };

export function CareDayReport({ checkingOut }: { checkingOut: boolean }) {
  const { data, reload } = useApi<Mine>('/day-reports/mine');
  const outbox = useOutbox();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const waiting = outbox.find((i) => i.path === '/day-reports/upload' && i.state !== 'sent');
  if (!data) return <Loading />;
  const sent = data.sent;

  const choose = async () => {
    const f = await pickFile();
    if (!f) return;
    if (!GOOD.test(f.name)) return toast.warning('Not a report file', 'Choose the PDF, Excel, CSV, Word file or picture exported from the call-centre system.');
    if (f.size > MAX_MB * 1024 * 1024) return toast.warning('File too big', `The report must be under ${MAX_MB} MB.`);
    setFile(f);
  };

  const send = async () => {
    if (!file) return toast.warning('Choose the report', 'Tap "Choose report file" and pick the report you exported from the call-centre system.');
    setBusy(true);
    try {
      const r = await submitFile('/day-reports/upload', file, file.name, note.trim() ? { note: note.trim() } : {}, `Daily report: ${file.name}`);
      if (!r.queued) celebrate('Report sent', 'Your call-centre report is with the office.');
      else celebrate('Report saved', 'It is on this phone and goes to the office by itself as soon as you are back online.');
      setFile(null);
      setNote('');
      if (checkingOut) return void router.replace('/check-in?mode=out&go=1');
      await reload();
    } catch (e) {
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label={sent ? 'Send new report' : 'Send to the office'} icon="send" size="lg" loading={busy} disabled={!file} onPress={send} />}>
      <ScreenHeader title="Daily report" subtitle="Customer care · call-centre report" />

      {checkingOut ? (
        <View style={styles.banner}>
          <Ionicons name="log-out-outline" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
          <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, flex: 1 }}>
            Before you check out: upload today’s report from the call-centre app and send it. The check-out photo comes next.
          </Text>
        </View>
      ) : null}

      {sent ? (
        <View style={styles.banner}>
          <Ionicons name="checkmark-circle" size={18} color={isDark ? '#6EE7B7' : '#047857'} />
          <Text variant="bodySm" color={isDark ? '#6EE7B7' : '#047857'} fixedColor style={{ fontFamily: fonts.medium, flex: 1 }}>
            Sent at {new Date(sent.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}
            {sent.fileName ? ` · ${sent.fileName}` : ''}. Sending another file today replaces it.
          </Text>
        </View>
      ) : null}
      {waiting ? (
        <View style={[styles.banner, { backgroundColor: SME.surface }]}>
          <Ionicons name="time-outline" size={18} color={SME.fg3} />
          <Text variant="bodySm" color={SME.fg2} fixedColor style={{ flex: 1 }}>
            {waiting.file?.name ?? 'Your report'} is saved on this phone and is sent when you are back online.
          </Text>
        </View>
      ) : null}

      <View style={styles.steps}>
        {['Export today’s report in the call-centre app', 'Tap “Choose report file” and pick it', 'Send it to the office'].map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.num}>
              <Text variant="label" color={isDark ? '#0B0B0B' : '#FFFFFF'} fixedColor style={{ fontFamily: fonts.bold, fontSize: 12 }}>
                {i + 1}
              </Text>
            </View>
            <Text variant="bodySm" color={SME.fg2} fixedColor style={{ flex: 1 }}>
              {s}
            </Text>
          </View>
        ))}
      </View>

      <Pressable onPress={choose} accessibilityRole="button" accessibilityLabel={file ? `Change file ${file.name}` : 'Choose report file'} style={({ pressed }) => [styles.drop, file && styles.dropChosen, pressed && { opacity: 0.85 }]}>
        <View style={styles.fileIcon}>
          <Ionicons name={file ? fileIcon(file.name) : 'cloud-upload-outline'} size={26} color={isDark ? '#8FD14F' : '#2DA043'} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="title" color={SME.fg} fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>
            {file ? file.name : 'Choose report file'}
          </Text>
          <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
            {file ? `${sizeLabel(file.size)} · tap to change` : `PDF, Excel, CSV, Word or a screenshot · up to ${MAX_MB} MB`}
          </Text>
        </View>
        {file ? <Ionicons name="swap-horizontal" size={18} color={SME.fg4} /> : <Ionicons name="add-circle" size={24} color={isDark ? '#8FD14F' : '#2DA043'} />}
      </Pressable>

      <Input label="Comments (optional)" icon="chatbubble-ellipses-outline" value={note} onChangeText={setNote} placeholder="e.g. 7 complaints escalated to field, system down 10–11am" multiline />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#E7F6EE' },
  steps: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: SME.surface },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#8FD14F' : '#2DA043' },
  drop: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 16, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: isDark ? 'rgba(143,209,79,0.5)' : '#9BD3A8' },
  dropChosen: { borderStyle: 'solid', backgroundColor: SME.surface, borderColor: 'transparent' },
  fileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(143,209,79,0.15)' : '#E3F4EA' },
});
