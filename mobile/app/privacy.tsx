import { LegalPage, type LegalSection } from '../src/components/LegalPage';
import { usePublicInfo } from '../src/hooks/usePublicInfo';

const UPDATED = '30 October 2026';

/**
 * Privacy Policy, written for the Kenya Data Protection Act, 2019. It describes what the app really does;
 * when the app changes how it uses personal data, this page must change with it.
 */
export default function Privacy() {
  const info = usePublicInfo();
  const company = info?.company ?? 'Optimas Networks';
  const contact = [info?.privacyEmail && `e-mail ${info.privacyEmail}`, info?.support.phone && `phone ${info.support.phone}`, info?.address && `write to ${company}, ${info.address}`].filter(Boolean).join('; ');
  const r = info?.retention ?? { locationTrailDays: 3, notificationDays: 180, unusedPhotoDays: 1, captureChallengeDays: 1 };

  const sections: LegalSection[] = [
    {
      title: 'Who we are',
      body: [
        `The Optimas MS app is run by ${company} ("we"). We decide how the personal data in the app is used, which makes us the data controller under the Kenya Data Protection Act, 2019.`,
        contact ? `Questions, requests and complaints about your data: ${contact}.` : 'Questions, requests and complaints about your data: contact the Optimas office through the Help page.',
      ],
    },
    {
      title: 'Who this covers',
      body: ['Our staff who use the app (administrators, supervisors, storekeepers and technicians) and our internet customers who have an app account. The app is not meant for anyone under 18.'],
    },
    {
      title: 'What we collect',
      bullets: [
        'Account details: name, staff or account number, role, phone, e-mail, region and (customers) the premises address. Passwords are stored only in scrambled (hashed) form; nobody at Optimas can read them.',
        'Staff attendance: check-in and check-out times, the photo taken with the in-app camera at each, the uniform checklist, and the phone’s GPS position and clock at that moment.',
        'Work records: jobs, before and after photos (with GPS position and time), devices and materials used, serial numbers, the customer’s signature on installations, payments collected and notes.',
        'Location while the app is open (only if you allow it): technicians’ positions to show where they are, give directions and find the nearest technician for a job; customers’ positions to pin their premises. We never collect location while the app is closed.',
        'Messages sent in the app’s chat, customer service requests and visit ratings.',
        'Device details needed to send notifications (a notification address issued by your phone or browser) and basic technical logs (time, address of the request, errors) used to keep the service secure.',
      ],
    },
    {
      title: 'Why we use it, and on what legal basis',
      bullets: [
        'To run the work you do with us: attendance, jobs, stock, visits and support (performance of the employment or service contract).',
        'To prove work was really done and prevent fraud or loss of company equipment: camera-only photos, GPS position and device time (our legitimate interest in accountable field work and stock).',
        'To keep employment, tax and accounting records the law requires (legal obligation).',
        'Live location sharing and notifications: only with your consent, which you can withdraw at any time in Profile (staff) or Account (customers) and in your phone or browser settings.',
        'We do not sell personal data, use it for advertising, or make decisions about you by automated means alone. Late arrivals, photo flags and job reviews are always looked at by a person.',
      ],
    },
    {
      title: 'Who can see it',
      bullets: [
        'Inside Optimas, people see only what their job needs: supervisors and administrators see staff attendance, photos and locations; the store sees stock and job photos (not staff check-in photos); technicians see their own records and the customers on their own jobs.',
        'Customers see their own account, their visits and the name, phone and live position of the technician coming to them (only while that visit is under way).',
        'Service providers that help run the app, under confidentiality: our server and backup hosting; map images from OpenStreetMap (your device asks it for the map of the area on screen); road directions (OSRM) and address look-up (Nominatim), which receive coordinates or a job address without names; and the push services of Google, Apple, Mozilla or Microsoft, which carry notifications to your device.',
        'Authorities, only when the law requires it.',
      ],
    },
    {
      title: 'Data sent outside Kenya',
      body: [
        'Some service providers (map, routing and notification services, and off-site backup storage) may store or process data outside Kenya. We use them only with appropriate safeguards as required by section 48 of the Act; off-site backups are encrypted on our server before they are sent, so the storage provider cannot read them.',
      ],
    },
    {
      title: 'How long we keep it',
      bullets: [
        `Location trail (where a technician has driven): ${r.locationTrailDays} days. The last known position is kept until replaced or until you turn location off, which deletes it.`,
        `In-app notifications: ${r.notificationDays} days.`,
        `Photos taken but never used for a check-in or job: ${r.unusedPhotoDays} day.`,
        'Attendance, job and stock records and their photos: for as long as needed for the employment or customer relationship and for legal, tax and accounting purposes, then deleted or anonymised.',
        'Backups: kept for up to 60 days, then overwritten.',
      ],
    },
    {
      title: 'Your rights',
      bullets: [
        'See the data we hold about you: Profile or Account → Download my data gives you a full copy straight away.',
        'Correct it: ask your supervisor or our office to fix anything wrong.',
        'Delete it: customers can close their account in Account → Delete my account (visit and payment records are kept without your name, as the law requires). Staff ask an administrator; some employment records must be kept by law.',
        'Object to or restrict a use of your data, and withdraw consent for location or notifications at any time.',
        'Complain to the Office of the Data Protection Commissioner (www.odpc.go.ke) if you are not happy with how we handle your data. We would appreciate the chance to fix it first.',
      ],
    },
    {
      title: 'How we protect it',
      bullets: [
        'All traffic between the app and our server is encrypted (HTTPS).',
        'Passwords are hashed; repeated wrong passwords pause an account; a password change signs out every other device.',
        'Every person sees only what their role allows, and administrative actions are recorded in an audit log.',
        'Photos are only served to signed-in people allowed to see them, and only photos taken with the in-app camera are accepted.',
        'If a breach puts your data at risk, we will tell the Data Protection Commissioner within 72 hours and tell you without delay, as the Act requires.',
      ],
    },
    {
      title: 'Changes to this policy',
      body: ['When we change how we use personal data we update this page and the date at the top, and tell app users about important changes in the app.'],
    },
  ];

  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro={`How ${company} collects, uses and protects personal data in the Optimas MS app, and the rights you have over it.`}
      sections={sections}
      other={{ label: 'Terms of Service', href: '/terms' }}
    />
  );
}
