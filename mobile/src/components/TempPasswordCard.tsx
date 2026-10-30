import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';
import { whatsapp, whatsappNumber } from '../utils/contact';
import { Button } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';

/** The web console the person signs in at (staff and customers use the same app). */
export const APP_SIGNIN_URL = 'https://ms.optimaswifi.co.ke';

/**
 * Shows a one-time password exactly once. "Send on WhatsApp" opens a chat with the person's number
 * with the details already typed, so it only takes a tap on Send.
 */
export function TempPasswordCard({ loginId, password, name, phone }: { loginId: string; password: string; name: string; phone?: string | null }) {
  const to = whatsappNumber(phone);
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
      <Button label={to ? `Send on WhatsApp to ${phone}` : 'Send on WhatsApp'} icon="logo-whatsapp" onPress={() => void whatsapp(phone, message)} style={{ backgroundColor: '#25D366' }} />
      <Pressable onPress={() => void Share.share({ message })} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
        <Text variant="bodySm" color={colors.textMuted} style={{ textDecorationLine: 'underline' }}>
          {to ? 'Share another way' : 'No phone number saved · share another way'}
        </Text>
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  mono: { fontFamily: fonts.bold, letterSpacing: 0.6 },
  link: { fontFamily: fonts.bold, letterSpacing: 0.2, textDecorationLine: 'underline' },
});
