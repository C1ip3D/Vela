export interface WellbeingInput {
  gpaSnapshots: Array<{ recordedAt: Date; weightedGpa: number }>;
  submissions: Array<{ missing: boolean; assignmentDueDate: Date }>;
  windowDays?: number;
}

export interface WellbeingResult {
  alerts: WellbeingAlert[];
  score: number; // 0–100, higher = healthier
}

export interface WellbeingAlert {
  type: "GPA_DROP_ALERT" | "MISSING_ASSIGNMENT_ALERT";
  severity: "CRITICAL" | "WARNING";
  title: string;
  body: Record<string, unknown>;
}

export function analyzeWellbeing(input: WellbeingInput): WellbeingResult {
  const { gpaSnapshots, submissions, windowDays = 30 } = input;
  const alerts: WellbeingAlert[] = [];
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Rule 1: GPA drop > 0.2 in 14 days
  const recentSnapshots = gpaSnapshots
    .filter((s) => new Date(s.recordedAt) >= twoWeeksAgo)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (recentSnapshots.length >= 2) {
    const oldest = recentSnapshots[0].weightedGpa;
    const latest = recentSnapshots[recentSnapshots.length - 1].weightedGpa;
    const drop = oldest - latest;
    if (drop >= 0.5) {
      alerts.push({ type: "GPA_DROP_ALERT", severity: "CRITICAL", title: `GPA dropped ${drop.toFixed(2)} points in 2 weeks`, body: { fromGpa: oldest, toGpa: latest, dropAmount: drop, window: "14 days" } });
    } else if (drop >= 0.2) {
      alerts.push({ type: "GPA_DROP_ALERT", severity: "WARNING", title: `GPA dropped ${drop.toFixed(2)} points in 2 weeks`, body: { fromGpa: oldest, toGpa: latest, dropAmount: drop, window: "14 days" } });
    }
  }

  // Rule 2: Missing > 20% in window
  const windowSubmissions = submissions.filter((s) => new Date(s.assignmentDueDate) >= windowStart);
  const missingCount = windowSubmissions.filter((s) => s.missing).length;
  const totalCount = windowSubmissions.length;
  const missingRate = totalCount > 0 ? missingCount / totalCount : 0;

  if (missingRate >= 0.20 && missingCount >= 2) {
    alerts.push({ type: "MISSING_ASSIGNMENT_ALERT", severity: missingRate >= 0.35 ? "CRITICAL" : "WARNING", title: `${missingCount} of ${totalCount} assignments missing (${Math.round(missingRate * 100)}%)`, body: { missingCount, totalCount, missingRate } });
  }

  // Overall score: 100 minus deductions
  let score = 100;
  for (const a of alerts) {
    score -= a.severity === "CRITICAL" ? 30 : 15;
  }

  return { alerts, score: Math.max(0, score) };
}
