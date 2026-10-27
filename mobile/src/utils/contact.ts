import { Linking } from 'react-native';

export const call = (phone?: string | null) => phone && Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
export const whatsapp = (number: string, text = 'Hello Optimas, I need help with my internet.') =>
  Linking.openURL(`https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`);
