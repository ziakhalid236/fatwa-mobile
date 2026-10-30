import { API_BASE_URL, getDeviceId } from '@/lib/store';

export const GOOGLE_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
};
export const googleConfigured = Boolean(GOOGLE_IDS.web || GOOGLE_IDS.android);

export type AuthResult = {
  sessionToken: string;
  needsProfile: boolean;
  user: { id?: string; name?: string; country?: string; city?: string; avatarUrl?: string; email?: string; bio?: string };
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Something went wrong. Please try again.');
  return payload;
}

export async function authConfig(): Promise<{ google: boolean; email: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/config`);
    return response.ok ? await response.json() : { google: false, email: false };
  } catch {
    return { google: false, email: false };
  }
}

export const startEmail = (email: string) => post<{ ok: true }>('/auth/email/start', { email });
export const verifyEmail = async (email: string, code: string) => post<AuthResult>('/auth/email/verify', { email, code, deviceId: await getDeviceId() });
export const googleSignIn = async (idToken: string) => post<AuthResult>('/auth/google', { idToken, deviceId: await getDeviceId() });
