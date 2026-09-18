import type { IcSession } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

export function buildIcHeaders(session: IcSession): Record<string, string> {
  const xsrfToken = session.cookies
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("XSRF-TOKEN="))
    ?.split("=")[1] ?? "";

  return {
    Cookie: session.cookies,
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    ...(xsrfToken && { "X-XSRF-TOKEN": xsrfToken }),
    ...(session.appName && {
      appName: session.appName,
      "X-Campus-AppName": session.appName,
      Referer: `${session.baseUrl}/portal/students/${session.appName}`,
    }),
  };
}

export function icAppQuery(session: IcSession): string {
  return session.appName ? `?appName=${encodeURIComponent(session.appName)}` : "";
}

/** Fetches a path relative to the session's IC district base URL, with auth headers attached. */
export async function icFetch(session: IcSession, path: string): Promise<Response> {
  return fetch(`${session.baseUrl}${path}`, { headers: buildIcHeaders(session) });
}
