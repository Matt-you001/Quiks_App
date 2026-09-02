export interface SchoolClassRecord {
  classId: string;
  className: string;
  appVariant: "children" | "teens" | "uni";
  classCode: string | null;
  teacherAccessCode: string | null;
  teacherName: string;
  codePolicy: "shared" | "teacher_generated";
  awaitingTeacher: boolean;
  studentCount: number;
  activityCount: number;
  noteCount: number;
}
export interface SchoolClassDetails {
  classroom: SchoolClassRecord;
  members: { membershipId: string; name: string; role: string; status: string }[];
  activities: { id: string; title: string; subjectName: string; type: string; questionCount: number; questions: import("./app").Question[] }[];
  submissions: { submissionId: string; activityId: string; studentName: string; score: number; submittedAt: number }[];
  notes: import("./app").ClassroomLessonNote[];
  messages: { messageId: string; senderName: string; text: string; createdAt: number }[];
  audit: { action: string; principalId: string; at: number }[];
}
