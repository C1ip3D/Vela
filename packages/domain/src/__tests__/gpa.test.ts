import { calculateGpa } from "../gpa";
import { letterToGpaPoints, percentageToLetter } from "../grading";

describe("percentageToLetter", () => {
  test("maps boundary percentages to the correct letter", () => {
    expect(percentageToLetter(97)).toBe("A+");
    expect(percentageToLetter(93)).toBe("A");
    expect(percentageToLetter(90)).toBe("A-");
    expect(percentageToLetter(59.9)).toBe("F");
    expect(percentageToLetter(0)).toBe("F");
  });
});

describe("letterToGpaPoints", () => {
  test("applies AP/dual-enrollment +1.0 boost, capped at 5.0", () => {
    expect(letterToGpaPoints("A", "AP")).toBeCloseTo(5.0);
    expect(letterToGpaPoints("A", "DUAL_ENROLLMENT")).toBeCloseTo(5.0);
  });

  test("applies HONORS +0.5 boost", () => {
    expect(letterToGpaPoints("B", "HONORS")).toBeCloseTo(3.5);
  });

  test("applies no boost for STANDARD courses", () => {
    expect(letterToGpaPoints("B", "STANDARD")).toBeCloseTo(3.0);
  });

  test("F earns zero points regardless of course type boost", () => {
    expect(letterToGpaPoints("F", "AP")).toBe(0);
  });
});

describe("calculateGpa", () => {
  test("returns zeroed result for no courses", () => {
    expect(calculateGpa([])).toEqual({ weighted: 0, unweighted: 0, breakdown: [] });
  });

  test("weights by credit hours and applies course-type boosts to the weighted GPA only", () => {
    const result = calculateGpa([
      { courseId: "1", courseName: "AP Calc", percentage: 95, courseType: "AP", creditHours: 1 },
      { courseId: "2", courseName: "PE", percentage: 95, courseType: "STANDARD", creditHours: 1 },
    ]);
    // Both courses earn letter A (4.0 base). AP course gets +1.0 boost, capped at 5.0.
    expect(result.weighted).toBeCloseTo((5.0 + 4.0) / 2);
    expect(result.unweighted).toBeCloseTo(4.0);
  });

  test("single low-credit course doesn't get diluted by absent courses", () => {
    const result = calculateGpa([
      { courseId: "1", courseName: "Art", percentage: 85, courseType: "STANDARD", creditHours: 0.5 },
    ]);
    expect(result.unweighted).toBeCloseTo(3.0); // B (83–87%)
    expect(result.breakdown).toHaveLength(1);
  });
});
