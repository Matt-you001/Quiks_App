export type TestMode = "quiz" | "training";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type QuestionFocusMode = "general" | "topic";

export type AppLanguage = "en" | "fr" | "es" | "pt" | "ar" | "sw" | "zh" | "de";

export type SubscriptionTier = "free" | "pro";

export type UserRole = "student" | "teacher";

export type ClassroomActivityType = "assignment" | "test" | "exam";

export type ClassroomResultVisibility = "public" | "private";

export type ClassroomQuestionOrderMode = "same" | "shuffled";
export type ClassroomAssessmentMode = "standard" | "cbt";
export type ClassroomNavigationMode = "free" | "linear";
export type ClassroomAssessmentFormat = "objective" | "written" | "mixed";
export type ClassroomExitPolicy = "warn_record" | "confirm_submit" | "strict_submit";
export type ClassroomQuestionType = "objective" | "written";
export type ClassroomDeliveryMode = "online" | "offline_sync" | "offline_standalone";
export type OfflineExamResponseMode = "paper" | "device_export" | "exam_hub";
export type OfflineExamDeploymentFormat = "android" | "exam_hub" | "printable_pdf";

export interface OfflineExamConfiguration {
  deploymentFormat: OfflineExamDeploymentFormat;
  responseMode: OfflineExamResponseMode;
  packageExpiresAt: number;
  maxDevices: number;
  allowLocalResponseExport: boolean;
  includeTeacherPackage: boolean;
  showQuestionPoints: boolean;
}

export interface QuestionImage {
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  dataBase64: string;
  altText?: string;
}

export interface AppAccount {
  uid: string;
  name: string;
  email: string;
  provider: "email" | "google";
  emailVerified: boolean;
}

export interface SubjectTopic {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

export interface Subject {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  accent: [string, string];
  description: string;
  aiPromptHint: string;
  topics: SubjectTopic[];
}

export interface TopicValidationResult {
  status: "empty" | "valid" | "wrong-subject" | "unknown" | "custom";
  input: string;
  matchedTopicId?: string;
  matchedTopicLabel?: string;
  matchedSubjectId?: string;
  matchedSubjectName?: string;
  correctedFrom?: string;
}

export interface UserProfile {
  id: string;
  updatedAt?: number;
  name: string;
  age: number;
  targetExam: string;
  preferredCurriculum?: string;
  dailyGoalMinutes: number;
  schoolName?: string;
  teachingFocus?: string;
  language: AppLanguage;
  role: UserRole;
  quiksId: string;
  administrativeRole?: "app_owner" | "school_admin";
  administrativeAccountUid?: string;
  administrativeSchoolId?: string;
  schoolId?: string;
  schoolMembershipId?: string;
  schoolClassNaming?: SchoolClassNaming;
  schoolCurriculum?: string;
  academicPackages?: SchoolAcademicPackageCode[];
}

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  type?: ClassroomQuestionType;
  points?: number;
  markingGuide?: string;
  maxWords?: number;
  image?: QuestionImage;
}

export interface SessionResult {
  id: string;
  date: string;
  subjectId: string;
  subjectName: string;
  level: number;
  difficulty: Difficulty;
  grade: string;
  mode: TestMode;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  score: number;
  timeTakenSeconds: number;
  correctAnswers: number;
  totalQuestions: number;
  coinsEarned: number;
  aiFeedback: string;
  aiStudyPlan: string[];
  competitionId?: string;
  competitionOpponentName?: string;
  competitionOpponentId?: string;
  competitionOutcome?: "won" | "lost" | "draw" | "pending";
  competitionPlayerScore?: number;
  competitionOpponentScore?: number;
  competitionPlayerTimeSeconds?: number;
  competitionOpponentTimeSeconds?: number;
  competitionParticipantCount?: number;
  competitionMode?: "head_to_head" | "group";
  competitionPlacement?: number;
  competitionStandings?: CompetitionStanding[];
  classroomActivityId?: string;
  questionSource?: QuestionResponse["source"];
}

export interface GradeCertificate {
  id: string;
  profileId: string;
  learnerName: string;
  quiksId: string;
  age: number;
  targetExam: string;
  preferredCurriculum?: string;
  schoolName?: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  awardedAt: string;
  completionResultId: string;
  averageScore: number;
  averageTimeSeconds: number;
  speedPercent: number;
  excellence: "Outstanding" | "Excellent" | "Very Good" | "Accomplished";
  speedAward: "Lightning Fast" | "Swift" | "Focused";
}

export interface BreatherContent {
  id: string;
  title: string;
  intro: string;
  formatLabel?: string;
  story: string;
  teachingPoint?: string;
  teachingTitle?: string;
  reflection: string;
  facts: string[];
  continueLabel?: string;
}

export interface LearningLessonSection {
  heading: string;
  content: string;
}

export interface LearningLesson {
  title: string;
  overview: string;
  sections: LearningLessonSection[];
  examples: string[];
  keyPoints: string[];
  practiceTip: string;
}

export interface LearningLessonRequest {
  subjectName: string;
  topicName: string;
  grade: string;
  context?: string;
  profile?: UserProfile | null;
}

export interface LearningHubQuestionRequest {
  question: string;
}

