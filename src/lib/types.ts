export type Role = "ADMIN" | "STUDENT";
export type CourseLevel = "N1" | "N2" | "N3" | "N4" | "N5";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "ON_LEAVE";
export type DeviceType = "MOBILE" | "DESKTOP";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  courseLevel: CourseLevel;
  section: string;
  phone?: string | null;
  avatarUrl?: string | null;
  deviceSessionId?: string | null;
}

export interface ProctoringRules {
  clipboardBlock: boolean;
  devtoolsBlock: boolean;
  tabSwitchLimit: number;
  fullScreenRequired: boolean;
  selectionBlock: boolean;
}

export interface ViolationEvent {
  type: "TAB_SWITCH" | "DEVTOOLS_ATTEMPT" | "CLIPBOARD_COPY" | "CLIPBOARD_PASTE" | "FULLSCREEN_EXIT" | "WINDOW_BLUR";
  timestamp: string;
  details?: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export interface ExamWithQuestions {
  id: string;
  title: string;
  description?: string | null;
  courseLevel: CourseLevel;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  isPublished: boolean;
  isAiGenerated?: boolean;
  proctoringRules?: ProctoringRules | null;
  questions: {
    id: string;
    questionText: string;
    questionType: string;
    options: string[];
    marks: number;
    orderIndex: number;
    explanation?: string | null;
  }[];
}

export interface TimetableSlotItem {
  id: string;
  dayOfWeek: number; // 1-6 (Mon-Sat)
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  courseLevel: CourseLevel;
  subject: string;
  room?: string | null;
  staffName?: string | null;
  staffId?: string | null;
}

export interface StudentShortlistRecord {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  courseLevel: CourseLevel;
  section: string;
  attendanceRate: number; // Percentage e.g. 88.5
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  averageExamScore: number; // Percentage e.g. 78.2
  examsAttempted: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  status: "ELIGIBLE" | "AT_RISK" | "NEEDS_ATTENTION";
}

export interface FormQuestion {
  id: string;
  questionText: string;
  questionType: "MCQ" | "SHORT_ANSWER";
  options: string[];
  correctOption?: number;
  marks: number;
  explanation?: string;
}

export interface FormAssignmentData {
  formType: string;
  instructions?: string;
  totalMarks?: number;
  questions: FormQuestion[];
}

export interface ChapterResource {
  name: string;
  url: string;
  size?: string;
}

export interface ChapterQuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOption: number;
  explanation?: string;
}
