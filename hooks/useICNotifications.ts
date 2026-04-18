"use client";
import { useMemo } from "react";
import { NormalizedCourse } from "@/hooks/useCourses";

export function useICNotifications(courses: NormalizedCourse[]) {
  const logs = useMemo(() =>
    courses
      .filter((c) => c.missingCount > 0)
      .map((c, i) => ({
        id: `missing-${c.id}-${i}`,
        isRead: false,
        logType: "MISSING_ASSIGNMENT_ALERT",
        severity: c.missingCount >= 3 ? "WARNING" : "INFO",
        title: `${c.missingCount} missing assignment${c.missingCount > 1 ? "s" : ""} in ${c.name}`,
        body: { courseName: c.name, missingCount: c.missingCount },
        createdAt: new Date().toISOString(),
      })),
    [courses]
  );

  const unreadLogs = logs.filter((l) => !l.isRead);
  return { logs, unreadLogs };
}
