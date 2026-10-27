const IC_HOST_SUFFIX = ".infinitecampus.org";
const IC_HOST_APEX = "infinitecampus.org";
const IC_DISTRICT_SEARCH_URL = "https://mobile.infinitecampus.com/api/district/searchDistrict";

/**
 * True if `hostname` is Infinite Campus's own multi-tenant hosting domain
 * for the Campus Student portal. Many districts DO use this, but plenty of
 * real districts run Campus Student on their own custom domain instead
 * (e.g. `icampus.dublinusd.org`) — this check alone is a fast accept for
 * the common case, never a full rejection test. See `verifyIcDistrictHost`.
 */
export function isValidIcDistrictHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === IC_HOST_APEX || lower.endsWith(IC_HOST_SUFFIX);
}

export interface IcDistrictSearchResult {
  district_name?: string;
  district_baseurl?: string;
  district_app_name?: string;
  state_code?: string;
  staff_login_url?: string;
  student_login_url?: string;
  parent_login_url?: string;
}

/**
 * Searches Infinite Campus's public district directory. Callable from the
 * server and straight from the mobile app (no CORS in React Native). Throws
 * on a network error or non-OK response; a non-array `data` field yields [].
 */
export async function searchIcDistricts(
  query: string,
  stateCode: string
): Promise<IcDistrictSearchResult[]> {
  const response = await fetch(
    `${IC_DISTRICT_SEARCH_URL}?query=${encodeURIComponent(query)}&state=${encodeURIComponent(stateCode)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Vela Academic Navigator)",
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Infinite Campus district search responded with status: ${response.status}`);
  }
  const json: { data?: unknown } = await response.json();
  return Array.isArray(json.data) ? (json.data as IcDistrictSearchResult[]) : [];
}

function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Confirms `hostname` is a host Infinite Campus's own district-search API
 * actually returns for `districtName`/`stateCode` — used for districts on a
 * custom domain that `isValidIcDistrictHost` can't recognize by suffix
 * alone. Fails closed: any lookup/network error or no match means "not
 * verified", never "assume it's fine" (this is the same trust boundary
 * `isValidIcDistrictHost` exists for — an unverified host must never reach
 * fetchPersonInfo/loginToIc with a token-minting caller behind it).
 */
async function isKnownIcDistrictHost(
  hostname: string,
  districtName: string,
  stateCode: string
): Promise<boolean> {
  const target = hostname.toLowerCase();

  let results: IcDistrictSearchResult[];
  try {
    results = await searchIcDistricts(districtName, stateCode);
  } catch {
    return false;
  }

  return results.some((d) =>
    [d.district_baseurl, d.staff_login_url, d.student_login_url, d.parent_login_url].some(
      (url) => hostnameOf(url) === target
    )
  );
}

/**
 * Verifies `hostname` is a real Infinite Campus district host before any
 * caller fetches it server-side. Takes the fast path for districts on IC's
 * own multi-tenant domain; for a custom domain, cross-checks the claimed
 * `districtName`/`stateCode` against what IC's own district-search API
 * actually vouches for — this is what stops a caller from pointing
 * loginToIc/fetchPersonInfo at an arbitrary server (SSRF, or minting a
 * Firebase token for a response that was never verified against real IC
 * infrastructure) while still allowing the many real districts that don't
 * live on *.infinitecampus.org.
 */
export async function verifyIcDistrictHost(
  hostname: string,
  districtName: string | undefined,
  stateCode: string | undefined
): Promise<boolean> {
  if (isValidIcDistrictHost(hostname)) return true;
  if (!districtName || !stateCode) return false;
  return isKnownIcDistrictHost(hostname, districtName, stateCode);
}
