import { router } from 'expo-router';
import { ListRow, PrivacyRows, ProfileView, Screen } from '../../src/components';
import { colors } from '../../src/theme';

/** Customer care's profile: password, privacy and sign-out (sign-out is part of the profile view). */
export default function CareProfile() {
  return (
    <Screen>
      <ProfileView>
        <ListRow icon="key-outline" iconTint={colors.text} title="Change password" onPress={() => router.push('/change-password')} />
        <ListRow icon="search" iconTint={colors.text} title="Search jobs and customers" onPress={() => router.push('/search')} />
        <PrivacyRows />
      </ProfileView>
    </Screen>
  );
}
