import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function gradeColor(_letter: string): string {
  return "text-emerald-400";
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
