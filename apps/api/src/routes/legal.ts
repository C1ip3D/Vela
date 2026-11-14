import { Hono } from "hono";

export const legal = new Hono();

// Set on the server (Render) so the published pages name a real contact. Until it is set, the pages point people
// at the support link on the App Store listing instead of showing a placeholder address.
const contactEmail = () => process.env.VELA_CONTACT_EMAIL?.trim() || null;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);

function contactHtml(): string {
  const email = contactEmail();
  if (!email) return "use the support link on Vela's App Store page";
  const safe = escapeHtml(email);
  return `email <a href="mailto:${safe}">${safe}</a>`;
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Vela</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0a0d12; color: #f3eee6; font: 17px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 30px; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 32px 0 8px; color: #cfb896; }
  p, li { color: #d6d3cd; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
  a { color: #86aedd; }
  .meta { color: #a7a9ae; font-size: 15px; }
</style>
</head>
<body><main>
${body}
</main></body>
</html>`;
}

/**
 * GET /privacy — Vela's privacy policy. Linked from the app (Login and Settings) and from the App Store listing,
 * as App Store Review Guideline 5.1.1(i) requires. Keep it in step with what the app and this server actually do:
 * if a new kind of data is collected or stored, it has to be described here first.
 */
legal.get("/privacy", (c) =>
  c.html(
    page(
      "Privacy Policy",
      `<h1>Privacy Policy</h1>
<p class="meta">Vela · Last updated November 14, 2026</p>

<p>Vela shows a student their own grades, assignments and class schedule from their school's Infinite Campus
account. This page explains what Vela collects, where it is kept, and how to delete it. Vela is an independent app
and is not affiliated with, endorsed by or sponsored by Infinite Campus, Inc. or any school district.</p>

<h2>What Vela collects</h2>
<ul>
  <li><strong>Your Infinite Campus sign-in session.</strong> You sign in on your district's own Infinite Campus page
  inside the app. The resulting session is stored in your device's Keychain and used by the app to load your data
  directly from your district. It is also sent to Vela's server, which uses it once per request to confirm who you are
  and to read your courses and grades. The server does not store it.</li>
  <li><strong>Your Infinite Campus username and password, only if "Stay signed in" is on.</strong> They are saved in
  your device's Keychain so the app can sign you back in when your session expires. They are entered only on your
  district's Infinite Campus page and are never sent to Vela's server.</li>
  <li><strong>Account details.</strong> Your name as Infinite Campus reports it, your district, and your Infinite
  Campus person ID, which Vela uses to recognise your account.</li>
  <li><strong>School records.</strong> Your courses, teachers, current grades, assignment scores, missing-assignment
  counts, class schedule and any bell times you save. Vela's server keeps a copy of these, along with a history of
  grade changes and GPA snapshots.</li>
</ul>
<p>Vela does not collect your location, contacts, photos, advertising identifier or device identifiers, and it
contains no advertising and no third-party analytics.</p>

<h2>How it is used</h2>
<p>Only to provide the app: showing your grades and schedule, calculating GPA, and keeping a history of how your
grades change. Vela does not sell your data, does not use it for advertising, and does not track you across other
apps or websites.</p>

<h2>Who it is shared with</h2>
<p>Vela shares data only with the service providers that run it, and only so they can do that job: Google Firebase
(account sign-in) and the companies that host Vela's server and database. They are required to protect it and may
not use it for their own purposes. Vela does not share your data with anyone else unless the law requires it.</p>

<h2>How long it is kept</h2>
<p>Grade history on the server is trimmed to roughly the last 30 days. Everything else is kept until you delete your
account. Signing out removes your session, saved login and cached grades from your device.</p>

<h2>Deleting your data</h2>
<p>In the app, open <strong>Settings</strong> and choose <strong>Delete account and data</strong>. This permanently
deletes your Vela account and every record Vela's server holds about you, and signs you out. It does not change
anything in Infinite Campus, which belongs to your school. To stop Vela saving your password without deleting your
account, choose <strong>Forget saved login</strong> in Settings. If you cannot use the app, ${contactHtml()} and ask
for your data to be deleted.</p>

<h2>Students and families</h2>
<p>Vela is meant for students who already have an Infinite Campus account from their school, and it only ever shows
a student their own records. A parent or guardian who wants a student's Vela data deleted can do so from the app's
Settings or by contacting us.</p>

<h2>Changes and contact</h2>
<p>If this policy changes, the new version will be posted here with a new date. For questions, ${contactHtml()}.</p>`
    )
  )
);

/** GET /support — the Support URL for the App Store listing. */
legal.get("/support", (c) =>
  c.html(
    page(
      "Support",
      `<h1>Vela Support</h1>
<p class="meta">Help with the Vela app</p>

<h2>Signing in</h2>
<p>Pick your state and district, then sign in on your district's own Infinite Campus page with the username and
password your school gave you. Vela cannot reset that password; ask your school. Districts that sign in through a
separate single sign-on provider may not be supported yet.</p>

<h2>Grades or schedule look wrong</h2>
<p>Vela shows what Infinite Campus reports. Pull down on any screen to refresh. If it still differs from the Infinite
Campus website, your teacher or school office is the source of truth.</p>

<h2>Deleting your account</h2>
<p>Open <strong>Settings</strong> in the app and choose <strong>Delete account and data</strong>. See the
<a href="/privacy">privacy policy</a> for what that removes.</p>

<h2>Contact</h2>
<p>For anything else, ${contactHtml()}.</p>`
    )
  )
);
