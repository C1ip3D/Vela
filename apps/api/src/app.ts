import { Hono } from "hono";
import { ic } from "./routes/ic";
import { schedule } from "./routes/schedule";

export const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/api/ic", ic);
app.route("/api/schedule", schedule);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[api] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});
