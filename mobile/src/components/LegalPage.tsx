import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, space } from '../theme';
import { Glass } from './Glass';
import { PageHeader } from './PageHeader';
import { Screen } from './Screen';
import { Text } from './Text';

/** One section of a legal page: a heading, paragraphs and optional bullet points. */
export interface LegalSection {
  title: string;
  body?: string[];
  bullets?: string[];
}

/** Shared layout for the Privacy Policy and Terms of Service. Public: readable before signing in. */
export function LegalPage({ title, updated, intro, sections, other }: { title: string; updated: string; intro: string; sections: LegalSection[]; other: { label: string; href: '/privacy' | '/terms' } }) {
  return (
    <Screen>
      <PageHeader title={title} subtitle={`Last updated ${updated}`} right={null} onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
      <Text variant="body" color={colors.textMuted}>
        {intro}
      </Text>
      {sections.map((s, i) => (
        <Glass key={s.title} strong style={{ gap: 8 }}>
          <Text variant="title" accessibilityRole="header">
            {i + 1}. {s.title}
          </Text>
          {s.body?.map((p) => (
            <Text key={p} variant="bodySm" style={styles.p}>
              {p}
            </Text>
          ))}
          {s.bullets?.length ? (
            <View style={{ gap: 6 }}>
              {s.bullets.map((b) => (
                <View key={b} style={styles.bullet}>
                  <Text variant="bodySm" style={styles.dot}>
                    •
                  </Text>
                  <Text variant="bodySm" style={[styles.p, { flex: 1 }]}>
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Glass>
      ))}
      <View style={styles.footer}>
        <Pressable onPress={() => router.push(other.href)} accessibilityRole="link">
          <Text variant="bodySm" style={styles.link}>
            {other.label}
          </Text>
        </Pressable>
        <Text variant="bodySm" color={colors.textDim}>
          ·
        </Text>
        <Pressable onPress={() => router.push('/help')} accessibilityRole="link">
          <Text variant="bodySm" style={styles.link}>
            Help
          </Text>
        </Pressable>
        <Text variant="bodySm" color={colors.textDim}>
          ·
        </Text>
        <Pressable onPress={() => void Linking.openURL('https://www.odpc.go.ke')} accessibilityRole="link">
          <Text variant="bodySm" style={styles.link}>
            ODPC
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { lineHeight: 21 },
  bullet: { flexDirection: 'row', gap: 8 },
  dot: { fontFamily: fonts.bold, color: colors.textMuted },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: space.lg },
  link: { fontFamily: fonts.semibold, textDecorationLine: 'underline', color: colors.navy },
});