export interface PastQuestionAttachmentInput {
  name: string;
  mimeType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  size: number;
  dataBase64: string;
}

export interface PastQuestionSolvedItem {
  id: string;
  number: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface PastQuestionSet {
  id: string;
  examTitle: string;
  year: string;
  subject?: string;
  appVariant: "children" | "teens" | "uni";
  questionCount: number;
  questions: PastQuestionSolvedItem[];
  createdAt: number;
}

export interface PastQuestionSubmitRequest {
  examTitle: string;
  subject?: string;
  year: string;
  questionText?: string;
  attachment?: PastQuestionAttachmentInput;
  shareConfirmed: boolean;
  profile?: UserProfile | null;
}

export interface PastQuestionSubmitResponse {
  item: PastQuestionSet;
  duplicate: boolean;
}

export interface PastQuestionSearchResponse {
  items: PastQuestionSet[];
}

export interface StoredAppState {
  account: AppAccount | null;
  isAuthenticated: boolean;
  profiles: UserProfile[];
  currentProfileId: string | null;
  results: Record<string, SessionResult[]>;
  learningHubGenerationDates: string[];
  reviewPromptLastShownAt: string | null;
  reviewCompletedAt: string | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: string | null;
  subscriptionProfileLimit: number;
  subscriptionUpdatedAt: number;
}

export interface QuestionRequest {
  subject: Subject;
  grade: string;
  difficulty: Difficulty;
  mode: TestMode;
  level: number;
  questionCount: number;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  profile?: UserProfile | null;
  recentQuestionIds?: string[];
}

export interface QuestionResponse {
  questions: Question[];
  source: "remote" | "demo" | "local";
}

export interface FeedbackRequest {
  score: number;
  subject: Subject;
  grade: string;
  focusMode?: QuestionFocusMode;
  topicLabel?: string;
  profile?: UserProfile | null;
}

export interface CoachPlanRequest {
  resultScore: number;
  subject: Subject;
  grade: string;
  level: number;
  focusMode?: QuestionFocusMode;
  topicLabel?: string;
  profile?: UserProfile | null;
}

export interface ClassroomProfileSyncRequest {
  profile: UserProfile;
}

export interface ClassroomMemberSummary {
  membershipId: string;
  profileId: string;
  quiksId: string;
  name: string;
  role: UserRole;
  status: "active" | "pending_teacher_approval" | "pending_student_approval";
  requestedBy: "teacher" | "student";
  joinedAt?: number;
  createdAt: number;
}

export interface ClassroomSummary {
  schoolId?: string | null;
  codePolicy?: "shared" | "teacher_generated";
  classId: string;
  classCode: string;
  className: string;
  teacherProfileId: string;
  teacherName: string;
  createdAt: number;
  memberCount: number;
  pendingTeacherApprovals: ClassroomMemberSummary[];
  pendingStudentApprovals: ClassroomMemberSummary[];
}

export interface ClassroomClassCreateRequest {
  teacherProfile: UserProfile;
  className: string;
}

export interface ClassroomClassListRequest {
  profile: UserProfile;
}

export interface ClassroomClassListResponse {
  classes: ClassroomSummary[];
}

export interface ClassroomClassCreateResponse {
  classroom: ClassroomSummary;
}

export interface ClassroomClassDetailsRequest {
  profile: UserProfile;
  classId: string;
}

export interface ClassroomClassDetailsResponse {
  classroom: ClassroomSummary;
  members: ClassroomMemberSummary[];
}

export interface ClassroomClassUpdateRequest {
  teacherProfile: UserProfile;
  classId: string;
  className: string;
}

export interface ClassroomClassDeleteRequest {
  teacherProfile: UserProfile;
  classId: string;
}

export interface ClassroomClassMemberRemoveRequest {
  teacherProfile: UserProfile;
  classId: string;
  membershipId: string;
}

export interface ClassroomJoinClassRequest {
  studentProfile: UserProfile;
  classCode: string;
}

export interface ClassroomInviteLinkAcceptRequest {
  studentProfile: UserProfile;
  classCode: string;
}

export interface ClassroomInviteStudentRequest {
  teacherProfile: UserProfile;
  classId: string;
  studentQuiksId: string;
}

export interface ClassroomMembershipDecisionRequest {
  actorProfile: UserProfile;
  classId: string;
  membershipId: string;
  decision: "approve" | "reject";
}

export interface ClassroomMembershipMutationResponse {
  classroom: ClassroomSummary;
  message: string;
}

export interface AccountSubscriptionStatusRequest {
  accountUid: string;
}

export interface PaddleSubscriptionSyncRequest extends AccountSubscriptionStatusRequest {
  transactionId: string;
}

export interface AccountSubscriptionStatusResponse {
  active: boolean;
  expiresAt: string | null;
  managementUrl: string | null;
  source?: "app_owner" | "individual" | "owner_issued" | "school" | "individual_and_school" | "individual_and_owner_issued" | "owner_issued_and_school" | "individual_owner_issued_and_school" | "none";
  profileLimit: number;
  school?: SchoolEntitlementSummary | null;
}

export type SchoolMemberRole = "school_admin" | "teacher" | "student";
export type SchoolMembershipStatus = "invited" | "pending" | "active" | "suspended";
export type SchoolLicenceStatus = "draft" | "active" | "expired" | "suspended";
export type SchoolEnrolmentMode = "shared_code" | "individual_codes";
export type SchoolProfileFieldType = "text" | "email" | "phone" | "number" | "date" | "select" | "boolean";

export interface SchoolProfileFieldDefinition {
  id: string;
  label: string;
  type: SchoolProfileFieldType;
  enabled: boolean;
  required: boolean;
  options?: string[];
  roles: Array<"teacher" | "student">;
  system?: boolean;
}

export interface SchoolLicence {
  plan: "term" | "session" | "pilot" | "custom";
  packageId?: "per-learner" | "starter" | "growth" | "complete" | "enterprise";
  packageName?: string;
  billingSource?: "revenuecat_paddle";
  status: SchoolLicenceStatus;
  startAt: number;
  endAt: number;
  studentSeatLimit: number;
  teacherSeatLimit: number;
  allowedVariants: Array<"children" | "teens" | "uni">;
  gracePeriodDays: number;
  features: {
    ai: boolean;
    classroom: boolean;
    cbt: boolean;
    lessonNotes: boolean;
    reports: boolean;
    integrations: boolean;
  };
}

export interface SchoolSummary {
  schoolId: string;
  schoolCode: string;
  name: string;
  curriculum: string;
  curricula: string[];
  status: SchoolLicenceStatus;
  licence: SchoolLicence;
  createdAt: number;
  studentCount: number;
  teacherCount: number;
  adminCount: number;
  pendingCount: number;
  seatUsagePercent: number;
  enrolmentMode: SchoolEnrolmentMode;
  classNaming: SchoolClassNaming;
  archivedAt?: number | null;
  administratorSetup?: {
    email: string;
    status: "invited" | "active" | "expired";
    invitationCode?: string;
    expiresAt?: number;
  };
}

export interface SchoolPublicDetails {
  schoolId: string;
  schoolCode: string;
  name: string;
  status: SchoolLicenceStatus;
  allowedVariants: Array<"children" | "teens" | "uni">;
  profileFields: SchoolProfileFieldDefinition[];
  enrolmentOpen: boolean;
  enrolmentMode: SchoolEnrolmentMode;
  invitationCode?: string;
  invitationRole?: SchoolMemberRole;
}

export interface SchoolMembership {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  schoolCurriculum?: string;
  schoolLicenceStatus?: SchoolLicenceStatus;
  schoolLicenceExpiresAt?: number | null;
  schoolClassNaming?: SchoolClassNaming;
  role: SchoolMemberRole;
  status: SchoolMembershipStatus;
  email: string;
  displayName: string;
  appVariant?: "children" | "teens" | "uni";
  profileData: Record<string, string | number | boolean>;
  createdAt: number;
  joinedAt?: number;
  academicPackages?: SchoolAcademicPackageCode[];
}

export interface SchoolEntitlementSummary {
  schoolId: string;
  schoolName: string;
  role: SchoolMemberRole;
  active: boolean;
  expiresAt: string | null;
  allowedVariants: Array<"children" | "teens" | "uni">;
  reason?: "active" | "not_started" | "expired" | "suspended" | "variant_not_licensed";
  academicPackages?: SchoolAcademicPackageCode[];
}

export interface SchoolOwnerDashboardResponse {
  totals: {
    schools: number;
    activeSchools: number;
    students: number;
    teachers: number;
    administrators: number;
    expiringWithin30Days: number;
    individualLicences: number;
    activeIndividualLicences: number;
    schoolBillingPurchases?: number;
  };
  schools: SchoolSummary[];
  archivedSchools?: SchoolSummary[];
  individualLicences: OwnerIssuedIndividualLicence[];
  individualSignups: Array<{
    email: string;
    appVariants: Array<"children" | "teens" | "uni">;
    registeredAt: number;
    lastSeenAt: number;
  }>;
  billingPurchases?: SchoolBillingPurchase[];
}

export interface SchoolBillingPurchase {
  purchaseId: string;
  transactionId: string;
  schoolId: string;
  packageId: string;
  packageName: string;
  period: "term" | "session";
  learnerCount: number;
  quantity: number;
  environment: "SANDBOX" | "PRODUCTION";
  purchasedAt: number;
  licenceStartAt: number;
  licenceEndAt: number;
  status: "active" | "refunded";
  refundedAt?: number;
}

export interface OwnerIssuedIndividualLicence {
  licenceId: string;
  email: string;
  status: SchoolLicenceStatus;
  startAt: number;
  endAt: number;
  createdAt: number;
}

export interface OwnerIssuedIndividualLicenceCreateRequest {
  email: string;
  startAt: number;
  endAt: number;
}

export interface OwnerIssuedIndividualLicenceCreateResponse {
  licence: OwnerIssuedIndividualLicence;
}

export interface SchoolCreateRequest {
  name: string;
  administratorEmail: string;
  enrolmentMode: SchoolEnrolmentMode;
  plan: SchoolLicence["plan"];
  startAt: number;
  endAt: number;
  studentSeatLimit: number;
  teacherSeatLimit: number;
  allowedVariants: SchoolLicence["allowedVariants"];
  gracePeriodDays?: number;
  academicPackages?: SchoolAcademicPackageCode[];
}

export type SchoolAcademicPackageCode = "academic.student" | "academic.school";

export interface SchoolAcademicGrant {
  featureCode: SchoolAcademicPackageCode;
  status: "pending" | "active" | "expired" | "revoked";
  startsAt: string;
  endsAt: string | null;
}

export interface SchoolCreateResponse {
  school: SchoolSummary;
  administratorInvitation: {
    email: string;
    invitationCode: string;
    expiresAt: number;
    emailDelivery?: SchoolEmailDelivery;
  };
}

export interface SchoolEmailDelivery {
  status: "sent" | "not_configured" | "failed";
  messageId?: string;
}

export interface SchoolOwnerLicenceUpdateRequest {
  schoolId: string;
  licence: Partial<SchoolLicence>;
}

export type SchoolClassNamingMode = "unconfigured" | "grade" | "primary_secondary" | "year" | "class" | "custom";

export interface SchoolClassNaming {
  mode: SchoolClassNamingMode;
  label: string;
  names: string[];
}

export interface SchoolOwnerRecordUpdateRequest {
  schoolId: string;
  patch: { name: string; licence: Pick<SchoolLicence, "startAt" | "endAt"> };
}

export interface SchoolMembershipListResponse {
  memberships: SchoolMembership[];
}

export interface SchoolIdentityResponse {
  viewer: {
    displayName: string;
    email: string;
  };
  isAppOwner: boolean;
  administratorMemberships: SchoolMembership[];
  memberships?: SchoolMembership[];
}

export interface SchoolDetailsResponse {
  viewer: {
    displayName: string;
    email: string;
    role: "app_owner" | "school_owner" | "school_admin";
  };
  school: SchoolSummary;
  profileFields: SchoolProfileFieldDefinition[];
  memberships: SchoolMembership[];
  billingHistory?: SchoolBillingPurchase[];
}

export type SchoolAdministrationModuleCode =
  | "operations.foundation"
  | "operations.attendance"
  | "operations.planning"
  | "operations.staff"
  | "operations.transport";

export interface SchoolAdministrationGrant {
  featureCode: SchoolAdministrationModuleCode;
  status: "pending" | "active" | "expired" | "revoked";
  startsAt: string;
  endsAt: string | null;
}

export interface SchoolAdministrationSettings {
  collectionSettings: {
    studentPhotograph: boolean;
    staffPhotograph: boolean;
    birthCertificate: boolean;
    identityDocument: boolean;
    medicalDocument: boolean;
  };
  transportPricingMode: "uniform" | "varying";
  uniformRoutePriceMinor: number | null;
  currency: string;
}

export interface SchoolAdministrationSummary {
  modules: Array<{ code: SchoolAdministrationModuleCode; name: string }>;
  grants: SchoolAdministrationGrant[];
  activeModules: SchoolAdministrationModuleCode[];
  settings: SchoolAdministrationSettings;
  people: Array<{
    id: string;
    personType: "student" | "staff" | "guardian";
    givenName: string;
    familyName: string;
    email?: string | null;
    phone?: string | null;
    status: "pending" | "active" | "inactive" | "archived";
    customFields: Record<string, unknown>;
    createdAt: string;
  }>;
  routes: Array<{
    id: string;
    name: string;
    priceMinor: number | null;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  vehicles: Array<{ id: string; registrationNumber: string; capacity: number | null; status: string }>;
  transportAssignments: Array<{ id: string; routeId: string; vehicleId: string | null; personId: string; startsOn: string; endsOn: string | null; status: string; routeName: string; registrationNumber: string | null }>;
  attendanceSessions: Array<{ id: string; attendanceDate: string; sessionLabel: string; createdAt: string; recordCount: number }>;
  lessonPlans: Array<{ id: string; subject: string; title: string; status: string; createdAt: string; updatedAt: string }>;
  timetables: Array<{ id: string; timetableType: "lesson" | "exam"; name: string; status: string; createdAt: string }>;
  timetableEntries: Array<{ id: string; timetableId: string; subject: string | null; title: string; startsAt: string; endsAt: string; location: string | null }>;
  staffReports: Array<{ id: string; staffPersonId: string; reportType: string; status: string; createdAt: string; updatedAt: string }>;
  recentAudit: Array<{ id: number; action: string; entityType: string; entityId: string | null; occurredAt: string }>;
  viewer: { role: "app_owner" | "school_owner" | "school_admin"; displayName: string };
}

export interface SchoolProfileFieldsUpdateRequest {
  schoolId: string;
  fields: SchoolProfileFieldDefinition[];
}

export interface SchoolEnrolRequest {
  schoolCode: string;
  role: "teacher" | "student";
  appVariant?: "children" | "teens" | "uni";
  profileData: Record<string, string | number | boolean>;
  invitationCode?: string;
}

export interface SchoolEnrolResponse {
  membership: SchoolMembership;
  entitlement: SchoolEntitlementSummary;
}

export interface SchoolInviteRequest {
  schoolId: string;
  email: string;
  role: SchoolMemberRole;
}

export interface SchoolInviteResponse {
  invitationCode: string;
  expiresAt: number;
  emailDelivery?: SchoolEmailDelivery;
}

export interface SchoolMembershipStatusUpdateRequest {
  schoolId: string;
  membershipId: string;
  status: SchoolMembershipStatus;
}

export interface ClassroomQuestionCandidateRequest {
  teacherProfile: UserProfile;
  classId: string;
  subject: Subject;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  topicIds?: string[];
  topicLabels?: string[];
  questionCount: number;
  batchCount?: number;
  assessmentFormat?: ClassroomAssessmentFormat;
  candidateType?: ClassroomQuestionType;
}

export interface ClassroomQuestionCandidateResponse {
  questions: Question[];
}

export interface ClassroomActivitySummary {
  activityId: string;
  classId: string;
  className: string;
  type: ClassroomActivityType;
  title: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  topicIds?: string[];
  topicLabels?: string[];
  customTopicLabel?: string;
  customTopicLabels?: string[];
  usesCustomSubject?: boolean;
  usesCustomTopic?: boolean;
  questionCount: number;
  durationMinutes: number;
  startAt: number;
  endAt: number;
  resultVisibility: ClassroomResultVisibility;
  questionOrderMode: ClassroomQuestionOrderMode;
  assessmentMode?: ClassroomAssessmentMode;
  assessmentFormat?: ClassroomAssessmentFormat;
  attemptsAllowed?: number;
  navigationMode?: ClassroomNavigationMode;
  exitPolicy?: ClassroomExitPolicy;
  randomizeOptions?: boolean;
  autoSubmit?: boolean;
  passMark?: number;
  instructions?: string;
  deliveryMode?: ClassroomDeliveryMode;
  offlineConfiguration?: OfflineExamConfiguration;
  offlinePackageVersion?: number;
  accessCodeRequired?: boolean;
  status: "scheduled" | "open" | "closed";
  teacherProfileId: string;
  teacherName: string;
  submissionCount: number;
  schoolLinked?: boolean;
  schoolResultsPublishedAt?: number;
  schoolResultsPublishedCount?: number;
  createdAt: number;
  submitted?: boolean;
  score?: number;
}

export interface ClassroomActivityCreateRequest {
  teacherProfile: UserProfile;
  classId: string;
  type: ClassroomActivityType;
  title: string;
  subject: Subject;
  usesCustomSubject?: boolean;
  usesCustomTopic?: boolean;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  topicIds?: string[];
  topicLabels?: string[];
  customTopicLabel?: string;
  customTopicLabels?: string[];
  durationMinutes: number;
  availabilityHours: number;
  startInMinutes?: number;
  startAt?: number;
  endAt?: number;
  resultVisibility: ClassroomResultVisibility;
  questionOrderMode: ClassroomQuestionOrderMode;
  assessmentMode?: ClassroomAssessmentMode;
  assessmentFormat?: ClassroomAssessmentFormat;
  attemptsAllowed?: number;
  navigationMode?: ClassroomNavigationMode;
  exitPolicy?: ClassroomExitPolicy;
  randomizeOptions?: boolean;
  autoSubmit?: boolean;
  passMark?: number;
  instructions?: string;
  deliveryMode?: ClassroomDeliveryMode;
  offlineConfiguration?: OfflineExamConfiguration;
  accessCode?: string;
  questions: Question[];
}

export interface ClassroomActivityCreateResponse {
  activity: ClassroomActivitySummary;
}

export interface ClassroomActivityDuplicateRequest {
  teacherProfile: UserProfile;
  activityId: string;
}

export interface ClassroomActivityDeleteRequest {
  teacherProfile: UserProfile;
  activityId: string;
}

export interface ClassroomActivityUpdateRequest extends ClassroomActivityCreateRequest {
  activityId: string;
}

export interface ClassroomActivityListRequest {
  profile: UserProfile;
}

export interface ClassroomActivityListResponse {
  activities: ClassroomActivitySummary[];
}

export interface ClassroomActivityDetailsRequest {
  profile: UserProfile;
  activityId: string;
  accessCode?: string;
}

export interface ClassroomSubmissionSummary {
  submissionId?: string;
  profileId: string;
  studentName: string;
  quiksId: string;
  submittedAt?: number;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  status: "submitted" | "absent";
  gradingStatus?: "finalized" | "awaiting_marking";
  provisionalScore?: number;
  totalPoints?: number;
  pointsAwarded?: number;
  securityEventCount?: number;
  autoSubmitted?: boolean;
}

export interface ClassroomStudentAnswer {
  questionId: string;
  answer: string;
}

export interface ClassroomSecurityEvent {
  eventId?: string;
  eventType: "exit_attempt" | "app_background" | "tab_hidden";
  occurredAt: number;
}

export interface ClassroomSubmissionResponseDetail {
  questionId: string;
  prompt: string;
  type: ClassroomQuestionType;
  points: number;
  answer: string;
  correctAnswer?: string;
  markingGuide?: string;
  awardedPoints?: number;
  teacherFeedback?: string;
}

export interface ClassroomSubmissionDetail extends ClassroomSubmissionSummary {
  responses: ClassroomSubmissionResponseDetail[];
  teacherFeedback?: string;
  securityEvents?: ClassroomSecurityEvent[];
}

export interface ClassroomActivityDetailsResponse {
  activity: ClassroomActivitySummary;
  questions: Question[];
  className: string;
  teacherName: string;
  submissions?: ClassroomSubmissionSummary[];
  submissionDetails?: ClassroomSubmissionDetail[];
}

export interface ClassroomActivitySubmitRequest {
  profile: UserProfile;
  activityId: string;
  answers: ClassroomStudentAnswer[];
  timeTakenSeconds: number;
  autoSubmitted?: boolean;
  exitReason?: string;
}

export interface ClassroomActivitySubmitResponse {
  activity: ClassroomActivitySummary;
  submission: ClassroomSubmissionSummary;
}

export interface ClassroomActivitySecurityEventRequest {
  profile: UserProfile;
  activityId: string;
  event: ClassroomSecurityEvent;
}

export interface ClassroomActivityGradeRequest {
  teacherProfile: UserProfile;
  activityId: string;
  submissionId: string;
  grades: Array<{ questionId: string; awardedPoints: number; feedback?: string }>;
  teacherFeedback?: string;
}

export interface ClassroomActivityPublishSchoolResultsRequest {
  teacherProfile: UserProfile;
  activityId: string;
}

export interface ClassroomActivityPublishSchoolResultsResponse {
  activity: ClassroomActivitySummary;
  publishedCount: number;
  publishedAt: number;
}

export interface OfflineExamPackageExportRequest {
  teacherProfile: UserProfile;
  activityId: string;
  activationCode: string;
  teacherPackagePassword?: string;
}

export interface OfflineExamPackageExportResponse {
  studentFilename: string;
  studentPackage: string;
  teacherFilename?: string;
  teacherPackage?: string;
  keyId: string;
}

export interface OfflineExamStudentQuestion {
  id: string;
  prompt: string;
  options: string[];
  type: ClassroomQuestionType;
  points: number;
  maxWords?: number;
  image?: QuestionImage;
}

export interface OfflineExamPayload {
  format: "quiks-offline-exam";
  version: 1;
  packageId: string;
  packageVersion: number;
  activityId: string;
  deliveryMode: Exclude<ClassroomDeliveryMode, "online">;
  responseMode: OfflineExamResponseMode;
  deploymentFormat: OfflineExamDeploymentFormat;
  schoolId?: string;
  schoolName?: string;
  className: string;
  title: string;
  subjectName: string;
  grade: string;
  instructions?: string;
  durationMinutes: number;
  startsAt: number;
  expiresAt: number;
  maxDevices: number;
  allowLocalResponseExport: boolean;
  showQuestionPoints: boolean;
  questionOrderMode: ClassroomQuestionOrderMode;
  randomizeOptions: boolean;
  navigationMode: ClassroomNavigationMode;
  exitPolicy: ClassroomExitPolicy;
  activationCodeHash?: string;
  questions: OfflineExamStudentQuestion[];
  issuedAt: number;
}

export interface OfflineExamEnvelope {
  algorithm: "Ed25519";
  keyId: string;
  encryption: { algorithm: "AES-256-GCM"; salt: string; nonce: string };
  payload: string;
  signature: string;
}

export type LessonNoteRefinementLevel = "none" | "minimal" | "rich" | "deep";
export type LessonNoteStudentAccess = "read_only" | "allow_download";

export interface LessonNoteIllustration {
  title: string;
  caption: string;
  points: string[];
  imageMimeType?: "image/png" | "image/jpeg" | "image/webp";
  imageDataBase64?: string;
  imageAltText?: string;
  imageSource?: "generated" | "uploaded";
}

export interface LessonNoteAttachmentInput {
  name: string;
  mimeType: string;
  size: number;
  dataBase64: string;
}

export interface ClassroomLessonNote {
  noteId: string;
  classId: string;
  title: string;
  subject?: string;
  topic?: string;
  originalContent: string;
  content: string;
  illustrations: LessonNoteIllustration[];
  refinementLevel: LessonNoteRefinementLevel;
  status: "draft" | "published";
  studentAccess: LessonNoteStudentAccess;
  teacherProfileId: string;
  teacherName: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export interface ClassroomLessonNoteCreateRequest {
  teacherProfile: UserProfile;
  classId: string;
  title: string;
  subject?: string;
  topic?: string;
  content: string;
  illustrations?: LessonNoteIllustration[];
  refinementLevel: LessonNoteRefinementLevel;
  status: "draft" | "published";
  studentAccess: LessonNoteStudentAccess;
  attachment?: LessonNoteAttachmentInput;
}

export interface ClassroomLessonNoteUpdateRequest {
  teacherProfile: UserProfile;
  noteId: string;
  title?: string;
  subject?: string;
  topic?: string;
  content?: string;
  illustrations?: LessonNoteIllustration[];
  refinementLevel?: LessonNoteRefinementLevel;
  status?: "draft" | "published";
  studentAccess?: LessonNoteStudentAccess;
  attachment?: LessonNoteAttachmentInput;
}

export interface ClassroomLessonNoteListRequest {
  profile: UserProfile;
  classId: string;
}

export interface ClassroomLessonNoteDeleteRequest {
  teacherProfile: UserProfile;
  noteId: string;
}

export interface ClassroomLessonNoteRefineRequest {
  teacherProfile: UserProfile;
  classId: string;
  title?: string;
  subject?: string;
  topic?: string;
  content: string;
  refinementLevel: Exclude<LessonNoteRefinementLevel, "none">;
}

export interface ClassroomLessonNoteRefineResponse {
  title: string;
  content: string;
  illustrations: LessonNoteIllustration[];
  imageGenerationWarning?: string;
}

export interface ClassroomLessonNoteAttachmentRequest {
  profile: UserProfile;
  noteId: string;
}

export interface ClassroomLessonNoteAttachmentResponse {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export interface ClassroomLessonNoteMutationResponse {
  note: ClassroomLessonNote;
}

export type LessonNoteActivityDifficulty = "easy" | "hard" | "very_hard";

export interface ClassroomLessonNoteActivityCreateRequest {
  teacherProfile: UserProfile;
  noteId: string;
  type: ClassroomActivityType;
  difficulty: LessonNoteActivityDifficulty;
  questionCount: number;
  deadlineAt?: number;
  startAt?: number;
  durationSeconds?: number;
  questions?: Question[];
}

export interface ClassroomLessonNoteActivityCreateResponse {
  activity: ClassroomActivitySummary;
}

export interface ClassroomLessonNoteActivityCandidateRequest {
  teacherProfile: UserProfile;
  noteId: string;
  difficulty: LessonNoteActivityDifficulty;
  questionCount: number;
  batchCount?: number;
}

export interface ClassroomLessonNoteActivityCandidateResponse {
  questions: Question[];
}

export interface ClassroomLessonNoteListResponse {
  notes: ClassroomLessonNote[];
}

export interface ClassroomChatMessage {
  messageId: string;
  classId: string;
  senderProfileId: string;
  senderName: string;
  senderRole: "teacher" | "student";
  text: string;
  createdAt: number;
}

export interface ClassroomChatListRequest {
  profile: UserProfile;
  classId: string;
}

export interface ClassroomChatSendRequest extends ClassroomChatListRequest {
  text: string;
}

export interface ClassroomChatListResponse {
  messages: ClassroomChatMessage[];
}

export interface ClassroomChatSendResponse {
  message: ClassroomChatMessage;
}

export interface ClassroomDeleteResponse {
  message: string;
}

export interface BreatherRequest {
  subject: Subject;
  grade: string;
  level: number;
  successfulSessionCount: number;
  mode?: TestMode;
  difficulty?: Difficulty;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  profile?: UserProfile | null;
}

export interface CompetitionJoinRequest {
  subject: Subject;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  profile: UserProfile;
  questionCount?: number;
}

export interface CompetitionChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: number;
}

export interface CompetitionLiveProgress {
  playerId: string;
  playerName: string;
  answeredCount: number;
  correctAnswers: number;
  score: number;
  finished: boolean;
  submittedAt?: number;
}

export interface CompetitionStanding {
  playerId: string;
  playerName: string;
  score: number;
  timeTakenSeconds: number;
  position: number;
  finished: boolean;
}

export interface CompetitionQuestionPayload {
  competitionId: string;
  opponentName: string;
  opponentId?: string;
  mode?: "head_to_head" | "group";
  participantCount?: number;
  questions: Question[];
  chats?: CompetitionChatMessage[];
  startAt?: number;
  endAt?: number;
  liveProgress?: CompetitionLiveProgress[];
  standings?: CompetitionStanding[];
}

export type GroupCompetitionStatus = "scheduled" | "starting" | "started" | "cancelled_insufficient_players";

export interface GroupCompetitionParticipant {
  playerId: string;
  playerName: string;
  joinedAt: number;
  creator: boolean;
}

export interface GroupCompetitionSummary {
  groupCompetitionId: string;
  code: string;
  status: GroupCompetitionStatus;
  subjectId: string;
  subjectName: string;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  startAt: number;
  endAt: number;
  participantCount: number;
  participants: GroupCompetitionParticipant[];
}

export interface GroupCompetitionCreateRequest extends CompetitionJoinRequest {
  durationSeconds: number;
  startAt: number;
}

export interface GroupCompetitionJoinRequest {
  code: string;
  profile: UserProfile;
}

export interface GroupCompetitionStatusRequest {
  groupCompetitionId?: string;
  code?: string;
  playerId: string;
}

export interface GroupCompetitionResponse {
  status: GroupCompetitionStatus;
  groupCompetition: GroupCompetitionSummary;
  competition?: CompetitionQuestionPayload;
}

export type CompetitionChallengeStatus =
  | "open"
  | "awaiting_creator_confirmation"
  | "accepted"
  | "declined"
  | "cancelled";

export interface CompetitionChallengeNotificationDiagnostics {
  registrationPresent: boolean;
  tokenUpdatedAt?: number;
  lastAttemptAt?: number;
  lastSuccessAt?: number;
  lastStatus: "pending" | "sending" | "sent" | "failed" | "not_registered";
  lastError?: string;
}

export interface CompetitionChallengeSummary {
  challengeId: string;
  status: CompetitionChallengeStatus;
  subjectId: string;
  subjectName: string;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  creatorId: string;
  creatorName: string;
  createdAt: number;
  acceptedById?: string;
  acceptedByName?: string;
  creatorNotification?: CompetitionChallengeNotificationDiagnostics;
  accepterNotification?: CompetitionChallengeNotificationDiagnostics;
}

export interface CompetitionJoinResponse {
  status: "waiting" | "matched" | "accepted";
  queueId?: string;
  challenge?: CompetitionChallengeSummary;
  competition?: CompetitionQuestionPayload;
}

export interface CompetitionStatusRequest {
  queueId?: string;
  playerId: string;
  competitionId?: string;
}

export interface CompetitionStatusResponse {
  status: "waiting" | "matched" | "not_found" | "accepted" | "completed";
  queueId?: string;
  challenge?: CompetitionChallengeSummary;
  competition?: CompetitionQuestionPayload;
  outcome?: "won" | "lost" | "draw" | "pending";
  opponentName?: string;
  opponentId?: string;
  playerScore?: number;
  opponentScore?: number;
  playerTimeTakenSeconds?: number;
  opponentTimeTakenSeconds?: number;
  participantCount?: number;
  mode?: "head_to_head" | "group";
  playerPosition?: number;
  standings?: CompetitionStanding[];
}

export interface CompetitionSubmitRequest {
  competitionId: string;
  playerId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeTakenSeconds: number;
}

export interface CompetitionSubmitResponse {
  status: "submitted" | "completed";
  outcome: "won" | "lost" | "draw" | "pending";
  opponentName: string;
  opponentId?: string;
  playerScore: number;
  opponentScore?: number;
  playerTimeTakenSeconds?: number;
  opponentTimeTakenSeconds?: number;
  participantCount?: number;
  mode?: "head_to_head" | "group";
  playerPosition?: number;
  standings?: CompetitionStanding[];
}

export interface CompetitionChatSendRequest {
  competitionId: string;
  playerId: string;
  message: string;
}

export interface CompetitionChatSendResponse {
  ok: true;
  chats: CompetitionChatMessage[];
}

export interface CompetitionChallengeCreateRequest extends CompetitionJoinRequest {
  durationSeconds: number;
}

export interface CompetitionChallengeCreateResponse {
  status: "open";
  challenge: CompetitionChallengeSummary;
}

export interface CompetitionChallengeListRequest {
  playerId: string;
  subjectId?: string;
}

export interface CompetitionChallengeListResponse {
  challenges: CompetitionChallengeSummary[];
}

export interface CompetitionChallengeAcceptRequest {
  challengeId: string;
  playerId: string;
  profile: UserProfile;
}

export interface CompetitionChallengeAcceptResponse {
  status: "awaiting_creator_confirmation";
  challenge: CompetitionChallengeSummary;
}

export interface CompetitionChallengeStatusRequest {
  challengeId: string;
  playerId: string;
}

export interface CompetitionChallengeStatusResponse {
  status: CompetitionChallengeStatus | "not_found";
  challenge?: CompetitionChallengeSummary;
  competition?: CompetitionQuestionPayload;
}

export interface CompetitionChallengeCreatorDecisionRequest {
  challengeId: string;
  playerId: string;
  decision: "accept" | "decline";
}

export interface CompetitionChallengeCreatorDecisionResponse {
  status: "accepted" | "declined" | "cancelled";
  challenge: CompetitionChallengeSummary;
  competition?: CompetitionQuestionPayload;
}

export interface CompetitionProgressUpdateRequest {
  competitionId: string;
  playerId: string;
  answeredCount: number;
  correctAnswers: number;
  score: number;
  finished?: boolean;
}

export interface CompetitionProgressUpdateResponse {
  ok: true;
  competition: CompetitionQuestionPayload;
}

export interface CompetitionTopPerformer {
  playerId: string;
  playerName: string;
  schoolName?: string;
  wins: number;
}

export interface CompetitionLeaderboardRequest {
  playerId: string;
}

export interface CompetitionLeaderboardResponse {
  performers: CompetitionTopPerformer[];
}

export interface CompetitionRematchRequest {
  sourceCompetitionId: string;
  playerId: string;
  subject: Subject;
  grade: string;
  level: number;
  difficulty: Difficulty;
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  durationSeconds: number;
  profile: UserProfile;
}

export interface CompetitionRematchStatusRequest {
  sourceCompetitionId: string;
  playerId: string;
}

export interface CompetitionRematchAcceptRequest {
  sourceCompetitionId: string;
  playerId: string;
  profile: UserProfile;
}

export interface CompetitionRematchResponse {
  status: "none" | "requested" | "incoming" | "accepted";
  requesterId?: string;
  requesterName?: string;
  targetId?: string;
  targetName?: string;
  nextLevel?: number;
  competition?: CompetitionQuestionPayload;
}

export interface PushTokenRegisterRequest {
  playerId: string;
  token: string;
  language?: AppLanguage;
  profileName?: string;
}

export interface PushTokenRegisterResponse {
  ok: true;
  registeredAt: number;
}
