export interface IcSession {
  cookies: string;
  baseUrl: string;
  appName: string;
  personId?: string;
  displayName?: string | null;
}

export interface ICAssignment {
  key: string;
  name: string;
  score: number | null;
  maxScore: number | null;
  dueDate?: string;
}

export interface ICCourse {
  id: string;
  name: string;
  courseCode: string;
  term: string;
  courseType: string;
  currentGrade: number | null;
  letterGrade: string | null;
  missingCount: number;
  teacher: string | null;
  period: string | null;
  assignments: ICAssignment[];
}

export interface ICDetailAssignment {
  id: string;
  name: string;
  pointsPossible: number;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  missing: boolean;
  late: boolean;
  dueAt: string | null;
}

export interface ICAssignmentGroup {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  assignments: ICDetailAssignment[];
}

export interface ICPeriod {
  periodNumber: string;
  courseName: string;
  teacher: string | null;
  room: string | null;
  startTime: string | null;
  endTime: string | null;
}
