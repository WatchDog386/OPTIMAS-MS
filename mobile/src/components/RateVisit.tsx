import { useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../api/client';
import type { CustomerJob } from '../api/types';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Glass } from './Glass';
import { Input } from './Input';
import { StarRating } from './Motion';
import { Text } from './Text';

const LABELS = ['', 'Poor', 'Could be better', 'Good', 'Great', 'Excellent'];

/** Customer rates a finished visit (1–5 stars + optional comment). Calls `onRated` with the updated job. */
export function RateVisit({ job, onRated }: { job: CustomerJob; onRated: (job: CustomerJob) => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ job: CustomerJob }>(`/customer/jobs/${job.id}/rate`, { body: { rating: stars, comment: comment.trim() || undefined } });
      setThanks(true);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: Platform.OS !== 'web' }).start();
      setTimeout(() => onRated(res.job), 1600);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send your rating');
    } finally {
      setBusy(false);
    }
  };

  if (thanks) {
    return (
      <Glass strong style={styles.thanks}>
        <Animated.View style={[styles.check, { transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={30} color={colors.white} />
        </Animated.View>
        <Text variant="title">Thank you!</Text>
        <Text variant="label" color={colors.textMuted} align="center">
          Your feedback goes straight to {job.assignee.name.split(' ')[0]} and our supervisors.
        </Text>
      </Glass>
    );
  }

  return (
    <Glass strong style={{ gap: 12 }}>
      <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.semibold, letterSpacing: 0.6 }}>
        RATE YOUR VISIT
      </Text>
      <Text variant="h2" style={{ fontFamily: fonts.medium, fontSize: 21, lineHeight: 26 }}>
        How did {job.assignee.name.split(' ')[0]} do?
      </Text>
      <Text variant="label" color={colors.textMuted}>
        {job.title} · {job.code}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <StarRating value={stars} onChange={setStars} size={34} />
        <Text variant="label" style={{ fontFamily: fonts.semibold }}>
          {LABELS[stars]}
        </Text>
      </View>
      {stars ? (
        <>
          <Input placeholder={stars >= 4 ? 'What went well? (optional)' : 'What should we improve? (optional)'} value={comment} onChangeText={setComment} maxLength={500} multiline />
          {error ? (
            <Text variant="label" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button label="Send rating" icon="send" loading={busy} onPress={submit} />
        </>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  thanks: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  check: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
