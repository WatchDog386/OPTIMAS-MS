import { Linking } from 'react-native';

export const call = (phone?: string | null) => phone && Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
/** A Kenyan number in WhatsApp's form (2547…): 07…, 01…, +254…, 254… and 7…/1… all work. Null if it is not a number. */
export function whatsappNumber(phone?: string | null): string | null {
  const d = (phone ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('254') && d.length >= 12) return d;
  if (d.startsWith('0') && d.length === 10) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  return d.length >= 9 ? d : null;
}

/** Opens WhatsApp on a chat with this number, the message typed in and ready to send (or the contact picker when no number). */
export const whatsapp = (number: string | null | undefined, text = 'Hello Optimas, I need help with my internet.') =>
  Linking.openURL(`https://wa.me/${whatsappNumber(number) ?? ''}?text=${encodeURIComponent(text)}`);
