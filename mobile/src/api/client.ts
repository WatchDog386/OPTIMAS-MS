import Constants from 'expo-constants';
import { useAuth } from '../store/auth';

/** API base URL: EXPO_PUBLIC_API_URL env var, else app.json `extra.apiUrl`. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | FormData | undefined;

export async function api<T>(path: string, options: { method?: string; body?: Body } = {}): Promise<T> {
  const token = useAuth.getState().token;
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

export const photoUrl = (id: string) => `${API_URL}/capture/photos/${id}`;
export const authHeader = (): Record<string, string> => {
  const token = useAuth.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
