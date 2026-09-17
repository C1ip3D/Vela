import { rankCourses, DUSD_DEFAULT_FINAL_WEIGHT, FinalsInput } from "../finals";

// Shared helpers
function makeGroup(name: string, weight: number, score: number | null) {
  return { id: name, name, weight, score };
}

function makeCourse(overrides: Partial<FinalsInput> & Pick<FinalsInput, "id" | "name">): FinalsInput {
  return {
    courseType: "STANDARD",
    groups: [],
    ...overrides,
  };
}

// ── 1. Empty input ─────────────────────────────────────────────────────────────

test("returns empty array for no courses", () => {
  expect(rankCourses([])).toEqual([]);
});

// ── 2. Course with no scored groups is skipped ───────────────────────────────

test("skips course where all non-final groups have null score", () => {
  const course = makeCourse({
    id: "1",
    name: "History",
    groups: [
      makeGroup("Homework", 50, null),
      makeGroup("Tests", 50, null),
    ],
  });
  expect(rankCourses([course])).toHaveLength(0);
});

// ── 3. Final category detected via IC weight ──────────────────────────────────

test("uses IC final weight when a 'Final Exam' group is present", () => {
  const course = makeCourse({
    id: "2",
    name: "Chemistry",
    groups: [
      makeGroup("Classwork", 80, 90),
      makeGroup("Final Exam", 20, null),
    ],
  });
  const [result] = rankCourses([course]);
  expect(result.finalWeightSource).toBe("ic");
  expect(result.finalWeightPct).toBeCloseTo(0.2);
});

// ── 4. Falls back to DUSD default when no final group detected ────────────────

test("uses DUSD 15% default when no group name includes 'final'", () => {
  const course = makeCourse({
    id: "3",
    name: "Art",
    groups: [
      makeGroup("Projects", 60, 85),
      makeGroup("Participation", 40, 95),
    ],
  });
  const [result] = rankCourses([course]);
  expect(result.finalWeightSource).toBe("default");
  expect(result.finalWeightPct).toBeCloseTo(DUSD_DEFAULT_FINAL_WEIGHT);
});

// ── 5. Override takes precedence over IC detection ────────────────────────────

test("override weight takes precedence over IC-detected final group", () => {
  const course = makeCourse({
    id: "4",
    name: "Physics",
    overrideFinalWeight: 0.3,
    groups: [
      makeGroup("Labs", 70, 80),
      makeGroup("Final Exam", 30, null),
    ],
  });
  const [result] = rankCourses([course]);
  expect(result.finalWeightSource).toBe("override");
  expect(result.finalWeightPct).toBeCloseTo(0.3);
});

// ── 6. AP multiplier is 1.2 ──────────────────────────────────────────────────

test("AP course has gpaMultiplier of 1.2", () => {
  const course = makeCourse({
    id: "5",
    name: "AP Calc",
    courseType: "AP",
    groups: [makeGroup("Units", 100, 85)],
  });
  const [result] = rankCourses([course]);
  expect(result.gpaMultiplier).toBeCloseTo(1.2);
});

// ── 7. HONORS multiplier is 1.1 ──────────────────────────────────────────────

test("HONORS course has gpaMultiplier of 1.1", () => {
  const course = makeCourse({
    id: "6",
    name: "Honors English",
    courseType: "HONORS",
    groups: [makeGroup("Essays", 100, 75)],
  });
  const [result] = rankCourses([course]);
  expect(result.gpaMultiplier).toBeCloseTo(1.1);
});

// ── 8. maxAchievableGrade math (IC final weight) ─────────────────────────────

test("maxAchievableGrade is correct when final group is in IC", () => {
  // 80% non-final weight, scored 75. Final is 20%.
  // maxAchievable = (80*75 + 20*100) / (80+20) = (6000+2000)/100 = 80
  const course = makeCourse({
    id: "7",
    name: "Bio",
    groups: [
      makeGroup("Quizzes", 80, 75),
      makeGroup("Final Exam", 20, null),
    ],
  });
  const [result] = rankCourses([course]);
  expect(result.currentGrade).toBeCloseTo(75);
  expect(result.maxAchievableGrade).toBeCloseTo(80);
  expect(result.maxGradeImprovement).toBeCloseTo(5);
});

// ── 9. maxAchievableGrade math (DUSD default) ────────────────────────────────

test("maxAchievableGrade is correct with DUSD 15% default", () => {
  // Non-final total weight = 100, score = 70.
  // finalAbsoluteWeight = 100 * 0.15 / 0.85 ≈ 17.647
  // maxAchievable = (100*70 + 17.647*100) / (100+17.647) ≈ (7000+1764.7)/117.647 ≈ 74.5
  const course = makeCourse({
    id: "8",
    name: "Spanish",
    groups: [makeGroup("Assignments", 100, 70)],
  });
  const [result] = rankCourses([course]);
  const finalAbs = 100 * 0.15 / 0.85;
  const expected = (100 * 70 + finalAbs * 100) / (100 + finalAbs);
  expect(result.maxAchievableGrade).toBeCloseTo(expected, 1);
});

// ── 10. Course already at 100% is excluded ────────────────────────────────────

test("course with zero grade improvement is excluded from results", () => {
  const course = makeCourse({
    id: "9",
    name: "PE",
    groups: [
      makeGroup("Participation", 80, 100),
      makeGroup("Final Exam", 20, null),
    ],
  });
  // currentGrade = 100, maxAchievable = 100, improvement = 0 → excluded
  expect(rankCourses([course])).toHaveLength(0);
});

// ── 11. Multiple courses are sorted by priority descending ────────────────────

test("courses are sorted by priority (highest first)", () => {
  const lowImpact = makeCourse({
    id: "low",
    name: "Drama",
    courseType: "STANDARD",
    groups: [
      makeGroup("Projects", 80, 98),
      makeGroup("Final Exam", 20, null),
    ],
  });
  const highImpact = makeCourse({
    id: "high",
    name: "AP Calc",
    courseType: "AP",
    groups: [
      makeGroup("Tests", 80, 60),
      makeGroup("Final Exam", 20, null),
    ],
  });

  const ranked = rankCourses([lowImpact, highImpact]);
  expect(ranked[0].id).toBe("high");
  expect(ranked[1].id).toBe("low");
  expect(ranked[0].priority).toBeGreaterThan(ranked[1].priority);
});

// ── 12. Fuzzy match: multiple groups with "final" → fallback to default ───────

test("falls back to default when multiple groups match 'final'", () => {
  const course = makeCourse({
    id: "12",
    name: "Econ",
    groups: [
      makeGroup("Midterm Final", 25, 80),
      makeGroup("Final Exam", 25, null),
      makeGroup("Homework", 50, 85),
    ],
  });
  // Two matches → falls back to default
  const [result] = rankCourses([course]);
  expect(result.finalWeightSource).toBe("default");
});
