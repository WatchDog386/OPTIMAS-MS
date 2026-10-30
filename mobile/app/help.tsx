import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Glass, PageHeader, Reveal, Screen, Segmented, Text } from '../src/components';
import { usePublicInfo } from '../src/hooks/usePublicInfo';
import { colors, fonts, space } from '../src/theme';
import { call, whatsapp } from '../src/utils/contact';

type Who = 'customer' | 'technician';
type Topic = { icon: keyof typeof Ionicons.glyphMap; title: string; steps: string[] };

const CUSTOMER: Topic[] = [
  {
    icon: 'log-in-outline',
    title: 'Signing in for the first time',
    steps: [
      'Your technician creates your account when they install your internet and gives you an account number (it starts with FBI-CUS-) and a one-time password.',
      'Open the app, enter the account number and the one-time password, then choose your own password.',
      'Keep your password private. Optimas staff will never ask you for it.',
    ],
  },
  {
    icon: 'construct-outline',
    title: 'Asking for a visit',
    steps: [
      'On Home, tap Request service (or Report a fault).',
      'Say what is wrong, for example "red light on the router since morning".',
      'If you allowed location, your position is sent so the technician finds you without calling.',
      'You are notified when a technician is assigned.',
    ],
  },
  {
    icon: 'map-outline',
    title: 'Following your technician',
    steps: ['When a visit is booked, open it on Home and tap Follow on the map.', 'You see where the technician is and about when they will arrive. It updates every few seconds.'],
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Messages',
    steps: ['Message your technician from the visit card, or the office from Chat with us.', 'Replies appear in Messages and as a notification if alerts are on.'],
  },
  {
    icon: 'star-outline',
    title: 'After the visit',
    steps: ['Rate the visit from Home. Your rating goes to the office and the technician.'],
  },
  {
    icon: 'key-outline',
    title: 'Forgot your password',
    steps: ['Contact Optimas support (below). The office gives you a new one-time password, and you choose a new password when you sign in.'],
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Your information',
    steps: [
      'Account → Download my data gives you a copy of everything the app holds about you.',
      'Account → Delete my account closes your account and removes your name, phone, e-mail and location.',
      'Location sharing can be turned off any time in Account.',
    ],
  },
];

const TECHNICIAN: Topic[] = [
  {
    icon: 'log-in-outline',
    title: 'Signing in',
    steps: [
      'Use your staff number (for example FBI-TEC-001) and the one-time password from your supervisor.',
      'Choose your own password at the first sign-in. Never share it: everything done in the app is recorded under your name.',
      'Say Allow when the app asks for location and camera; both are needed for check-in, jobs and directions.',
    ],
  },
  {
    icon: 'scan-outline',
    title: 'Checking in and out',
    steps: [
      'Home → Check in. Take the photo with the in-app camera (gallery photos are not accepted) and tick the uniform checklist.',
      'Check in at the start of your shift. Arriving after the grace time is marked late.',
      'At the end of the day, Home → Check out with a photo. Your supervisor reviews both photos.',
    ],
  },
  {
    icon: 'briefcase-outline',
    title: 'Doing a job',
    steps: [
      'Open the job from Jobs and tap Directions for turn-by-turn navigation inside the app.',
      'At the customer: Start job (takes a "before" photo).',
      'When done: Complete job. Take the "after" photo, scan the router/ONT serial for installations, add materials used, and get the customer to sign.',
      'Your supervisor verifies the job, or sends it back with a note.',
    ],
  },
  {
    icon: 'person-add-outline',
    title: 'Onboarding a customer',
    steps: [
      'On the installation job, tap Onboard customer (or Home → Onboard customer).',
      'Check the name, phone and address, stand at the premises so the location pin is right, then Create customer account.',
      'Share the sign-in details with the customer straight away: the one-time password is shown only once.',
    ],
  },
  {
    icon: 'cube-outline',
    title: 'Devices and stock',
    steps: [
      'Devices issued to you wait in My stock until you tap Confirm receipt. Only confirm what you physically received.',
      'Run a stock count from My stock when asked: scan every router and ONT you have.',
    ],
  },
  {
    icon: 'cloud-offline-outline',
    title: 'No network',
    steps: ['Check-ins and job steps done without signal are saved on the phone and sent automatically when you are back online. Keep the app installed and signed in until they are sent.'],
  },
  {
    icon: 'location-outline',
    title: 'Location',
    steps: [
      'Your position is shared only while the Optimas app is open, and only if you allowed it.',
      'It is used for directions, sending you the nearest jobs, and showing customers you are on the way. You can turn it off in Profile.',
    ],
  },
];

/** Sign-in and how-to help for customers and technicians (public: reachable from the sign-in page). */
export default function Help() {
  const params = useLocalSearchParams<{ who?: Who }>();
  const [who, setWho] = useState<Who>(params.who === 'technician' ? 'technician' : 'customer');
  const info = usePublicInfo();
  const topics = who === 'customer' ? CUSTOMER : TECHNICIAN;
  const s = info?.support;

  return (
    <Screen>
      <PageHeader title="Help" subtitle="How to use the Optimas app" right={null} onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
      <Segmented<Who>
        options={[
          { value: 'customer', label: 'For customers' },
          { value: 'technician', label: 'For technicians' },
        ]}
        value={who}
        onChange={setWho}
      />

      {topics.map((t, i) => (
        <Reveal key={`${who}-${t.title}`} index={Math.min(i, 8)}>
          <Glass strong style={{ gap: 10 }}>
            <View style={styles.head}>
              <View style={styles.icon}>
                <Ionicons name={t.icon} size={20} color={colors.onHighlight} />
              </View>
              <Text variant="title" style={{ flex: 1 }}>
                {t.title}
              </Text>
            </View>
            {t.steps.map((step, n) => (
              <View key={step} style={styles.step}>
                <Text variant="label" style={styles.n}>
                  {n + 1}
                </Text>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {step}
                </Text>
              </View>
            ))}
          </Glass>
        </Reveal>
      ))}

      <Glass strong style={{ gap: 10 }}>
        <Text variant="title">Still stuck?</Text>
        <Text variant="bodySm" color={colors.textMuted}>
          {who === 'technician' ? 'Ask your supervisor first. ' : ''}You can also reach {info?.company ?? 'Optimas'}:
        </Text>
        {s?.phone ? <Contact icon="call-outline" label={`Call ${s.phone}`} onPress={() => call(s.phone)} /> : null}
        {s?.whatsapp ? <Contact icon="logo-whatsapp" label="WhatsApp us" onPress={() => whatsapp(s.whatsapp!)} /> : null}
        {s?.email ? <Contact icon="mail-outline" label={s.email} onPress={() => void Linking.openURL(`mailto:${s.email}`)} /> : null}
        <Contact icon="globe-outline" label="optimaswifi.co.ke" onPress={() => void Linking.openURL('https://optimaswifi.co.ke')} />
      </Glass>

      <View style={styles.legal}>
        <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link">
          <Text variant="bodySm" style={styles.link}>
            Privacy Policy
          </Text>
        </Pressable>
        <Text variant="bodySm" color={colors.textDim}>
          ·
        </Text>
        <Pressable onPress={() => router.push('/terms')} accessibilityRole="link">
          <Text variant="bodySm" style={styles.link}>
            Terms of Service
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Contact({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.contact, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text variant="bodySm" style={{ fontFamily: fonts.semibold }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.highlight, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  n: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceAlt, textAlign: 'center', lineHeight: 22, fontFamily: fonts.bold, overflow: 'hidden' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: space.lg },
  link: { fontFamily: fonts.semibold, textDecorationLine: 'underline', color: colors.navy },
});
