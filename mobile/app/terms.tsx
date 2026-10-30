import { LegalPage, type LegalSection } from '../src/components/LegalPage';
import { usePublicInfo } from '../src/hooks/usePublicInfo';

const UPDATED = '30 October 2026';

/** Terms of Service for staff and customers using the Optimas MS app. */
export default function Terms() {
  const info = usePublicInfo();
  const company = info?.company ?? 'Optimas Networks';
  const reach = [info?.support.email, info?.support.phone].filter(Boolean).join(' or ');

  const sections: LegalSection[] = [
    {
      title: 'About these terms',
      body: [
        `These terms apply to everyone who uses the Optimas MS app, run by ${company}. By signing in you accept them and our Privacy Policy. For staff they sit alongside your employment contract and company policies; for customers, alongside your internet service agreement. Where they conflict, the contract or agreement wins.`,
      ],
    },
    {
      title: 'Your account',
      bullets: [
        'Accounts are created by Optimas: staff by an administrator or supervisor, customers by the office or the technician who installs their service.',
        'Choose your own password at the first sign-in and keep it secret. Do not share your account or use anyone else’s: everything done in the app is recorded under the account that did it.',
        'Tell your supervisor or our office straight away if you think someone else has used your account. Changing your password signs out every other device.',
      ],
    },
    {
      title: 'Using the app honestly',
      bullets: [
        'Check-in, check-out and job photos must be real photos taken at that moment with the in-app camera, at the place they claim to show.',
        'Do not try to fake your location or the phone’s clock, alter photos, or record work, devices or payments that did not happen.',
        'Only confirm receipt of devices and materials you physically have.',
        'Do not try to get into parts of the app or data your role does not allow, interfere with the service, or copy other people’s personal data out of the app.',
        'Misuse may lead to the account being suspended and, for staff, to disciplinary action under company policy.',
      ],
    },
    {
      title: 'Messages',
      bullets: [
        'Keep chat polite and about work or your service. Do not send abusive, threatening or unlawful content.',
        'Messages are stored by Optimas and can be read by the people in the conversation; customer support messages can be read by any supervisor or administrator.',
      ],
    },
    {
      title: 'Location and camera',
      body: [
        'Some features need your location (directions, nearest technician, following a visit, pinning a customer’s premises) or your camera (proof photos, scanning). The app asks first, and works only while it is open. How this data is used is explained in the Privacy Policy.',
      ],
    },
    {
      title: 'Availability',
      body: [
        'We work to keep the app available and accurate, but it may sometimes be unavailable (for maintenance, network problems or causes outside our control). Work done without signal is saved on the phone and sent when it reconnects. Arrival times and directions are estimates.',
      ],
    },
    {
      title: 'Responsibility',
      body: [
        'The app is a tool for managing work and service. To the extent the law allows, Optimas is not responsible for losses caused by using estimates shown in the app, by events outside its reasonable control, or by someone using an account whose password its owner shared. Nothing here limits rights you have under Kenyan law, including consumer and employment protections.',
      ],
    },
    {
      title: 'Ending use',
      body: [
        'Staff accounts close when employment ends. Customers can close their account at any time in Account → Delete my account. We may suspend an account that breaks these terms. Records the law requires us to keep are kept as set out in the Privacy Policy.',
      ],
    },
    {
      title: 'Changes and law',
      body: [
        'We may update these terms; the date at the top shows the latest version, and important changes are announced in the app. These terms are governed by the laws of Kenya and disputes are for the courts of Kenya.',
        reach ? `Questions: ${reach}.` : 'Questions: contact the Optimas office through the Help page.',
      ],
    },
  ];

  return <LegalPage title="Terms of Service" updated={UPDATED} intro={`The rules for using the Optimas MS app, for ${company} staff and customers.`} sections={sections} other={{ label: 'Privacy Policy', href: '/privacy' }} />;
}
