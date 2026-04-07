import { NextResponse } from "next/server";

export async function GET() {
  const USERNAME = "101406";
  const PASSWORD = "squadcomms040810";
  const DISTRICT_URL = "https://icampus.dublinusd.org/campus";
  const APP_NAME = "dublin";

  // 1. Establish Tenancy Session
  const initRes = await fetch(`${DISTRICT_URL}/portal/students/${APP_NAME}.jsp`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
    }
  });
  const initCookies = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : initRes.headers.get("set-cookie")?.split(/,(?=\s*[A-Za-z0-9_-]+\=)/) || [];
  const initCookieStr = initCookies.map(c => c.split(";")[0].trim()).join("; ");

  // 2. Perform Authentication bound to that Tenant
  const verifyUrl = `${DISTRICT_URL}/verify.jsp`;
  const formBody = new URLSearchParams();
  formBody.append("username", USERNAME);
  formBody.append("password", PASSWORD);
  formBody.append("appName", APP_NAME);
  formBody.append("portalLoginPage", "students");
  formBody.append("portalUrl", `portal/students/${APP_NAME}.jsp`);
  formBody.append("url", "nav-wrapper");
  formBody.append("lang", "en");

  const authRes = await fetch(verifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
      "Cookie": initCookieStr
    },
    body: formBody.toString(),
    redirect: "manual"
  });

  let cookiesList = [];
  if (typeof authRes.headers.getSetCookie === "function") {
    cookiesList = authRes.headers.getSetCookie();
  } else {
    const setCookieHeader = authRes.headers.get("set-cookie") || "";
    cookiesList = setCookieHeader.split(/,(?=\s*[A-Za-z0-9_-]+\=)/);
  }
  
  const cookieMap = new Map();
  cookiesList.forEach(c => {
    const pair = c.split(";")[0].trim();
    if (pair && !pair.toLowerCase().startsWith("path=") && !pair.toLowerCase().startsWith("domain=") && !pair.toLowerCase().startsWith("expires=")) {
      const splitIdx = pair.indexOf("=");
      if (splitIdx !== -1) {
         const key = pair.substring(0, splitIdx).trim();
         const val = pair.substring(splitIdx + 1).trim();
         // Always overwrite so the LAST set-cookie wins (like browser behavior)
         cookieMap.set(key, val);
      }
    }
  });

  const authToken = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

  const headers = {
    Cookie: authToken,
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0 Safari/537.36",
  };
  
  // Fetch Legacy API with our authenticated headers
  const lRes = await fetch(`${DISTRICT_URL}/resources/portal/grades`, { headers });
  const lBody = await lRes.text();

  return NextResponse.json({
    authStatus: authRes.status,
    authLocation: authRes.headers.get("location"),
    legacyStatus: lRes.status,
    legacyBody: lBody.substring(0, 10000), // First 10k chars to inspect gradingTasks array
  });
}
