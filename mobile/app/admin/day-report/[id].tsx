import { Share, StyleSheet, View } from 'react-native';
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
      <View style={styles.paper}>
        <ReportText text={r.text} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ paper: { padding: 16, borderRadius: 16, backgroundColor: SME.surface } });
