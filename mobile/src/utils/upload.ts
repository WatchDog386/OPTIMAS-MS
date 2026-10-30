import { Platform } from 'react-native';

/**
 * Adds a picture to multipart form data on every platform.
 * Phones accept the { uri, name, type } shorthand; browsers only send a real file, so on web the
 * picture (a data: or blob: address) is turned into a Blob first. Without this the browser sends
 * the text "[object Object]" and the server never receives the photo.
 */
export async function appendFile(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await uriToBlob(uri);
    form.append(field, blob.type ? blob : blob.slice(0, blob.size, type), name);
    return;
  }
  form.append(field, { uri, name, type } as unknown as Blob);
}

/**
 * A picture address (data: or blob:) as a Blob. A data: address is decoded here rather than fetched:
 * the site's security policy only lets the app fetch from its own server.
 */
export async function uriToBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    const meta = uri.slice(5, comma);
    const body = uri.slice(comma + 1);
    const type = meta.split(';')[0] || 'application/octet-stream';
    if (!meta.includes(';base64')) return new Blob([decodeURIComponent(body)], { type });
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }
  return (await fetch(uri)).blob();
}

/**
 * Web: the photo straight from the live camera picture on screen, as a JPEG file (no data: address to
 * decode). `uri` is for showing it; `dataUri()` gives a copy that can be saved for later when offline.
 */
export async function grabCameraFrame(quality = 0.7): Promise<{ blob: Blob; uri: string; dataUri: () => string } | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const video = Array.from(document.querySelectorAll('video')).find((v) => v.videoWidth > 0 && v.readyState >= 2);
  if (!video) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return null;
  return { blob, uri: URL.createObjectURL(blob), dataUri: () => canvas.toDataURL('image/jpeg', quality) };
}
