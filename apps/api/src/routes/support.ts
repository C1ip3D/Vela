import { Hono } from "hono";

export const support = new Hono();

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** GET /support: the App Store "Support URL". Set SUPPORT_EMAIL on the server to show a contact address. */
support.get("/", (c) => {
  const email = process.env.SUPPORT_EMAIL?.trim();
  const contact = email
    ? `<p>Email <a href="mailto:${escape(email)}">${escape(email)}</a> and we'll get back to you.</p>`
    : `<p>Use the developer contact on Tally's App Store page.</p>`;
  return c.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tally Support</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, system-ui, sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
  h2 { margin-top: 32px; font-size: 1.1rem; }
</style>
</head>
<body>
<h1>Tally Support</h1>
<p>Tally shows your grades, assignments and class schedule from Infinite Campus. It's a student project and isn't affiliated with Infinite Campus or your school district.</p>
<h2>Contact</h2>
${contact}
<h2>Common questions</h2>
<p><strong>I can't find my district.</strong> Tally works with districts that use Infinite Campus. Search by your district's name and state.</p>
<p><strong>My grades look out of date.</strong> Pull down on the Grades screen to refresh. Tally shows what Infinite Campus shows.</p>
<p><strong>How do I delete my account?</strong> Open Settings in Tally and tap Delete Account. This removes everything Tally stored on its server.</p>
<p><a href="/privacy">Privacy Policy</a></p>
</body>
</html>`);
});
