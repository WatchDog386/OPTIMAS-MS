import type { CustomerOverview } from '../../src/api/types';
import { ListRow, ProfileView, Screen, Section } from '../../src/components';
import { useApi } from '../../src/hooks/useApi';
import { colors } from '../../src/theme';
import { call, whatsapp } from '../../src/utils/contact';

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
        <Section title="Support" subtitle="We’re here to help">
          <ListRow icon="call" iconTint={colors.text} title="Call Optimas support" subtitle={data?.support.phone} onPress={() => call(data?.support.phone)} />
          <ListRow icon="logo-whatsapp" iconTint="#25D366" title="Chat on WhatsApp" subtitle="Usually replies within minutes" onPress={() => data && whatsapp(data.support.whatsapp)} />
        </Section>
      </ProfileView>
    </Screen>
  );
}
