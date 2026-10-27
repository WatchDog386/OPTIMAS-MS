import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { ChatMessage, ConversationDetail } from '../../src/api/field';
import { Avatar, GlassBackground, HeaderButton, Loading, Text } from '../../src/components';
import { chatTime } from '../../src/components/ChatInbox';
import { useAuth } from '../../src/store/auth';
import { toast } from '../../src/store/feedback';
import { colors, fonts, radius, space } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { haptic, NATIVE, prefersReducedMotion, spring } from '../../src/utils/motion';

/** New messages are checked for this often while the conversation is open. */
const POLL_MS = 3_000;

const dayLabel = (iso: string) => {
  const t = chatTime(iso);
  return /^\d{2}:\d{2}$/.test(t) ? 'Today' : t;
};

/** One conversation: bubbles, the job it is about, and a box to reply. Polls for new messages while open. */
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuth((s) => s.user?.role);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const fresh = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      setData(await api<ConversationDetail>(`/chat/conversations/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open this conversation');
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  // Fetch only what arrived since the newest message we have
  const last = data?.messages.filter((m) => !m.pending).at(-1)?.createdAt;
  useEffect(() => {
    if (!data) return;
    const t = setInterval(async () => {
      try {
        const res = await api<ConversationDetail>(`/chat/conversations/${id}${last ? `?after=${encodeURIComponent(last)}` : ''}`);
        if (!res.messages.length) return;
        setData((prev) => {
          if (!prev) return res;
          const have = new Set(prev.messages.map((m) => m.id));
          const add = res.messages.filter((m) => !have.has(m.id));
          add.forEach((m) => fresh.current.add(m.id));
          if (add.some((m) => !m.mine)) haptic.tap();
          return add.length ? { ...prev, messages: [...prev.messages, ...add] } : prev;
        });
      } catch {
        /* offline for a moment: try again on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [data, id, last]);

  // Keep the newest message in view
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    if (count) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [count]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    const temp: ChatMessage = { id: `temp-${Date.now()}`, body, createdAt: new Date().toISOString(), mine: true, sender: { id: 'me', name: 'You', role: role ?? 'TECHNICIAN' }, pending: true };
    fresh.current.add(temp.id);
    setData((prev) => (prev ? { ...prev, messages: [...prev.messages, temp] } : prev));
    setText('');
    setSending(true);
    try {
      const { message } = await api<{ message: ChatMessage }>(`/chat/conversations/${id}/messages`, { body: { body } });
      setData((prev) => (prev ? { ...prev, messages: prev.messages.map((m) => (m.id === temp.id ? message : m)) } : prev));
      haptic.tap();
    } catch (e) {
      // Put the text back so nothing typed is lost
      setData((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== temp.id) } : prev));
      setText(body);
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (error) {
    return (
      <View style={[styles.root, styles.center]}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
        <Text variant="title" align="center">
          {error}
        </Text>
        <HeaderButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      </View>
    );
  }
  if (!data) return <Loading />;
  const c = data.conversation;
  const support = c.kind === 'SUPPORT';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/chat'));

  return (
    <View style={styles.root}>
      <GlassBackground />
      {/* Who this is with */}
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <HeaderButton icon="chevron-back" label="Back" onPress={back} />
        {support && role === 'CUSTOMER' ? (
          <View style={styles.supportIcon}>
            <Ionicons name="headset" size={18} color={colors.onHighlight} />
          </View>
        ) : (
          <Avatar name={c.title} size={40} tint={c.role === 'CUSTOMER' ? colors.accent : c.role === 'TECHNICIAN' ? colors.navy : colors.primary} />
        )}
        <Pressable style={{ flex: 1 }} disabled={!c.otherId || role === 'CUSTOMER' || role === 'TECHNICIAN'} onPress={() => c.otherId && c.role !== 'CUSTOMER' && router.push(`/admin/user/${c.otherId}`)}>
          <Text variant="title" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
            {c.title}
          </Text>
          <Text variant="label" color={colors.textMuted} numberOfLines={1}>
            {c.subtitle}
          </Text>
        </Pressable>
        {c.phone ? <HeaderButton icon="call-outline" label={`Call ${c.title}`} onPress={() => call(c.phone)} /> : null}
      </View>

      {c.jobs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.jobs}>
          {c.jobs.map((j) => (
            <Pressable key={j.id} onPress={() => router.push(role === 'CUSTOMER' ? `/visit/${j.id}` : `/task/${j.id}`)} style={({ pressed }) => [styles.job, pressed && { opacity: 0.7 }]}>
              <Ionicons name="briefcase-outline" size={14} color={colors.text} />
              <Text variant="label" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                {j.code} · {j.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {data.messages.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.textDim} />
              <Text variant="bodySm" color={colors.textMuted} align="center">
                {support && role === 'CUSTOMER' ? 'Write to the Optimas office. Someone will reply here and you will get a notification.' : `Say hello to ${c.title.split(' ')[0]}.`}
              </Text>
            </View>
          ) : null}
          {data.messages.map((m, i) => {
            const prev = data.messages[i - 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const grouped = !!prev && !newDay && prev.mine === m.mine && prev.sender.id === m.sender.id && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
            // On a support line, say which office person answered
            const showName = support && !m.mine && m.sender.role !== 'CUSTOMER' && !grouped;
            return (
              <View key={m.id}>
                {newDay ? (
                  <View style={styles.day}>
                    <Text variant="label" color={colors.textMuted} style={{ fontFamily: fonts.semibold }}>
                      {dayLabel(m.createdAt)}
                    </Text>
                  </View>
                ) : null}
                <Bubble message={m} grouped={grouped} name={showName ? `${m.sender.name.split(' ')[0]} · Optimas` : null} animate={fresh.current.has(m.id)} />
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={2000}
            style={styles.input}
            onKeyPress={(e) => {
              // Enter sends on a keyboard; Shift+Enter makes a new line
              const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                (e as unknown as { preventDefault: () => void }).preventDefault();
                void send();
              }
            }}
            accessibilityLabel="Message"
          />
          <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send" style={({ pressed }) => [styles.send, !text.trim() && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.92 }] }]}>
            <Ionicons name="send" size={18} color={colors.onHighlight} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message: m, grouped, name, animate }: { message: ChatMessage; grouped: boolean; name: string | null; animate: boolean }) {
  const v = useRef(new Animated.Value(animate && !prefersReducedMotion() ? 0 : 1)).current;
  useEffect(() => {
    if (animate) Animated.spring(v, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [animate, v]);
  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        m.mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
        { marginTop: grouped ? 3 : 10, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
      ]}
    >
      {name ? (
        <Text variant="label" color={colors.textMuted} style={{ marginLeft: 12, marginBottom: 2 }}>
          {name}
        </Text>
      ) : null}
      <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs, grouped && (m.mine ? { borderTopRightRadius: 8 } : { borderTopLeftRadius: 8 })]}>
        <Text variant="body" color={m.mine ? colors.white : colors.text} fixedColor={m.mine} style={{ fontSize: 15, lineHeight: 21 }}>
          {m.body}
        </Text>
        <View style={styles.meta}>
          <Text variant="label" color={m.mine ? 'rgba(255,255,255,0.65)' : colors.textDim} fixedColor={m.mine} style={{ fontSize: 10.5 }}>
            {chatTime(m.createdAt).replace('Yesterday', '')}
          </Text>
          {m.mine ? <Ionicons name={m.pending ? 'time-outline' : 'checkmark'} size={12} color="rgba(255,255,255,0.7)" /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgTop },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingBottom: 10 },
  supportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  jobs: { gap: 8, paddingHorizontal: space.lg, paddingBottom: 8 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder, maxWidth: 280 },
  list: { paddingHorizontal: space.lg, paddingBottom: 16, paddingTop: 4, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 60, paddingHorizontal: 30 },
  day: { alignSelf: 'center', marginTop: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.glassStrong },
  bubbleWrap: { width: '100%' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6, borderRadius: radius.xl - 6 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.border },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: space.md, paddingTop: 10, backgroundColor: 'rgba(255,255,255,0.92)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 46, maxHeight: 130, borderRadius: 23, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
});
