import { Linking } from 'react-native';

export const call = (phone?: string | null) => phone && Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
export const whatsapp = (number: string, text = 'Hello Optimas, I need help with my internet.') =>
  Linking.openURL(`https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`);

/** Turn-by-turn directions in Google Maps (app if installed, browser otherwise). Prefers exact GPS. */
export const navigate = (dest: { lat?: number | null; lng?: number | null; address?: string | null }) => {
  const target = dest.lat != null && dest.lng != null ? `${dest.lat},${dest.lng}` : dest.address;
  if (!target) return;
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`);
};
