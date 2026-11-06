import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A = green, B = lighter green, C = yellow, D/F = red
export function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "text-emerald-400";
  if (letter.startsWith("B")) return "text-emerald-200";
  if (letter.startsWith("C")) return "text-yellow-400";
  return "text-red-500";
}

export function gradeColorForPercent(pct: number): string {
  return gradeColor(pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : "F");
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
