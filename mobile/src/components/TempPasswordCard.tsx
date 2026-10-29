import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';

/** The web console the person signs in at (staff and customers use the same app). */
export const APP_SIGNIN_URL = 'https://ms.optimaswifi.co.ke';

/** Shows a one-time password exactly once, with a share button. */
export function TempPasswordCard({ loginId, password, name }: { loginId: string; password: string; name: string }) {
  const message = `Optimas MS sign-in for ${name}\nOpen: ${APP_SIGNIN_URL}\nUser: ${loginId}\nTemporary password: ${password}\nYou will be asked to choose your own password when you sign in.`;
  return (
    <Glass strong style={{ gap: 12, borderColor: colors.highlight, borderWidth: 2 }}>
      <Text variant="label" color={colors.textMuted}>
        One-time sign-in details — shown only now
      </Text>
      <View style={styles.row}>
        <Text variant="bodySm" color={colors.textMuted}>
          Open
        </Text>
        <Pressable onPress={() => void Linking.openURL(APP_SIGNIN_URL)} accessibilityRole="link" accessibilityLabel={`Open ${APP_SIGNIN_URL}`}>
          <Text variant="title" style={styles.link} selectable>
            {APP_SIGNIN_URL}
          </Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <Text variant="bodySm" color={colors.textMuted}>
          User
        </Text>
        <Text variant="title" selectable style={styles.mono}>
          {loginId}
        </Text>
      </View>
      <View style={styles.row}>
        <Text variant="bodySm" color={colors.textMuted}>
          Password
        </Text>
        <Text variant="h2" selectable style={styles.mono}>
          {password}
        </Text>
      </View>
      <Button label="Share sign-in details" icon="share-outline" variant="secondary" onPress={() => void Share.share({ message })} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  mono: { fontFamily: fonts.bold, letterSpacing: 0.6 },
  link: { fontFamily: fonts.bold, letterSpacing: 0.2, textDecorationLine: 'underline' },
});
