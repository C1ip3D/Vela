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

export interface ICResponsiveOffering {
  id: string;
  name: string;
  description: string | null;
  teacher: string | null;
  room: string | null;
  maxStudents: number | null;
  currentStudents: number | null;
  /** null when IC didn't report capacity. Never negative. */
  seatsLeft: number | null;
  /** The student is currently scheduled into this offering. */
  isSelected: boolean;
  /** A teacher placed the student here, so the student can't switch out. */
  teacherAssigned: boolean;
  teacherReason: string | null;
}

/** One flex period (e.g. "Thursday ACCESS") and the offerings students can pick from. */
export interface ICResponsiveSession {
  id: string;
  name: string;
  /** YYYY-MM-DD, in the district's local time. */
  startDate: string | null;
  endDate: string | null;
  /** Students can still sign up or switch. */
  isOpen: boolean;
  offerings: ICResponsiveOffering[];
  selectedOffering: ICResponsiveOffering | null;
}
