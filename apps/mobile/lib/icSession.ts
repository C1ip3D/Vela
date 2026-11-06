import * as SecureStore from "expo-secure-store";
import type { IcSession } from "@vela/ic-client";

// Single source of truth for the persisted IC session — the direct-to-IC
// calls (lib/icApi.ts) and the backend calls (mint-token, best-effort DB
// sync) all read from this one stored session, keyed the same way
// InfiniteCampusContext already persists it.
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
  // Threaded through to /api/ic/mint-token so it can verify a
  // custom-domain district (not under *.infinitecampus.org) against IC's
  // own district-search API — see verifyIcDistrictHost.
  state_code: string;
}

export interface StoredIcSession {
  authToken: string; // the full IC cookie jar string
  baseUrl: string;
  appName: string;
  personId?: string;
  displayName: string | null;
  // Kept alongside the session so a later /api/ic/courses or
  // /api/ic/assignments call can re-verify baseUrl against IC's
  // district-search API without asking the user to search again — see
  // packages/ic-client/src/hostValidation.ts's verifyIcDistrictHost.
  districtName?: string;
  stateCode?: string;
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

// Opt-in ("Stay signed in" on the login WebView): the IC username/password
// the user typed into IC's own login page, kept only in this device's
// Keychain so an expired IC session can be re-established silently (see
// components/auth/SilentIcLogin.tsx). Never sent to the Vela backend.
const IC_CREDENTIALS_KEY = "vela_ic_credentials";

export interface StoredIcCredentials {
  username: string;
  password: string;
  // The district these were saved for — never replayed against another one.
  baseUrl: string;
}

export async function getStoredIcCredentials(): Promise<StoredIcCredentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(IC_CREDENTIALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredIcCredentials;
  } catch {
    return null;
  }
}

export async function saveStoredIcCredentials(credentials: StoredIcCredentials): Promise<void> {
  await SecureStore.setItemAsync(IC_CREDENTIALS_KEY, JSON.stringify(credentials), {
    // Readable after first unlock so a background refresh can re-login, but
    // never migrated to another device via backup.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearStoredIcCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(IC_CREDENTIALS_KEY);
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
