import Constants from 'expo-constants';
import { useAuth } from '../store/auth';
import { ApiError } from './errors';
import { DEMO_TOKEN } from './demoToken';

/** API base URL: EXPO_PUBLIC_API_URL env var, else app.json `extra.apiUrl`. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000/api/v1';

export { ApiError } from './errors';

type Body = Record<string, unknown> | FormData | undefined;

export async function api<T>(path: string, options: { method?: string; body?: Body } = {}): Promise<T> {
  const token = useAuth.getState().token;
  // Demo sign-in: answer from the built-in sample data, never from the server
  if (token === DEMO_TOKEN) return (await import('../demo/router')).demoRequest<T>(path, options);
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isForm ? (options.body as FormData) : options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the Optimas server. Check your internet connection.', 'NETWORK');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) useAuth.getState().logout();
    const err = json?.error ?? {};
    const detail = Array.isArray(err.details) && err.details[0]?.message;
    throw new ApiError(res.status, detail || err.message || 'Request failed', err.code, err.details);
  }
  return json as T;
}

/** Demo photos are drawn on the spot (a soft scene with a camera mark); real ones come from the server. */
const demoPhoto = (id: string) => {
  const hue = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},45%,72%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},50%,38%)'/></linearGradient></defs><rect width='600' height='800' fill='url(#g)'/><circle cx='300' cy='380' r='86' fill='none' stroke='white' stroke-opacity='.85' stroke-width='10'/><rect x='214' y='330' width='172' height='116' rx='22' fill='none' stroke='white' stroke-opacity='.85' stroke-width='10'/><circle cx='300' cy='388' r='30' fill='white' fill-opacity='.85'/><text x='300' y='560' font-family='sans-serif' font-size='30' fill='white' fill-opacity='.9' text-anchor='middle'>Demo photo</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
export const photoUrl = (id: string) => (id.startsWith('demo-') ? demoPhoto(id) : `${API_URL}/capture/photos/${id}`);
export const authHeader = (): Record<string, string> => {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
