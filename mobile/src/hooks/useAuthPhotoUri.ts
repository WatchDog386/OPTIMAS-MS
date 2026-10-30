import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { authHeader, photoUrl } from '../api/client';

/**
 * Image source for a protected proof photo.
 *
 * On phones the image request can carry the bearer token in its headers. Browsers ignore the Image
 * `headers` option entirely, so on web the photo is fetched first (with the token) and handed over
 * as a local blob: address — otherwise the web console shows an empty frame for every photo.
 */
export type AuthPhotoSource = { uri: string; headers?: Record<string, string> };

export function useAuthPhotoUri(photoId: string | null | undefined): AuthPhotoSource | undefined {
  const [src, setSrc] = useState<AuthPhotoSource | undefined>(undefined);

  useEffect(() => {
    if (!photoId) {
      setSrc(undefined);
      return;
    }
    const raw = photoUrl(photoId);
    if (Platform.OS !== 'web') {
      setSrc({ uri: raw, headers: authHeader() });
      return;
    }
    // Web: the token must ride on a real fetch, then the bytes become a same-origin blob URL
    let alive = true;
    let blobUrl: string | null = null;
    fetch(raw, { headers: authHeader(), cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        if (!alive) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc({ uri: blobUrl });
      })
      .catch(() => {
        if (alive) setSrc(undefined);
      });
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [photoId]);

  return src;
}
