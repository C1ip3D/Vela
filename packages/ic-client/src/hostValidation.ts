const IC_HOST_SUFFIX = ".infinitecampus.org";
const IC_HOST_APEX = "infinitecampus.org";

/**
 * True if `hostname` is Infinite Campus's own multi-tenant hosting domain
 * for the Campus Student portal — every real district returned by IC's own
 * district-search API (see apps/web/app/api/ic/districts) is hosted here.
 *
 * loginToIc() and fetchPersonInfo() both fetch whatever host they're given,
 * and the routes that call them (apps/web/app/api/ic/auth,
 * apps/web/app/api/ic/mint-token) go on to mint a Firebase custom token off
 * the response — so an unvalidated client-supplied host would let a caller
 * point our backend at an arbitrary server and get a token minted for an
 * identity that was never actually verified against real IC infrastructure.
 * This check closes that: only genuine IC-hosted districts are fetched.
 */
export function isValidIcDistrictHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === IC_HOST_APEX || lower.endsWith(IC_HOST_SUFFIX);
}
