export interface SchoolResultFilters {
  classId?: string; studentMembershipId?: string; subject?: string; type?: string;
  appVariant?: string; from?: number; to?: number; attempts?: "latest" | "all";
}
export interface SchoolResultRow {
  resultId: string; schoolId: string; studentMembershipId: string; studentName: string;
  classId: string; className: string; activityId: string; title: string; subject: string;
  type: string; appVariant: string; assessmentMode: string; score: number; submittedAt: number;
  teacherSubmittedAt: number; teacherSubmittedBy?: string;
  attemptNumber: number; scoreSource: string; adjustedScore?: number; adjustmentReason?: string;
  gradingStatus?: "awaiting_marking" | "finalized"; provisionalScore?: number;
  pointsAwarded?: number; totalPoints?: number; autoSubmitted?: boolean;
}
export interface SchoolResultsResponse {
  rows: SchoolResultRow[]; total: number; page: number;
  classes: Array<{ id: string; name: string }>; subjects: string[];
  students: Array<{ studentMembershipId: string; studentName: string; count: number; average: number }>;
}
export interface SchoolReport {
  reportId: string; schoolId: string; schoolName: string; studentMembershipId: string;
  studentName: string; studentEmail?: string; guardianEmail?: string;
  recipientType?: "student" | "guardian"; email: string;
  title: string; comment: string; teacherName?: string; principalName?: string; rows: SchoolResultRow[];
  average: number; calculation: string; revision: number;
  status: "draft" | "approved" | "sending" | "sent" | "delivery_unknown";
  createdAt: number; updatedAt: number;
  audit: Array<{ action: string; at: number; name: string; principalId: string }>;
  delivery: null | { status: string; messageId?: string; startedAt: number; finishedAt?: number };
}
export interface SchoolReportEdit {
  reportId: string; revision: number; comment: string; teacherName?: string; principalName?: string;
  recipientType?: "student" | "guardian";
  adjustments: Array<{ resultId: string; score: number; reason: string }>;
}
