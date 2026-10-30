import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface PublicInfo {
  company: string;
  address: string | null;
  support: { phone: string | null; whatsapp: string | null; email: string | null };
  privacyEmail: string | null;
  retention: { locationTrailDays: number; notificationDays: number; unusedPhotoDays: number; captureChallengeDays: number };
}

let cached: PublicInfo | null = null;

/** Who runs the app and how to reach them (public; used by the help, privacy and terms pages). */
export function usePublicInfo() {
  const [info, setInfo] = useState<PublicInfo | null>(cached);
  useEffect(() => {
    if (cached) return;
    api<PublicInfo>('/public/info')
      .then((i) => {
        cached = i;
        setInfo(i);
      })
      .catch(() => undefined);
  }, []);
  return info;
}
