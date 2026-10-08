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
export interface SchoolReportTemplate {
  templateId: string;
  name: string;
  heading: string;
  accentColor: string;
  footerNote: string;
  showClass: boolean;
  showStudentClass: boolean;
  showAdmissionNumber: boolean;
  showActivityType: boolean;
  showSubmittedDate: boolean;
  showCalculation: boolean;
  showTeacherComment: boolean;
  showSignatures: boolean;
  showAverage: boolean;
  orientation: "portrait" | "landscape";
  customFields: SchoolReportTemplateField[];
  ratingSections: SchoolReportRatingSection[];
}
export interface SchoolReportTemplateField {
  fieldId: string;
  label: string;
  source: "average" | "studentName" | "class" | "admissionNumber" | "reportTitle" | "custom";
  defaultValue: string;
}
export interface SchoolReportRatingItem { itemId: string; label: string; }
export interface SchoolReportRatingSection {
  sectionId: string;
  title: string;
  items: SchoolReportRatingItem[];
  scale: string[];
}
export interface SchoolReportTemplateCollection {
  templates: SchoolReportTemplate[];
  activeTemplateId: string;
}
export interface SchoolReport {
  reportId: string; schoolId: string; schoolName: string; studentMembershipId: string;
  studentName: string; studentEmail?: string; guardianEmail?: string;
  studentClassName?: string; studentAdmissionNumber?: string;
  recipientType?: "student" | "guardian"; email: string;
  title: string; comment: string; teacherName?: string; principalName?: string; rows: SchoolResultRow[];
  template?: SchoolReportTemplate;
  customFieldValues?: Record<string, string>;
  ratingValues?: Record<string, string>;
  average: number; calculation: string; revision: number;
  status: "draft" | "approved" | "sending" | "sent" | "delivery_unknown";
  createdAt: number; updatedAt: number;
  audit: Array<{ action: string; at: number; name: string; principalId: string }>;
  delivery: null | { status: string; messageId?: string; startedAt: number; finishedAt?: number };
}
export interface SchoolReportEdit {
  reportId: string; revision: number; comment: string; teacherName?: string; principalName?: string;
  recipientType?: "student" | "guardian";
  customFieldValues?: Record<string, string>;
  ratingValues?: Record<string, string>;
  adjustments: Array<{ resultId: string; score: number; reason: string }>;
}
export interface SchoolReportCommentDraft {
  comment: string;
  generatedBy: "ai" | "fallback";
}
