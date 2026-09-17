import * as SecureStore from "expo-secure-store";

export const SESSION_KEY = "vela_session";

export interface VelaSession {
  cookies: string;
  baseUrl: string;
  appName: string;
  personId: string;
  displayName: string;
}

export async function getSession(): Promise<VelaSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VelaSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: VelaSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

function buildHeaders(session: VelaSession): Record<string, string> {
  const xsrfToken = session.cookies
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("XSRF-TOKEN="))
    ?.split("=")[1] ?? "";

  const headers: Record<string, string> = {
    Cookie: session.cookies,
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ...(xsrfToken && { "X-XSRF-TOKEN": xsrfToken }),
    appName: session.appName,
    "X-Campus-AppName": session.appName,
    Referer: `${session.baseUrl}/portal/students/${session.appName}`,
  };
  return headers;
}

export async function icFetch(path: string, options?: { method?: string; body?: string }): Promise<Response> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const headers = buildHeaders(session);
  return fetch(`${session.baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body,
  });
}

export async function icFetchWithSession(session: VelaSession, path: string): Promise<Response> {
  const headers = buildHeaders(session);
  return fetch(`${session.baseUrl}${path}`, { headers });
}

export function appQuery(session: VelaSession): string {
  return `?appName=${encodeURIComponent(session.appName)}`;
}
