import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function percentageToLetter(pct: number): string {
  if (pct >= 97) return "A+";
  if (pct >= 93) return "A";
  if (pct >= 90) return "A-";
  if (pct >= 87) return "B+";
  if (pct >= 83) return "B";
  if (pct >= 80) return "B-";
  if (pct >= 77) return "C+";
  if (pct >= 73) return "C";
  if (pct >= 70) return "C-";
  if (pct >= 67) return "D+";
  if (pct >= 63) return "D";
  if (pct >= 60) return "D-";
  return "F";
}

export function letterToGpaPoints(letter: string, courseType: string = "STANDARD"): number {
  const base: Record<string, number> = {
    "A+": 4.0, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "D-": 0.7,
    "F": 0.0,
  };
  const pts = base[letter] ?? 0.0;
  const boost = courseType === "AP" || courseType === "DUAL_ENROLLMENT" ? 1.0
              : courseType === "HONORS" ? 0.5
              : 0.0;
  return pts > 0 ? Math.min(pts + boost, 5.0) : 0.0;
}

export function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "text-emerald-400";
  if (letter.startsWith("B")) return "text-vela-400";
  if (letter.startsWith("C")) return "text-amber-400";
  return "text-rose-400";
}

export function severityColor(severity: string) {
  if (severity === "CRITICAL") return { border: "border-rose-500", text: "text-rose-400", bg: "bg-rose-500/10" };
  if (severity === "WARNING")  return { border: "border-amber-400", text: "text-amber-400", bg: "bg-amber-400/10" };
  return { border: "border-sky-400", text: "text-sky-400", bg: "bg-sky-400/10" };
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatGpa(gpa: number): string {
  return gpa.toFixed(2);
}
