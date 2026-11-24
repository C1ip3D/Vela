import { Hono } from "hono";

export const privacy = new Hono();

const UPDATED = "November 24, 2026";

const sections: { title: string; body: string[] }[] = [
  {
    title: "Overview",
    body: [
      "Tally helps students track grades, assignments and schedules from Infinite Campus. This policy explains what Tally handles and why. Tally is a student project and is not affiliated with or endorsed by Infinite Campus or your school district.",
    ],
  },
  {
    title: "Your Infinite Campus login",
    body: [
      "You sign in on your district's own Infinite Campus page inside the app. Your Infinite Campus username and password are entered there and are never sent to Tally's servers.",
      'After sign-in, your Infinite Campus session is stored in the iOS Keychain on your device. If you turn on "Stay signed in", saved login details are also kept in the Keychain so Tally can sign you in again. You can remove them any time with "Forget saved login" in Settings.',
    ],
  },
  {
    title: "Data we collect",
    body: [
      "<ul><li>Account identity: your Infinite Campus person details (such as name and district) used to create a Tally account through Firebase Authentication.</li><li>Academic data: courses, teachers, assignments, scores and grades, and your class schedule.</li><li>Derived data: grade history snapshots, GPA snapshots and change notes (for example, a grade that went up or down).</li></ul>",
    ],
  },
  {
    title: "How the data is used",
    body: [
      "Grades, assignments and schedules are fetched directly from Infinite Campus on your device and shown in the app. As a best-effort extra, Tally copies this data to its server so it can keep grade history and calculate GPA trends.",
      "We use your data only to run Tally's features. We do not sell it, rent it, or use it for advertising or tracking.",
    ],
  },
  {
    title: "Where it is stored",
    body: [
      "Server-side data is kept in a Postgres database hosted on Render, and sign-in is handled by Google Firebase Authentication. Grade history older than 30 days is removed automatically. Data is encrypted in transit using HTTPS.",
    ],
  },
  {
    title: "Sharing",
    body: [
      "Your data is not shared with other students, parents or third parties. It is processed only by the services Tally depends on to operate: Firebase (sign-in), Render (hosting) and your district's Infinite Campus server.",
    ],
  },
  {
    title: "Your choices",
    body: [
      '<ul><li>Sign out in Settings to clear the Infinite Campus session from your device.</li><li>Use "Forget saved login" to delete saved login details.</li><li>Use "Delete Account" in Settings to permanently delete your Tally account and everything Tally stored on its server. Your Infinite Campus account and school records are not affected.</li><li>You can also ask for deletion through the <a href="/support">support page</a>.</li></ul>',
    ],
  },
  {
    title: "Children and students",
    body: [
      "Tally is intended for students and uses only the information your school already provides through Infinite Campus. We do not knowingly collect information beyond that, and we do not show ads.",
    ],
  },
  {
    title: "Changes",
    body: ["If this policy changes, the updated version will appear here with a new date."],
  },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tally Privacy Policy</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, system-ui, sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { margin-bottom: 4px; }
  h2 { margin-top: 32px; font-size: 1.1rem; }
  .meta { opacity: .65; margin-top: 0; }
</style>
</head>
<body>
<h1>Tally Privacy Policy</h1>
<p class="meta">Last updated ${UPDATED}</p>
${sections
  .map((s) => `<h2>${s.title}</h2>\n${s.body.map((b) => (b.startsWith("<ul>") ? b : `<p>${b}</p>`)).join("\n")}`)
  .join("\n")}
</body>
</html>`;

privacy.get("/", (c) => c.html(html));
