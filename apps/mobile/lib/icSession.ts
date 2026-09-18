import * as SecureStore from "expo-secure-store";
import type { IcSession } from "@vela/ic-client";

// Single source of truth for the persisted IC session — both the
// web-backend-proxied calls (courses, sync) and the direct-to-IC calls
// (assignments) read from this one stored session, keyed the
// same way InfiniteCampusContext already persists it.
const IC_SESSION_KEY = "vela_ic_session";
// The district (not credentials — the WebView login flow never gives Vela
// the raw password to store) selected on last successful login, so a
// reauth can jump straight to the WebView login step instead of making
// the user search for their district again.
const IC_LAST_DISTRICT_KEY = "vela_ic_last_district";

export interface StoredIcDistrict {
  district_name: string;
  district_baseurl: string;
  district_app_name: string;
}

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

export async function getLastIcDistrict(): Promise<StoredIcDistrict | null> {
  try {
    const raw = await SecureStore.getItemAsync(IC_LAST_DISTRICT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredIcDistrict;
  } catch {
    return null;
  }
}

export async function saveLastIcDistrict(district: StoredIcDistrict): Promise<void> {
  await SecureStore.setItemAsync(IC_LAST_DISTRICT_KEY, JSON.stringify(district));
}

export async function clearLastIcDistrict(): Promise<void> {
  await SecureStore.deleteItemAsync(IC_LAST_DISTRICT_KEY);
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
