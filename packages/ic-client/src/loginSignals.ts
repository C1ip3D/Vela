// Shared success/failure signals for Infinite Campus's login flow
// (GET portal/students/<appName>.jsp -> user submits IC's own form ->
// POST verify.jsp -> redirect). Used by auth.ts's server-side loginToIc()
// (web) and by the mobile WebView login flow, which watches for the same
// redirect/DOM markers via navigation events instead of raw HTTP headers.

export const IC_LOGIN_FAILURE_URL_MARKERS = [
  "error",
  "failed",
  "verify.jsp",
  "login",
  "noappname",
] as const;

export const IC_LOGIN_FAILURE_BODY_MARKERS = [
  "username and/or password",
  "error in the application",
  "signinform",
] as const;

export function isFailedIcRedirectUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return IC_LOGIN_FAILURE_URL_MARKERS.some((marker) => lower.includes(marker));
}

export function containsIcFailureMarkers(body: string): boolean {
  const lower = body.toLowerCase();
  return IC_LOGIN_FAILURE_BODY_MARKERS.some((marker) => lower.includes(marker));
}
