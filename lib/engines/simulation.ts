import { percentageToLetter, letterToGpaPoints } from "@/lib/utils";

export interface WeightCategory {
  id: string;
  name: string;
  weight: number;
  dropLowest?: number;
}

export interface AssignmentInput {
  id: string;
  title: string;
  pointsPossible: number;
  weightCategoryId: string;
  score: number | null;
  missing: boolean;
  excused: boolean;
}

export interface PlaceholderInput {
  id: string;
  title: string;
  weightCategoryId: string;
  pointsPossible: number;
  projectedScore: number;
}

export interface SimulationInput {
  categories: WeightCategory[];
  assignments: AssignmentInput[];
  overrides: Record<string, number>;
  placeholders: PlaceholderInput[];
  courseType: string;
}

export interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  average: number;
  contribution: number;
  count: number;
  droppedCount: number;
}

export interface SimulationResult {
  projectedPercentage: number;
  projectedLetter: string;
  projectedGpaPoints: number;
  categoryBreakdown: CategoryResult[];
  overrideCount: number;
  placeholderCount: number;
}

export function calculateSimulation(input: SimulationInput): SimulationResult {
  const { categories, assignments, overrides, placeholders, courseType } = input;

  // Build effective score list per assignment
  type EffectiveItem = { weightCategoryId: string; score: number; pointsPossible: number; source: string };
  const items: EffectiveItem[] = [];

  for (const a of assignments) {
    if (a.excused) continue;
    let score: number;
    if (overrides[a.id] !== undefined) {
      score = overrides[a.id];
    } else if (a.missing || a.score === null) {
      score = 0;
    } else {
      score = a.score;
    }
    items.push({ weightCategoryId: a.weightCategoryId, score, pointsPossible: a.pointsPossible, source: overrides[a.id] !== undefined ? "override" : "real" });
  }

  for (const p of placeholders) {
    items.push({ weightCategoryId: p.weightCategoryId, score: p.projectedScore, pointsPossible: p.pointsPossible, source: "placeholder" });
  }

  // Group by category
  const grouped: Record<string, EffectiveItem[]> = {};
  for (const item of items) {
    if (!grouped[item.weightCategoryId]) grouped[item.weightCategoryId] = [];
    grouped[item.weightCategoryId].push(item);
  }

  const categoryResults: CategoryResult[] = [];
  let totalUsedWeight = 0;
  let weightedSum = 0;

  for (const cat of categories) {
    const catItems = grouped[cat.id] ?? [];
    if (catItems.length === 0) continue;

    // Sort ascending by percentage for drop-lowest
    const sorted = [...catItems].sort((a, b) => (a.score / a.pointsPossible) - (b.score / b.pointsPossible));
    const dropN = Math.min(cat.dropLowest ?? 0, sorted.length - 1);
    const effective = dropN > 0 ? sorted.slice(dropN) : sorted;

    const totalEarned = effective.reduce((s, i) => s + i.score, 0);
    const totalPossible = effective.reduce((s, i) => s + i.pointsPossible, 0);
    const avg = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

    categoryResults.push({
      id: cat.id,
      name: cat.name,
      weight: cat.weight,
      average: Math.round(avg * 10) / 10,
      contribution: Math.round(avg * cat.weight * 10) / 10,
      count: effective.length,
      droppedCount: dropN,
    });

    totalUsedWeight += cat.weight;
    weightedSum += avg * cat.weight;
  }

  const projected = totalUsedWeight > 0 ? weightedSum / totalUsedWeight : 0;
  const letter = percentageToLetter(projected);

  return {
    projectedPercentage: Math.round(projected * 10) / 10,
    projectedLetter: letter,
    projectedGpaPoints: letterToGpaPoints(letter, courseType),
    categoryBreakdown: categoryResults,
    overrideCount: Object.keys(overrides).length,
    placeholderCount: placeholders.length,
  };
}
