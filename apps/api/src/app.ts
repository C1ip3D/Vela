import { Hono } from "hono";
import { ic } from "./routes/ic";
import { schedule } from "./routes/schedule";
import { privacy } from "./routes/privacy";
import { support } from "./routes/support";
import { account } from "./routes/account";
import { rateLimit } from "./lib/rateLimit";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/privacy", privacy);
app.route("/support", support);
app.use("/api/*", rateLimit(60, 60_000));
app.route("/api/ic", ic);
app.route("/api/schedule", schedule);
app.route("/api/account", account);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[api] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});
