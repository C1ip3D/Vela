// app/api/classroom/assignments/route.ts
// Fetches courseWork + student submissions for a single Classroom course,
// then stitches them together into the same AssignmentGroup shape used by
// the Canvas assignments endpoint.
//
// POST { token, courseId, weightTemplates?: WeightTemplate[] }
// → { groups: AssignmentGroup[] }

import { NextRequest, NextResponse } from "next/server";
import {
  classroomClient,
  ClassroomCourseWork,
  ClassroomStudentSubmission,
} from "@/lib/classroom/client";

interface WeightTemplate {
  id: string;
  name: string;
  weight: number; // fraction 0–1
  dropLowest?: number;
}

function parseDueDate(dueDate?: {
  year: number;
  month: number;
  day: number;
}): string | null {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  return new Date(year, month - 1, day).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const { token, courseId, weightTemplates } = await req.json();
    if (!token || !courseId) {
      return NextResponse.json(
        { error: "Missing token or courseId" },
        { status: 400 }
      );
    }

    const [courseWorkList, submissionList] = await Promise.all([
      classroomClient.getCourseWork(courseId, token),
      classroomClient.getSubmissions(courseId, token),
    ]);

    // Build a submission lookup: courseWorkId → submission
    const subMap = new Map<string, ClassroomStudentSubmission>();
    for (const sub of submissionList) {
      subMap.set(sub.courseWorkId, sub);
    }

    // If the user has defined weight templates, group assignments by category.
    // Otherwise, fall back to a single "All Assignments" group with no weights.
    const templates: WeightTemplate[] =
      weightTemplates && weightTemplates.length > 0
        ? weightTemplates
        : [{ id: "ungrouped", name: "All Assignments", weight: 1.0, dropLowest: 0 }];

    // Build groups — without weights we assign everything to the single group.
    // With weights we can't auto-assign (we don't know the category), so we
    // leave all assignments in "Uncategorized" and let the user drag-assign
    // in the UI (future enhancement). For now, ungrouped = single group.
    const hasUserTemplates = weightTemplates && weightTemplates.length > 0;

    // If no templates, one flat group
    if (!hasUserTemplates) {
      const assignments = courseWorkList.map((cw: ClassroomCourseWork) => {
        const sub = subMap.get(cw.id);
        return {
          id: cw.id,
          name: cw.title,
          pointsPossible: cw.maxPoints ?? 100,
          score:
            sub?.assignedGrade !== undefined ? sub.assignedGrade : null,
          grade: null,
          submittedAt: null,
          missing:
            sub
              ? sub.assignedGrade === undefined && sub.state !== "TURNED_IN"
              : false,
          late: sub?.late ?? false,
          dueAt: parseDueDate(cw.dueDate),
          source: "CLASSROOM",
        };
      });

      // Compute group score
      const scored = assignments.filter(
        (a) => a.score !== null && a.pointsPossible > 0
      );
      const earned = scored.reduce((s, a) => s + (a.score ?? 0), 0);
      const possible = scored.reduce((s, a) => s + a.pointsPossible, 0);
      const groupScore = possible > 0 ? (earned / possible) * 100 : null;

      return NextResponse.json({
        groups: [
          {
            id: "ungrouped",
            name: "All Assignments",
            weight: 0, // 0 = unweighted — calcCourseGrade handles this fallback
            score: groupScore,
            assignments,
          },
        ],
        hasWeightTemplates: false,
      });
    }

    // With templates: build one AssignmentGroup per template.
    // Since Classroom has no category metadata on assignments, we initially put
    // ALL assignments in an "Uncategorized" group. The weight-aware grade calc
    // is done once the user has assigned each assignment to a category.
    // (Auto-assignment via name matching is a future enhancement.)
    const allAssignments = courseWorkList.map((cw: ClassroomCourseWork) => {
      const sub = subMap.get(cw.id);
      return {
        id: cw.id,
        name: cw.title,
        pointsPossible: cw.maxPoints ?? 100,
        score: sub?.assignedGrade !== undefined ? sub.assignedGrade : null,
        grade: null,
        submittedAt: null,
        missing:
          sub
            ? sub.assignedGrade === undefined && sub.state !== "TURNED_IN"
            : false,
        late: sub?.late ?? false,
        dueAt: parseDueDate(cw.dueDate),
        source: "CLASSROOM",
        categoryId: null as string | null, // user assigns this via the UI
      };
    });

    const groups = templates.map((t) => {
      const groupAssignments = allAssignments.filter(
        (a) => a.categoryId === t.id
      );
      const scored = groupAssignments.filter(
        (a) => a.score !== null && a.pointsPossible > 0
      );
      const earned = scored.reduce((s, a) => s + (a.score ?? 0), 0);
      const possible = scored.reduce((s, a) => s + a.pointsPossible, 0);
      const groupScore = possible > 0 ? (earned / possible) * 100 : null;

      return {
        id: t.id,
        name: t.name,
        weight: t.weight * 100, // convert to percentage for UI consistency
        score: groupScore,
        assignments: groupAssignments,
      };
    });

    // Append uncategorized group for anything not yet assigned
    const categorizedIds = new Set(
      groups.flatMap((g) => g.assignments.map((a) => a.id))
    );
    const uncategorized = allAssignments.filter(
      (a) => !categorizedIds.has(a.id)
    );

    if (uncategorized.length > 0) {
      groups.push({
        id: "uncategorized",
        name: "Uncategorized",
        weight: 0,
        score: null,
        assignments: uncategorized,
      });
    }

    return NextResponse.json({ groups, hasWeightTemplates: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[classroom/assignments]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
