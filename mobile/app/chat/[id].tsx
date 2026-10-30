import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../src/api/client';
import type { ChatMessage, ConversationDetail, Tick } from '../../src/api/field';
import { Avatar, HeaderButton, Loading, Text } from '../../src/components';
import { Ticks, chatTime } from '../../src/components/ChatInbox';
import { useAuth } from '../../src/store/auth';
import { toast } from '../../src/store/feedback';
import { colors, fonts, space } from '../../src/theme';
import { call } from '../../src/utils/contact';
import { haptic, NATIVE, prefersReducedMotion, spring } from '../../src/utils/motion';

/** New messages are checked for this often while the conversation is open. */
const POLL_MS = 3_000;

/** WhatsApp's light-theme chat colours. */
const WA = {
  wallpaper: '#EFEAE2',
  mine: '#D9FDD3',
  theirs: '#FFFFFF',
  ink: '#111B21',
  meta: '#667781',
  notice: '#FFEECD',
  noticeInk: '#54656F',
  quoteBar: '#06CF9C',
};
/** Sender names in groups get a steady colour each. */
const NAME_COLOURS = ['#1FA855', '#A62C71', '#3762C9', '#C75F0E', '#7F66FF', '#0E8C8C', '#B5446E'];
const nameColour = (id: string) => NAME_COLOURS[[...id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % NAME_COLOURS.length];

const dayLabel = (iso: string) => {
  const t = chatTime(iso);
  return /^\d{2}:\d{2}$/.test(t) ? 'Today' : t;
};

/** One conversation, like WhatsApp: ticks, day chips, replies (long-press a message), group names. Polls while open. */
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuth((s) => s.user?.role);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const fresh = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      setData(await api<ConversationDetail>(`/chat/conversations/${id}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open this conversation');
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  // Fetch only what arrived since the newest message we have (and the latest ticks)
  const last = data?.messages.filter((m) => !m.pending).at(-1)?.createdAt;
  const loaded = !!data;
  useEffect(() => {
    if (!loaded) return;
    const t = setInterval(async () => {
      try {
        const res = await api<ConversationDetail>(`/chat/conversations/${id}${last ? `?after=${encodeURIComponent(last)}` : ''}`);
        setData((prev) => {
          if (!prev) return res;
          const have = new Set(prev.messages.map((m) => m.id));
          const add = res.messages.filter((m) => !have.has(m.id));
          add.forEach((m) => fresh.current.add(m.id));
          if (add.some((m) => !m.mine)) haptic.tap();
          return { ...prev, receipts: res.receipts, messages: add.length ? [...prev.messages, ...add] : prev.messages };
        });
      } catch {
        /* offline for a moment: try again on the next tick */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loaded, id, last]);

  // Keep the newest message in view
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    if (count) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
  }, [count]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    const quoting = replyTo;
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      body,
      createdAt: new Date().toISOString(),
      mine: true,
      sender: { id: 'me', name: 'You', role: role ?? 'TECHNICIAN' },
      replyTo: quoting ? { id: quoting.id, body: quoting.body, sender: quoting.mine ? 'You' : quoting.sender.name } : null,
      pending: true,
    };
    fresh.current.add(temp.id);
    setData((prev) => (prev ? { ...prev, messages: [...prev.messages, temp] } : prev));
    setText('');
    setReplyTo(null);
    setSending(true);
    try {
      const { message } = await api<{ message: ChatMessage }>(`/chat/conversations/${id}/messages`, { body: { body, replyToId: quoting?.id } });
      setData((prev) => (prev ? { ...prev, messages: prev.messages.map((m) => (m.id === temp.id ? message : m)) } : prev));
      haptic.tap();
    } catch (e) {
      // Put the text back so nothing typed is lost
      setData((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== temp.id) } : prev));
      setText(body);
      setReplyTo(quoting);
      toast.error('Not sent', e instanceof ApiError ? e.message : 'Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const reply = (m: ChatMessage) => {
    if (m.pending) return;
    haptic.tap();
    setReplyTo(m);
    input.current?.focus();
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
  const group = c.kind === 'TEAM';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/chat'));
  const tickOf = (m: ChatMessage): Tick | 'pending' => {
    if (m.pending) return 'pending';
    const at = Date.parse(m.createdAt);
    const { readAt, deliveredAt } = data.receipts ?? { readAt: null, deliveredAt: null };
    if (readAt && Date.parse(readAt) >= at) return 'read';
    if (deliveredAt && Date.parse(deliveredAt) >= at) return 'delivered';
    return 'sent';
  };

  return (
    <View style={styles.root}>
      {/* Who this is with */}
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={WA.ink} />
        </Pressable>
        {group ? (
          <View style={styles.groupIcon}>
            <Ionicons name="people" size={20} color={colors.white} />
          </View>
        ) : support && role === 'CUSTOMER' ? (
          <View style={styles.supportIcon}>
            <Ionicons name="headset" size={18} color={colors.onHighlight} />
          </View>
        ) : (
          <Avatar name={c.title} size={40} tint={c.role === 'CUSTOMER' ? colors.accent : c.role === 'TECHNICIAN' ? colors.navy : colors.primary} />
        )}
        <Pressable style={{ flex: 1 }} disabled={!c.otherId || role === 'CUSTOMER' || role === 'TECHNICIAN'} onPress={() => c.otherId && c.role !== 'CUSTOMER' && router.push(`/admin/user/${c.otherId}`)}>
          <Text variant="title" numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 17, color: WA.ink }}>
            {c.title}
          </Text>
          <Text variant="label" color={WA.meta} numberOfLines={1}>
            {c.subtitle}
          </Text>
        </Pressable>
        {c.phone ? (
          <Pressable onPress={() => call(c.phone)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Call ${c.title}`} style={styles.back}>
            <Ionicons name="call-outline" size={22} color={WA.ink} />
          </Pressable>
        ) : null}
      </View>

      {c.jobs.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jobsBar} contentContainerStyle={styles.jobs}>
          {c.jobs.map((j) => (
            <Pressable key={j.id} onPress={() => router.push(role === 'CUSTOMER' ? `/visit/${j.id}` : `/task/${j.id}`)} style={({ pressed }) => [styles.job, pressed && { opacity: 0.7 }]}>
              <Ionicons name="briefcase-outline" size={14} color={WA.ink} />
              <Text variant="label" numberOfLines={1} style={{ fontFamily: fonts.semibold }}>
                {j.code} · {j.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: WA.wallpaper }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <Text variant="label" color={WA.noticeInk} align="center" style={{ lineHeight: 17 }}>
              🔒 Only the people in this chat{support || group ? ' and the Optimas office' : ''} can read these messages. They are kept with Optimas work records. Long-press a message to reply to it.
            </Text>
          </View>
          {data.messages.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="bodySm" color={WA.meta} align="center">
                {support && role === 'CUSTOMER' ? 'Write to the Optimas office. Someone will reply here and you will get a notification.' : group ? `Say hello to ${c.title}.` : `Say hello to ${c.title.split(' ')[0]}.`}
              </Text>
            </View>
          ) : null}
          {data.messages.map((m, i) => {
            const prev = data.messages[i - 1];
            const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
            const grouped = !!prev && !newDay && prev.mine === m.mine && prev.sender.id === m.sender.id && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
            // Groups and the support line say who wrote it
            const name = !m.mine && !grouped && (group || (support && m.sender.role !== 'CUSTOMER')) ? (support ? `${m.sender.name.split(' ')[0]} · Optimas` : m.sender.name) : null;
            return (
              <View key={m.id}>
                {newDay ? (
                  <View style={styles.day}>
                    <Text variant="label" color={WA.meta} style={{ fontFamily: fonts.medium, fontSize: 12 }}>
                      {dayLabel(m.createdAt)}
                    </Text>
                  </View>
                ) : null}
                <Bubble message={m} grouped={grouped} name={name} tick={m.mine ? tickOf(m) : null} animate={fresh.current.has(m.id)} onReply={() => reply(m)} />
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.pill}>
            {replyTo ? (
              <View style={styles.replyBar}>
                <View style={styles.quoteLine} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" color={WA.quoteBar} style={{ fontFamily: fonts.semibold }}>
                    {replyTo.mine ? 'You' : replyTo.sender.name}
                  </Text>
                  <Text variant="label" color={WA.meta} numberOfLines={2}>
                    {replyTo.body}
                  </Text>
                </View>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityLabel="Cancel reply">
                  <Ionicons name="close" size={18} color={WA.meta} />
                </Pressable>
              </View>
            ) : null}
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={WA.meta}
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
          </View>
          <Pressable onPress={send} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send" style={({ pressed }) => [styles.send, !text.trim() && { opacity: 0.55 }, pressed && { transform: [{ scale: 0.92 }] }]}>
            <Ionicons name="send" size={20} color={colors.white} style={{ marginLeft: 3 }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ message: m, grouped, name, tick, animate, onReply }: { message: ChatMessage; grouped: boolean; name: string | null; tick: Tick | 'pending' | null; animate: boolean; onReply: () => void }) {
  const v = useRef(new Animated.Value(animate && !prefersReducedMotion() ? 0 : 1)).current;
  useEffect(() => {
    if (animate) Animated.spring(v, { toValue: 1, ...spring.pop, useNativeDriver: NATIVE }).start();
  }, [animate, v]);
  const bg = m.mine ? WA.mine : WA.theirs;
  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        m.mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
        { marginTop: grouped ? 2 : 8, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
      ]}
    >
      <Pressable onLongPress={onReply} delayLongPress={350} accessibilityHint="Long-press to reply" style={({ pressed }) => [styles.bubble, { backgroundColor: bg }, !grouped && (m.mine ? styles.tailRight : styles.tailLeft), pressed && { opacity: 0.85 }]}>
        {/* The little tail on the first message of a run */}
        {!grouped ? <View style={[styles.tail, m.mine ? { right: -7, borderLeftColor: bg, borderLeftWidth: 10, borderRightWidth: 0 } : { left: -7, borderRightColor: bg, borderRightWidth: 10, borderLeftWidth: 0 }]} /> : null}
        {name ? (
          <Text variant="label" color={nameColour(m.sender.id)} style={{ fontFamily: fonts.semibold, marginBottom: 2 }}>
            {name}
          </Text>
        ) : null}
        {m.replyTo ? (
          <View style={styles.quote}>
            <View style={styles.quoteLine} />
            <View style={{ flex: 1, paddingVertical: 5, paddingRight: 8 }}>
              <Text variant="label" color={WA.quoteBar} style={{ fontFamily: fonts.semibold }}>
                {m.replyTo.sender}
              </Text>
              <Text variant="label" color={WA.meta} numberOfLines={3}>
                {m.replyTo.body}
              </Text>
            </View>
          </View>
        ) : null}
        <Text variant="body" color={WA.ink} fixedColor style={{ fontSize: 15, lineHeight: 21 }}>
          {m.body}
          {/* Room for the time and ticks on the last line, like WhatsApp */}
          <Text style={{ color: 'transparent', fontSize: 11 }}>{tick ? '          ·    ' : '        ·  '}</Text>
        </Text>
        <View style={styles.meta}>
          <Text variant="label" color={WA.meta} fixedColor style={{ fontSize: 11 }}>
            {chatTime(m.createdAt).replace('Yesterday', '')}
          </Text>
          {tick ? <Ticks status={tick} size={15} color={WA.meta} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.md, paddingBottom: 10, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  supportIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  groupIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#8696A0', alignItems: 'center', justifyContent: 'center' },
  jobsBar: { flexGrow: 0, backgroundColor: colors.white },
  jobs: { gap: 8, paddingHorizontal: space.lg, paddingBottom: 8 },
  job: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, maxWidth: 280 },
  list: { paddingHorizontal: 14, paddingBottom: 12, paddingTop: 10, flexGrow: 1 },
  notice: { alignSelf: 'center', maxWidth: 360, backgroundColor: WA.notice, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 30 },
  day: { alignSelf: 'center', marginTop: 12, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.white, shadowColor: '#0B141A', shadowOpacity: 0.08, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  bubbleWrap: { width: '100%', paddingHorizontal: 6 },
  bubble: { maxWidth: '84%', minWidth: 80, paddingHorizontal: 9, paddingTop: 6, paddingBottom: 7, borderRadius: 8, shadowColor: '#0B141A', shadowOpacity: 0.08, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tailRight: { borderTopRightRadius: 0 },
  tailLeft: { borderTopLeftRadius: 0 },
  tail: { position: 'absolute', top: 0, width: 0, height: 0, borderTopWidth: 10, borderTopColor: 'transparent', borderBottomWidth: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  quote: { flexDirection: 'row', gap: 8, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(11,20,26,0.05)', marginBottom: 4 },
  quoteLine: { width: 4, alignSelf: 'stretch', backgroundColor: WA.quoteBar, borderRadius: 2 },
  meta: { position: 'absolute', right: 8, bottom: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 8, paddingTop: 6, backgroundColor: WA.wallpaper },
  pill: { flex: 1, borderRadius: 24, backgroundColor: colors.white, paddingHorizontal: 6, overflow: 'hidden', shadowColor: '#0B141A', shadowOpacity: 0.06, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, padding: 6, borderRadius: 10, backgroundColor: 'rgba(11,20,26,0.05)' },
  input: { minHeight: 48, maxHeight: 130, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 16, color: WA.ink, outlineStyle: 'none' } as object,
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
});
