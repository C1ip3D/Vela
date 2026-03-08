"use client";
import { useState, useEffect, useCallback } from "react";
import { useCanvas } from "@/contexts/CanvasContext";
import { getMockCourses, getMockStudent } from "@/lib/canvas/client";

export interface NormalizedCourse {
    id: string;
    name: string;
    courseCode: string;
    term: string;
    courseType: string;
    currentGrade: number | null;
    letterGrade: string | null;
    missingCount: number;
}

function scoreToLetter(score: number): string {
    if (score >= 97) return "A+";
    if (score >= 93) return "A";
    if (score >= 90) return "A-";
    if (score >= 87) return "B+";
    if (score >= 83) return "B";
    if (score >= 80) return "B-";
    if (score >= 77) return "C+";
    if (score >= 73) return "C";
    if (score >= 70) return "C-";
    if (score >= 67) return "D+";
    if (score >= 63) return "D";
    if (score >= 60) return "D-";
    return "F";
}

function letterToGpaPoints(letter: string): number {
    const map: Record<string, number> = {
        "A+": 4.0, "A": 4.0, "A-": 4.0,
        "B+": 3.0, "B": 3.0, "B-": 3.0,
        "C+": 2.0, "C": 2.0, "C-": 2.0,
        "D+": 1.0, "D": 1.0, "D-": 1.0,
        "F": 0.0,
    };
    return map[letter] ?? 0.0;
}

export function useCanvasCourses() {
    const { token, isConnected } = useCanvas();
    const [courses, setCourses] = useState<NormalizedCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [usingLive, setUsingLive] = useState(false);

    const fetchCourses = useCallback(async () => {
        if (!isConnected || !token) {
            const mock = getMockCourses();
            setCourses(mock);
            setUsingLive(false);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/canvas/courses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (!res.ok) throw new Error("Failed to fetch courses from Canvas");

            const data = await res.json();
            const normalized: NormalizedCourse[] = data.courses.map((c: any) => ({
                id: c.id,
                name: c.name,
                courseCode: c.courseCode,
                term: c.term,
                courseType: c.courseType,
                currentGrade: c.currentGrade,
                letterGrade: c.currentGrade != null
                    ? (c.letterGrade || scoreToLetter(c.currentGrade))
                    : null,
                missingCount: 0,
            }));

            if (normalized.length === 0) {
                const mock = getMockCourses();
                setCourses(mock);
                setUsingLive(false);
            } else {
                setCourses(normalized);
                setUsingLive(true);
            }
        } catch (err: any) {
            setError(err.message);
            const mock = getMockCourses();
            setCourses(mock);
            setUsingLive(false);
        } finally {
            setLoading(false);
        }
    }, [token, isConnected]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    // Only graded courses contribute to GPA
    const gradedCourses = courses.filter(c => c.currentGrade != null);
    const gpa = computeGpa(gradedCourses);

    return { courses, gradedCourses, loading, error, usingLive, gpa, refetch: fetchCourses };
}

function computeGpa(courses: NormalizedCourse[]) {
    if (courses.length === 0) {
        const mock = getMockStudent();
        const fallbackGpa = typeof mock.cumulativeGpa === "number" ? mock.cumulativeGpa : 0;
        return {
            weighted: fallbackGpa,
            unweighted: fallbackGpa,
        };
    }

    let totalUnweighted = 0;
    let totalWeighted = 0;

    for (const c of courses) {
        if (c.currentGrade == null) continue;
        const letter = c.letterGrade || scoreToLetter(c.currentGrade);
        const base = letterToGpaPoints(letter);
        totalUnweighted += base;
        const boost = c.courseType === "AP" ? 1.0 : c.courseType === "HONORS" ? 0.84 : 0;
        totalWeighted += base + boost;
    }

    const count = courses.filter(c => c.currentGrade != null).length;
    if (count === 0) {
        return { weighted: 0, unweighted: 0 };
    }

    return {
        unweighted: parseFloat((totalUnweighted / count).toFixed(2)),
        weighted: parseFloat((totalWeighted / count).toFixed(2)),
    };
}
