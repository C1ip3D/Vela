import * as SecureStore from "expo-secure-store";
import type { IcSession } from "@vela/ic-client";

// Single source of truth for the persisted IC session — both the
// web-backend-proxied calls (courses, sync) and the direct-to-IC calls
// (assignments, schedule) read from this one stored session, keyed the
// same way InfiniteCampusContext already persists it.
const IC_SESSION_KEY = "vela_ic_session";

export interface StoredIcSession {
  authToken: string; // the full IC cookie jar string
  baseUrl: string;
  appName: string;
  personId?: string;
  displayName: string | null;
}

export async function getStoredIcSession(): Promise<StoredIcSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(IC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredIcSession;
  } catch {
    return null;
  }
}

export async function saveStoredIcSession(session: StoredIcSession): Promise<void> {
  await SecureStore.setItemAsync(IC_SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredIcSession(): Promise<void> {
  await SecureStore.deleteItemAsync(IC_SESSION_KEY);
}

export function toIcSession(session: StoredIcSession): IcSession {
  return {
    cookies: session.authToken,
    baseUrl: session.baseUrl,
    appName: session.appName,
    personId: session.personId,
    displayName: session.displayName,
  };
}
