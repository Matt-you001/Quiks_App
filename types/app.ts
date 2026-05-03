export type TestMode = "quiz" | "training";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type QuestionFocusMode = "general" | "topic";

export type AppLanguage = "en" | "fr" | "es" | "pt" | "ar" | "sw" | "zh" | "de";

export type SubscriptionTier = "free" | "pro";

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

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  targetExam: string;
  dailyGoalMinutes: number;
  language: AppLanguage;
}

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
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
  questionSource?: QuestionResponse["source"];
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

export interface StoredAppState {
  profiles: UserProfile[];
  currentProfileId: string | null;
  results: Record<string, SessionResult[]>;
  subscriptionTier: SubscriptionTier;
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

export interface BreatherRequest {
  subject: Subject;
  grade: string;
  level: number;
  streak: number;
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

export interface CompetitionQuestionPayload {
  competitionId: string;
  opponentName: string;
  opponentId?: string;
  questions: Question[];
  chats?: CompetitionChatMessage[];
  startAt?: number;
  endAt?: number;
  liveProgress?: CompetitionLiveProgress[];
}

export interface CompetitionChallengeSummary {
  challengeId: string;
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
  status: "accepted";
  competition: CompetitionQuestionPayload;
}

export interface CompetitionChallengeStatusRequest {
  challengeId: string;
  playerId: string;
}

export interface CompetitionChallengeStatusResponse {
  status: "open" | "accepted" | "not_found";
  challenge?: CompetitionChallengeSummary;
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
