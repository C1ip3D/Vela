// Finals Study Coach — priority ranker
// Formula: priority = finalWeightPct × maxGradeImprovement × gpaMultiplier
// The explicit finalWeightPct multiplier is intentional: it amplifies courses
// with heavier finals beyond what the natural improvement already reflects.

export interface AssignmentGroup {
  id: string;
  name: string;
  weight: number; // 0–100 (percentage of total grade)
  score: number | null; // IC-computed category percentage; null = no grades yet
}

export interface FinalsInput {
  id: string;
  name: string;
  courseType: string; // "AP" | "HONORS" | "STANDARD" | ...
  groups: AssignmentGroup[];
  overrideFinalWeight?: number | null; // user-set (0–1 decimal); takes precedence over IC detection
}

export interface FinalsRanked {
  id: string;
  name: string;
  courseType: string;
  currentGrade: number;
  maxAchievableGrade: number;
  maxGradeImprovement: number;
  finalWeightPct: number;
  finalWeightSource: "ic" | "override" | "default";
  gpaMultiplier: number;
  priority: number;
}

// DUSD common fallback when IC doesn't expose a "Final Exam" category
export const DUSD_DEFAULT_FINAL_WEIGHT = 0.15;

function gpaMultiplierFor(courseType: string): number {
  if (courseType === "AP") return 1.2;
  if (courseType === "HONORS") return 1.1;
  return 1.0;
}

// Returns the single group whose name contains "final" (case-insensitive).
// If zero or multiple groups match, returns null → fall back to default weight.
function detectFinalGroup(groups: AssignmentGroup[]): AssignmentGroup | null {
  const matches = groups.filter((g) => g.name.toLowerCase().includes("final"));
  return matches.length === 1 ? matches[0] : null;
}

export function rankCourses(courses: FinalsInput[]): FinalsRanked[] {
  const results: FinalsRanked[] = [];

  for (const course of courses) {
    const finalGroup = detectFinalGroup(course.groups);
    const nonFinalGroups = finalGroup
      ? course.groups.filter((g) => g.id !== finalGroup.id)
      : course.groups;

    // Only include categories that IC has scored; null-score categories are excluded
    // from both the numerator and denominator (consistent with how IC computes grades).
    const scoredNonFinal = nonFinalGroups.filter((g) => g.score !== null);

    // Without any scored non-final categories we can't meaningfully rank this course.
    if (scoredNonFinal.length === 0) continue;

    // ── Current grade ──────────────────────────────────────────────────────
    const totalWeight = scoredNonFinal.reduce((s, g) => s + g.weight, 0);
    const weightedSum = scoredNonFinal.reduce((s, g) => s + g.weight * g.score!, 0);
    const currentGrade = weightedSum / totalWeight;

    // ── Final weight resolution ────────────────────────────────────────────
    let finalWeightPct: number;
    let finalWeightSource: FinalsRanked["finalWeightSource"];

    if (course.overrideFinalWeight != null) {
      finalWeightPct = course.overrideFinalWeight;
      finalWeightSource = "override";
    } else if (finalGroup && finalGroup.weight > 0) {
      finalWeightPct = finalGroup.weight / 100;
      finalWeightSource = "ic";
    } else {
      finalWeightPct = DUSD_DEFAULT_FINAL_WEIGHT;
      finalWeightSource = "default";
    }

    // ── Max achievable grade ───────────────────────────────────────────────
    // If we detected the final group, use its actual weight value directly.
    // Otherwise estimate: scored non-final groups represent (1 - finalWeightPct)
    // of the total grade, so final = totalWeight × finalWeightPct / (1 - finalWeightPct).
    const finalAbsoluteWeight =
      finalGroup && finalGroup.weight > 0
        ? finalGroup.weight
        : totalWeight * finalWeightPct / (1 - finalWeightPct);

    const maxAchievableGrade =
      (weightedSum + finalAbsoluteWeight * 100) / (totalWeight + finalAbsoluteWeight);

    const maxGradeImprovement = maxAchievableGrade - currentGrade;

    if (maxGradeImprovement <= 0) continue;

    const multiplier = gpaMultiplierFor(course.courseType);
    const priority = finalWeightPct * maxGradeImprovement * multiplier;

    results.push({
      id: course.id,
      name: course.name,
      courseType: course.courseType,
      currentGrade: Math.round(currentGrade * 100) / 100,
      maxAchievableGrade: Math.round(maxAchievableGrade * 100) / 100,
      maxGradeImprovement: Math.round(maxGradeImprovement * 100) / 100,
      finalWeightPct,
      finalWeightSource,
      gpaMultiplier: multiplier,
      priority,
    });
  }

  return results.sort((a, b) => b.priority - a.priority);
}
