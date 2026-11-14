import { Pressable, Share, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL, authHeader } from '../../../src/api/client';
import { Text } from '../../../src/components';
import { fileIcon, sizeLabel } from '../../../src/components/CareDayReport';
import { toast } from '../../../src/store/feedback';
import { fonts, isDark } from '../../../src/theme';
import { useLocalSearchParams } from 'expo-router';
import { Button, Loading, Screen, ScreenHeader } from '../../../src/components';
import { SME } from '../../../src/components/SmeKit';
import { useApi } from '../../../src/hooks/useApi';
import { space } from '../../../src/theme';
import { call } from '../../../src/utils/contact';
import { ReportText } from '../../day-report';

interface Report {
  id: string;
  text: string;
  tasksDone: number;
  updatedAt: string;
  submittedBy: { id: string; name: string; staffNo: string; phone: string | null };
  team: { id: string; name: string } | null;
  fileName?: string | null;
  fileSize?: number | null;
}

/** Downloads the uploaded report file (signed in) and opens it: PDFs and pictures in a new tab, others saved. */
async function openFile(id: string, name: string) {
  try {
    const res = await fetch(`${API_URL}/day-reports/${id}/file`, { headers: authHeader() });
    if (!res.ok) throw new Error();
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    if (!/\.(pdf|png|jpe?g|webp|txt)$/i.test(name)) a.download = name;
    else a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    toast.error('Could not open the file', 'Check your connection and try again.');
  }
}

/** One daily report, as the technician or team leader sent it. */
export default function DayReportView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useApi<{ report: Report }>(`/day-reports/${id}`);
  if (!data) return <Loading />;
  const r = data.report;
  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {r.submittedBy.phone ? <Button label="Call" icon="call" variant="secondary" onPress={() => call(r.submittedBy.phone!)} style={{ flex: 1 }} /> : null}
          <Button label="Share" icon="share-outline" onPress={() => void Share.share({ message: r.text })} style={{ flex: 1.3 }} />
        </View>
      }
    >
      <ScreenHeader title={r.team ? r.team.name : r.submittedBy.name} subtitle={`Daily report · ${r.submittedBy.name} · ${new Date(r.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`} />
      {r.fileName ? (
        <Pressable onPress={() => void openFile(r.id, r.fileName!)} accessibilityRole="button" accessibilityLabel={`Open ${r.fileName}`} style={({ pressed }) => [styles.file, pressed && { opacity: 0.85 }]}>
          <View style={styles.fileIcon}>
            <Ionicons name={fileIcon(r.fileName)} size={24} color={isDark ? '#8FD14F' : '#2DA043'} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="title" color={SME.fg} fixedColor numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14 }}>
              {r.fileName}
            </Text>
            <Text variant="label" color={SME.fg4} fixedColor style={{ fontSize: 12 }}>
              Call-centre report · {sizeLabel(r.fileSize)} · tap to open
            </Text>
          </View>
          <Ionicons name="download-outline" size={20} color={SME.fg3} />
        </Pressable>
      ) : null}
      <View style={styles.paper}>
        <ReportText text={r.text} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { padding: 16, borderRadius: 16, backgroundColor: SME.surface },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: SME.surface },
  fileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(143,209,79,0.15)' : '#E3F4EA' },
});
