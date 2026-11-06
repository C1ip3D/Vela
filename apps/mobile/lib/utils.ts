import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "#34D399"; // emerald-400
  if (letter.startsWith("B")) return "#A7F3D0"; // emerald-200 (lighter green)
  if (letter.startsWith("C")) return "#FACC15"; // yellow-400
  return "#EF4444"; // red-500 (D/F)
}

export function gradeColorForPercent(pct: number): string {
  return gradeColor(pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : "F");
}

export function severityColor(severity: string) {
  if (severity === "CRITICAL")
    return { border: "#F43F5E", text: "#F87171", bg: "rgba(244,63,94,0.1)" };
  if (severity === "WARNING")
    return { border: "#F59E0B", text: "#FBBF24", bg: "rgba(245,158,11,0.1)" };
  return { border: "#38BDF8", text: "#7DD3FC", bg: "rgba(56,189,248,0.1)" };
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatGpa(gpa: number): string {
  return gpa.toFixed(2);
}
