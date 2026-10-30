import { router } from 'expo-router';
import type { CustomerOverview } from '../../src/api/types';
import { ListRow, LocationSetting, PrivacyRows, ProfileView, Screen, Section } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { call, whatsapp } from '../../src/utils/contact';
import { openChatWith } from '../../src/utils/chat';

export default function Account() {
  const { data } = useApi<CustomerOverview>('/customer/overview');
  const c = data?.customer;
  return (
    <Screen>
      <ProfileView>
        <Section title="Account details">
          <ListRow icon="card-outline" title="Account number" subtitle={c?.account ?? '—'} />
          <ListRow icon="location-outline" title="Installation address" subtitle={c?.address ?? '—'} />
          <ListRow icon="call-outline" title="Phone" subtitle={c?.phone ?? '—'} />
          <ListRow icon="mail-outline" title="Email" subtitle={c?.email ?? '—'} />
        </Section>
        <LocationSetting />
        <ListRow icon="key-outline" iconTint={colors.text} title="Change password" onPress={() => router.push('/change-password')} />
        <Section title="Support" subtitle="We’re here to help">
          <ListRow icon="chatbubble-ellipses-outline" iconTint={colors.text} title="Chat with Optimas support" subtitle="Replies appear in Messages" onPress={() => openChatWith({ support: true })} />
          {data?.support.phone ? <ListRow icon="call" iconTint={colors.text} title="Call Optimas support" subtitle={data.support.phone} onPress={() => call(data.support.phone)} /> : null}
          {data?.support.whatsapp ? <ListRow icon="logo-whatsapp" iconTint="#25D366" title="Chat on WhatsApp" subtitle="Usually replies within minutes" onPress={() => whatsapp(data.support.whatsapp!)} /> : null}
        </Section>
        <Section title="Your data" subtitle="What we hold and your choices">
          <PrivacyRows />
        </Section>
      </ProfileView>
    </Screen>
  );
}
