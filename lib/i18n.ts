import type { AppLanguage } from "../types/app";

type TranslationKey =
  | "signIn"
  | "signUp"
  | "welcomeBack"
  | "createAccount"
  | "authSubtitle"
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "enterEmail"
  | "enterPassword"
  | "enterFullName"
  | "reEnterPassword"
  | "noAccountYet"
  | "alreadyHaveAccount"
  | "logOut"
  | "deleteAccount"
  | "deleteAccountTitle"
  | "deleteAccountMessage"
  | "openDeletionCenter"
  | "deleteAccountUnavailableTitle"
  | "deleteAccountUnavailableMessage"
  | "invalidCredentialsTitle"
  | "invalidCredentialsMessage"
  | "accountExistsTitle"
  | "accountExistsMessage"
  | "passwordMismatchTitle"
  | "passwordMismatchMessage"
  | "passwordTooShortTitle"
  | "passwordTooShortMessage"
  | "authRequiredTitle"
  | "authRequiredMessage"
  | "continueWithGoogle"
  | "forgotPassword"
  | "passwordResetSentTitle"
  | "passwordResetSentMessage"
  | "authNotConfiguredTitle"
  | "authNotConfiguredMessage"
  | "createProfile"
  | "editProfile"
  | "updateLearnerDetails"
  | "nameRequiredTitle"
  | "nameRequiredMessage"
  | "invalidAgeTitle"
  | "invalidAgeMessage"
  | "invalidGoalTitle"
  | "invalidGoalMessage"
  | "name"
  | "age"
  | "targetExam"
  | "preferredCurriculum"
  | "preferredCurriculumPlaceholder"
  | "dailyGoalMinutes"
  | "language"
  | "cancel"
  | "saveChanges"
  | "enterLearnerName"
  | "homeCreateProfile"
  | "homeOpenProfile"
  | "homeChooseLearner"
  | "studentsList"
  | "selectLearnerPrompt"
  | "noProfilesYet"
  | "createFirstLearner"
  | "selected"
  | "select"
  | "lastActivity"
  | "noSessionsYet"
  | "currentLearner"
  | "ready"
  | "highestUnlockedBySubject"
  | "noUnlockedProgressYet"
  | "noStudentSelected"
  | "pickLearnerFirst"
  | "subjectsHintSelected"
  | "subjectsHintUnselected"
  | "backHome"
  | "chooseLearner"
  | "whoIsPracticing"
  | "selectLearnerForSession"
  | "use"
  | "createLearner"
  | "profileNoSelection"
  | "profileCreateOrChoose"
  | "todaysStudyTime"
  | "historyDaySummary"
  | "targetExceeded"
  | "targetReached"
  | "targetNotReached"
  | "noTargetYet"
  | "learningRecord"
  | "bestScore"
  | "sessionsCompleted"
  | "latestScore"
  | "profileDetails"
  | "dailyTarget"
  | "editProfileAction"
  | "createAnotherProfile"
  | "highestAttained"
  | "notReachedYet"
  | "chooseMode"
  | "grade"
  | "chooseGradeFirst"
  | "openSetup"
  | "activeLearner"
  | "subjectNotFound"
  | "courseNotFound"
  | "general"
  | "topicFocus"
  | "specialized"
  | "questionFocus"
  | "generalHint"
  | "specializedHint"
  | "topicHint"
  | "chooseTopic"
  | "selectTopic"
  | "topicPickerHint"
  | "otherTopic"
  | "enterCustomTopic"
  | "customTopicHint"
  | "customTopicRecognized"
  | "customTopicSuggestion"
  | "customTopicWrongSubject"
  | "customTopicUnknown"
  | "customTopicAccepted"
  | "customTopicRequired"
  | "classroomRole"
  | "studentRole"
  | "teacherRole"
  | "unlockedLevels"
  | "highestUnlockedSelected"
  | "difficulty"
  | "start"
  | "preparingSession"
  | "loadingQuestionsFor"
  | "unableToStartSession"
  | "questionGenerationFailed"
  | "topicFocusLabel"
  | "generalMixedPractice"
  | "testSourceAi"
  | "testSourceLocal"
  | "testSourceDemo"
  | "questionCount"
  | "correct"
  | "keepGoing"
  | "nextQuestion"
  | "noResultFound"
  | "excellentWork"
  | "greatJob"
  | "keepTrying"
  | "passedLevel"
  | "notPassedLevel"
  | "rewardUnlocked"
  | "takeLearningBreather"
  | "breatherRewardText"
  | "performanceMessage"
  | "sessionSummary"
  | "correctAnswers"
  | "timeUsed"
  | "coinsEarned"
  | "mode"
  | "focus"
  | "studyPlan"
  | "skipBreatherAndContinue"
  | "nextLevel"
  | "repeatThisLevel"
  | "breatherNotAvailable"
  | "learningBreather"
  | "revisionBreather"
  | "studyBreather"
  | "quickTakeaways"
  | "reflection"
  | "continueLearning"
  | "currentLanguage"
  | "sessionTitle"
  | "selectedGradeStartHint"
  | "chooseGradeStartHint"
  | "levelLabel"
  | "difficultyBeginner"
  | "difficultyIntermediate"
  | "difficultyAdvanced"
  | "difficultyExpert"
  | "topicPracticeDescription"
  | "aiCoachDescription"
  | "noneSelected"
  | "completedLabel"
  | "storyLabel"
  | "whatThisTeaches"
  | "competitionArena"
  | "competitionArenaHint"
  | "enterCompetition"
  | "createChallenge"
  | "groupCompetition"
  | "groupCompetitionHint"
  | "createGroupCompetition"
  | "joinGroupCompetition"
  | "groupCompetitionCode"
  | "groupCompetitionStartTime"
  | "groupCompetitionStartHint"
  | "groupCompetitionLobby"
  | "groupCompetitionParticipants"
  | "groupCompetitionNeedsParticipants"
  | "groupCompetitionCancelled"
  | "shareGroupInvitation"
  | "copyGroupCode"
  | "copyInvitationLink"
  | "invalidStartTime"
  | "acceptChallenge"
  | "challengeBoard"
  | "challengeBoardHint"
  | "createChallengeHint"
  | "waitingForAcceptance"
  | "challengeAccepted"
  | "competitionReminderSoonTitle"
  | "competitionReminderSoonBody"
  | "competitionReminderNowTitle"
  | "competitionReminderNowBody"
  | "countdownToStart"
  | "liveScores"
  | "noChallengesAvailable"
  | "challengeCreated"
  | "challengeCreatedHint"
  | "openChallenges"
  | "passedLevelBadge"
  | "nextLevelBadge"
  | "competitionNotAvailable"
  | "competitionSetupTitle"
  | "competitionSetupHint"
  | "joinCompetitionQueue"
  | "findingOpponent"
  | "waitingForMatch"
  | "competitionMatchFound"
  | "matchedOnTrack"
  | "opponent"
  | "competitionReady"
  | "competitionSummary"
  | "wonCompetition"
  | "lostCompetition"
  | "drewCompetition"
  | "waitingOpponentResult"
  | "competitionFocusLocked"
  | "competitionChat"
  | "quickMessages"
  | "quickEmojis"
  | "noMessagesYet"
  | "topPerformers"
  | "topPerformersHint"
  | "dailyWins"
  | "noTopPerformersYet"
  | "requestRematch"
  | "acceptRematch"
  | "rematchRequested"
  | "rematchIncoming"
  | "waitingRematchAcceptance"
  | "rematchStarting"
  | "subscription"
  | "manageSubscription"
  | "currentPlan"
  | "planExpires"
  | "lifetimeAccess"
  | "planStatusRefreshing"
  | "freePlan"
  | "proPlan"
  | "upgradeToPro"
  | "switchToFree"
  | "subscriptionSubtitle"
  | "subscriptionFreeFeatures"
  | "subscriptionProFeatures"
  | "monthlyPlan"
  | "yearlyPlan"
  | "restorePurchases"
  | "refreshStatus"
  | "loadingStoreStatus"
  | "subscriptionStoreHint"
  | "subscriptionTestingPaused"
  | "subscriptionProductsUnavailable"
  | "subscriptionSyncFailedTitle"
  | "subscriptionSyncFailedMessage"
  | "purchaseSuccessTitle"
  | "purchaseSuccessMessage"
  | "purchasePendingTitle"
  | "purchasePendingMessage"
  | "purchaseFailedTitle"
  | "restoreSuccessTitle"
  | "restoreSuccessMessage"
  | "restoreFreeTitle"
  | "restoreFreeMessage"
  | "subscriptionNotSupported"
  | "childrenAdFreeNote"
  | "profileLimitReachedTitle"
  | "profileLimitReachedMessage"
  | "freeAiLimitReached"
  | "freeCompetitionLimitReached"
  | "freePlanStatus"
  | "proPlanStatus"
  | "localSubscriptionNote"
  | "sponsoredLearningSpot"
  | "demoAdBannerHint"
  | "roleLabel"
  | "quiksIdLabel"
  | "classroomTitle"
  | "classroomProRequired"
  | "classManagement"
  | "className"
  | "createClassAction"
  | "yourClasses"
  | "noClassesYet"
  | "membersLabel"
  | "roster"
  | "noMembers"
  | "inviteStudentById"
  | "inviteStudentsByLink"
  | "shareClassInvite"
  | "shareClassInviteHint"
  | "copyInviteLink"
  | "inviteLinkCopied"
  | "moreShareApps"
  | "studentQuiksId"
  | "sendInvite"
  | "pendingStudentRequests"
  | "noRequests"
  | "createActivity"
  | "activityType"
  | "assignmentType"
  | "testType"
  | "assignmentTitle"
  | "testTitle"
  | "formLabel"
  | "preset"
  | "custom"
  | "subjectLabel"
  | "topicLabel"
  | "testDate"
  | "durationSeconds"
  | "startTimeLabel"
  | "endTimeLabel"
  | "setStartTimeAndDuration"
  | "deadlineDate"
  | "deadlineTime"
  | "selectDate"
  | "selectTime"
  | "privateLabel"
  | "publicLabel"
  | "sameForAll"
  | "shufflePerStudent"
  | "customQuestion"
  | "hideCustomQuestion"
  | "promptLabel"
  | "enterYourQuestion"
  | "optionLabel"
  | "markCorrect"
  | "correctOption"
  | "explanationOptional"
  | "addCustomQuestion"
  | "loadQuestionCandidates"
  | "loadMoreQuestions"
  | "accept"
  | "skip"
  | "reviewLabel"
  | "previous"
  | "next"
  | "publishTest"
  | "publishAssignment"
  | "joinClass"
  | "enterClassCode"
  | "requestJoin"
  | "invites"
  | "noInvites"
  | "teacherLabel"
  | "approve"
  | "reject"
  | "publishedActivities"
  | "classActivities"
  | "noActivitiesYet"
  | "closedLabel"
  | "submittedLabel"
  | "startsLabel"
  | "openUntilLabel"
  | "questionsLabel"
  | "viewResult"
  | "waitForStart"
  | "remove"
  | "edit"
  | "locked"
  | "duplicate"
  | "schoolName"
  | "teachingFocus"
  | "optional"
  | "teacherAccount"
  | "competitionWins"
  | "challengesPlayed"
  | "classCode"
  | "loadingClassroom"
  | "chooseProfileBeforeClassroom"
  | "activityDetailsLabel"
  | "resultsLabel"
  | "questionOrderLabel"
  | "questionCountLabel"
  | "resultsAction"
  | "copyClassCodeSuccess"
  | "copyClassCodeFailure"
  | "enterClassNameFirst"
  | "unableCreateClass"
  | "enterClassCodeFirst"
  | "joinRequestSent"
  | "unableSendJoinRequest"
  | "selectClassAndStudentFirst"
  | "inviteSent"
  | "unableInviteStudent"
  | "unableRemoveMember"
  | "unableUpdateRequest"
  | "questionSelectionTitle"
  | "enterCustomTopicFirst"
  | "unableLoadCandidateQuestions"
  | "customQuestionTitle"
  | "enterQuestionPrompt"
  | "fillAllFourAnswerOptions"
  | "chooseCorrectAnswer"
  | "markedCorrectOptionEmpty"
  | "questionCountAlreadyComplete"
  | "teacherAuthoredQuestion"
  | "publishAssignmentTitle"
  | "acceptQuestionsBeforePublishing"
  | "enterAssignmentTitleFirst"
  | "publishTestTitle"
  | "enterValidTestStart"
  | "enterValidDurationSeconds"
  | "endTimeLaterThanStart"
  | "testEndSameDay"
  | "enterValidDeadline"
  | "deadlineMustBeFuture"
  | "activityUpdatedTitle"
  | "testPublishedTitle"
  | "assignmentPublishedTitle"
  | "activityChangesSaved"
  | "testReadyForClass"
  | "assignmentReadyForClass"
  | "unablePublishActivity"
  | "unableDuplicateActivity"
  | "testEditLocked"
  | "unableLoadActivityForEditing"
  | "selectTimeTitle"
  | "setTime"
  | "createProfileSubtitle";

type TranslationMap = Record<TranslationKey, string>;

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const LANGUAGE_OPTIONS: Array<{
  code: AppLanguage;
  nativeLabel: string;
  englishLabel: string;
}> = [
  { code: "en", nativeLabel: "English", englishLabel: "English" },
  { code: "de", nativeLabel: "Deutsch", englishLabel: "German" },
  { code: "fr", nativeLabel: "Francais", englishLabel: "French" },
  { code: "es", nativeLabel: "Espanol", englishLabel: "Spanish" },
  { code: "pt", nativeLabel: "Portugues", englishLabel: "Portuguese" },
  { code: "zh", nativeLabel: "中文", englishLabel: "Chinese" },
  { code: "ar", nativeLabel: "العربية", englishLabel: "Arabic" },
  { code: "sw", nativeLabel: "Kiswahili", englishLabel: "Swahili" },
];

const english: TranslationMap = {
  signIn: "Sign in",
  signUp: "Sign up",
  welcomeBack: "Welcome back",
  createAccount: "Create your account",
  authSubtitle: "Sign in to continue learning progress on this device.",
  fullName: "Full name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  enterEmail: "Enter your email",
  enterPassword: "Enter your password",
  enterFullName: "Enter your full name",
  reEnterPassword: "Re-enter your password",
  noAccountYet: "No account yet? Sign up",
  alreadyHaveAccount: "Already have an account? Sign in",
  logOut: "Log out",
  deleteAccount: "Delete Account",
  deleteAccountTitle: "Delete account",
  deleteAccountMessage: "This will open the Quiks account deletion page in your browser so you can submit a deletion request for this app.",
  openDeletionCenter: "Open Deletion Center",
  deleteAccountUnavailableTitle: "Unable to open page",
  deleteAccountUnavailableMessage: "We could not open the Quiks deletion page right now. Please try again shortly.",
  invalidCredentialsTitle: "Invalid login",
  invalidCredentialsMessage: "The email or password is incorrect.",
  accountExistsTitle: "Account already exists",
  accountExistsMessage: "An account is already saved on this device. Sign in instead.",
  passwordMismatchTitle: "Passwords do not match",
  passwordMismatchMessage: "Please make sure both password fields match.",
  passwordTooShortTitle: "Password too short",
  passwordTooShortMessage: "Use at least 6 characters for the password.",
  authRequiredTitle: "Sign in required",
  authRequiredMessage: "Please sign in or create an account to continue.",
  continueWithGoogle: "Continue with Google",
  forgotPassword: "Forgot password?",
  passwordResetSentTitle: "Reset email sent",
  passwordResetSentMessage: "Check your email for the password reset link.",
  authNotConfiguredTitle: "Auth not configured",
  authNotConfiguredMessage: "Add your Firebase and Google auth environment variables to use online sign-in.",
  createProfile: "Create profile",
  editProfile: "Edit profile",
  updateLearnerDetails: "Update this learner's details and save the changes.",
  nameRequiredTitle: "Name required",
  nameRequiredMessage: "Please enter a learner name.",
  invalidAgeTitle: "Invalid age",
  invalidAgeMessage: "Please enter a valid age.",
  invalidGoalTitle: "Invalid goal",
  invalidGoalMessage: "Please enter at least 5 minutes for the daily goal.",
  name: "Name",
  age: "Age",
  targetExam: "Target exam",
  preferredCurriculum: "Preferred curriculum",
  preferredCurriculumPlaceholder: "e.g. Nigerian, British, Cambridge or IB",
  dailyGoalMinutes: "Daily goal in minutes",
  language: "Language",
  cancel: "Cancel",
  saveChanges: "Save changes",
  enterLearnerName: "Enter learner name",
  homeCreateProfile: "Create profile",
  homeOpenProfile: "Open profile",
  homeChooseLearner: "Choose learner",
  studentsList: "Students List",
  selectLearnerPrompt: "Select a learner below and start practising.",
  noProfilesYet: "No student profiles yet.",
  createFirstLearner: "Create first learner",
  selected: "Selected",
  select: "Select",
  lastActivity: "Last activity",
  noSessionsYet: "No sessions yet",
  currentLearner: "Current learner",
  ready: "Ready",
  highestUnlockedBySubject: "Highest unlocked by subject",
  noUnlockedProgressYet: "No unlocked progress yet.",
  noStudentSelected: "No student selected",
  pickLearnerFirst: "Pick a learner from the Students List before opening any subject.",
  subjectsHintSelected: "{name}, pick a {item}.",
  subjectsHintUnselected: "Select a student first, then choose a {item}.",
  backHome: "Back Home",
  chooseLearner: "Choose learner",
  whoIsPracticing: "Who is practicing {subject} today?",
  selectLearnerForSession: "Select the learner for this session.",
  use: "Use",
  createLearner: "Create learner",
  profileNoSelection: "No student selected",
  profileCreateOrChoose: "Create a profile first or return home and choose a learner.",
  todaysStudyTime: "Today's study time",
  historyDaySummary: "{count} session(s) recorded on {date}.",
  targetExceeded: "Daily target exceeded. Excellent consistency today.",
  targetReached: "Daily target reached. Well done.",
  targetNotReached: "Daily target not reached yet. {minutes} minute(s) to go.",
  noTargetYet: "No study target available yet.",
  learningRecord: "Learning record",
  bestScore: "Best score",
  sessionsCompleted: "Sessions completed",
  latestScore: "Latest score",
  profileDetails: "Profile details",
  dailyTarget: "Daily target",
  editProfileAction: "Edit Profile",
  createAnotherProfile: "Create Another Profile",
  highestAttained: "Highest attained",
  notReachedYet: "Not reached yet",
  chooseMode: "Choose mode",
  grade: "Grade",
  chooseGradeFirst: "Choose a grade first. Your unlocked levels will show on the start card.",
  openSetup: "Open {mode} setup",
  activeLearner: "Active learner",
  subjectNotFound: "Subject not found",
  courseNotFound: "Course not found",
  general: "General",
  topicFocus: "Topic Focus",
  specialized: "Specialized",
  questionFocus: "Question Focus",
  generalHint: "General mixes questions from different topics in this {item}.",
  specializedHint: "Specialized keeps the whole session inside one selected academic topic.",
  topicHint: "Topic Focus keeps the whole session inside one selected topic.",
  chooseTopic: "Choose Topic",
  selectTopic: "Select topic",
  topicPickerHint: "Tap to choose from the full topic list.",
  otherTopic: "Other topic",
  enterCustomTopic: "Enter a topic",
  customTopicHint: "Type a topic if it is not listed. We'll check the spelling and whether it belongs in this subject.",
  customTopicRecognized: "{topic} is available in {subject}.",
  customTopicSuggestion: "Do you mean {topic} instead of {input}? We'll use {topic} for this session.",
  customTopicWrongSubject: "{topic} is not a topic in {subject}. It belongs under {matchedSubject}.",
  customTopicUnknown: "We couldn't match {topic} to a topic in {subject}. Try another wording.",
  customTopicAccepted: "We'll use {topic} as a custom topic for this session.",
  customTopicRequired: "Enter a topic before starting this session.",
  classroomRole: "Classroom role",
  studentRole: "Student",
  teacherRole: "Teacher",
  unlockedLevels: "Unlocked Levels",
  highestUnlockedSelected: "The highest unlocked level for {grade} is selected for you.",
  difficulty: "Difficulty",
  start: "Start {mode}",
  preparingSession: "Preparing your session",
  loadingQuestionsFor: "Loading questions for {subject}.",
  unableToStartSession: "Unable to start session",
  questionGenerationFailed: "Question generation failed. Check your AI configuration or use demo mode.",
  topicFocusLabel: "Topic focus: {topic}",
  generalMixedPractice: "General mixed practice",
  testSourceAi: "Test source: AI",
  testSourceLocal: "Test source: Local bank",
  testSourceDemo: "Test source: Demo",
  questionCount: "Question {current} of {total}",
  correct: "Correct",
  keepGoing: "Keep going",
  nextQuestion: "Next question",
  noResultFound: "No result found",
  excellentWork: "Excellent work",
  greatJob: "Great job",
  keepTrying: "Keep trying",
  passedLevel: "You passed Level {level} in {subject}.",
  notPassedLevel: "You did not pass Level {level} in {subject} yet, but you can improve with another try.",
  rewardUnlocked: "Reward unlocked",
  takeLearningBreather: "Take a learning breather",
  breatherRewardText: "You have passed {count} {levelWord} in {subject}. A short reset is ready if you want one before the next exercise.",
  performanceMessage: "Performance message",
  sessionSummary: "Session summary",
  correctAnswers: "Correct answers",
  timeUsed: "Time used",
  coinsEarned: "Coins earned",
  mode: "Mode",
  focus: "Focus",
  studyPlan: "Study plan",
  skipBreatherAndContinue: "Skip Breather and Continue",
  nextLevel: "Next Level",
  repeatThisLevel: "Repeat This Level",
  breatherNotAvailable: "Breather not available",
  learningBreather: "Learning breather",
  revisionBreather: "Revision breather",
  studyBreather: "Study breather",
  quickTakeaways: "Quick takeaways",
  reflection: "Reflection",
  continueLearning: "Continue learning",
  currentLanguage: "Current language",
  sessionTitle: "{subject} session",
  selectedGradeStartHint: "Selected grade: {grade}. Choose difficulty and start your {mode}.",
  chooseGradeStartHint: "Choose grade and start your {mode}.",
  levelLabel: "Level",
  difficultyBeginner: "Beginner",
  difficultyIntermediate: "Intermediate",
  difficultyAdvanced: "Advanced",
  difficultyExpert: "Expert",
  topicPracticeDescription: "Focused practice in {topic}.",
  aiCoachDescription: "{appName} can generate question sets, feedback, and follow-up study plans for {subject}.",
  noneSelected: "None",
  completedLabel: "completed",
  storyLabel: "Story",
  whatThisTeaches: "What this teaches",
  competitionArena: "Competition Arena",
  competitionArenaHint: "Enter a live competition and get matched with another learner on the same subject, grade, and level.",
  enterCompetition: "Join Competition",
  createChallenge: "Create Challenge",
  groupCompetition: "Group Competition",
  groupCompetitionHint: "Create a scheduled challenge for more than two learners, or join one with its invitation code.",
  createGroupCompetition: "Create Group Competition",
  joinGroupCompetition: "Join Group Competition",
  groupCompetitionCode: "Group competition code",
  groupCompetitionStartTime: "Start time",
  groupCompetitionStartHint: "Use your local time in the format YYYY-MM-DD HH:mm. The competition starts only when at least two learners have joined.",
  groupCompetitionLobby: "Group Competition Lobby",
  groupCompetitionParticipants: "Participants",
  groupCompetitionNeedsParticipants: "At least one more learner must join before the scheduled start time.",
  groupCompetitionCancelled: "This competition was cancelled because fewer than two learners had joined at its start time.",
  shareGroupInvitation: "Share Invitation",
  copyGroupCode: "Copy Code",
  copyInvitationLink: "Copy Invitation Link",
  invalidStartTime: "Enter a valid future start time at least 30 seconds from now.",
  acceptChallenge: "Accept Challenge",
  challengeBoard: "Challenges",
  challengeBoardHint: "Create a challenge or accept one from another learner on the same track.",
  createChallengeHint: "Choose the exact challenge settings you want another learner to face.",
  waitingForAcceptance: "Waiting for another learner to accept your challenge.",
  challengeAccepted: "Your challenge has been accepted.",
  competitionReminderSoonTitle: "Competition starts soon",
  competitionReminderSoonBody: "{subject} vs {opponent} starts in a few seconds.",
  competitionReminderNowTitle: "Competition starting now",
  competitionReminderNowBody: "{subject} vs {opponent} is ready. Tap to continue.",
  countdownToStart: "Contest starts in {count}...",
  liveScores: "Live scores",
  noChallengesAvailable: "No open challenges yet. Create one and invite another learner to respond.",
  challengeCreated: "Challenge created",
  challengeCreatedHint: "Your challenge is now live on the board.",
  openChallenges: "Open challenges",
  passedLevelBadge: "Passed",
  nextLevelBadge: "Next",
  competitionNotAvailable: "Competition is available only for Quiks Teens and Quiks Uni.",
  competitionSetupTitle: "{subject} competition",
  competitionSetupHint: "Choose the exact track you want to compete on. We will match you with another learner on the same subject, grade, and level.",
  joinCompetitionQueue: "Join Competition Queue",
  findingOpponent: "Finding opponent",
  waitingForMatch: "You are in the queue. We are looking for another learner on the same track.",
  competitionMatchFound: "Match found",
  matchedOnTrack: "Matched on {subject} | {grade} | Level {level}",
  opponent: "Opponent",
  competitionReady: "Competition ready. Your shared question set is loading now.",
  competitionSummary: "Competition result",
  wonCompetition: "You won this competition.",
  lostCompetition: "You lost this competition.",
  drewCompetition: "This competition ended in a draw.",
  waitingOpponentResult: "You finished your competition. The final result will appear after your opponent submits.",
  competitionFocusLocked: "Competition uses the matched track and cannot be changed after matchmaking.",
  competitionChat: "Competition chat",
  quickMessages: "Quick messages",
  quickEmojis: "Quick emojis",
  noMessagesYet: "No messages yet. Use a quick message to break the ice.",
  topPerformers: "Top Performers",
  topPerformersHint: "Today's top 5 competitors by wins.",
  dailyWins: "{count} win(s) today",
  noTopPerformersYet: "No competition wins recorded yet today.",
  requestRematch: "Request Rematch",
  acceptRematch: "Accept Rematch",
  rematchRequested: "Rematch requested",
  rematchIncoming: "Your opponent wants another challenge on the next level.",
  waitingRematchAcceptance: "Waiting for your opponent to accept the rematch.",
  rematchStarting: "Rematch accepted. The next round is starting.",
  subscription: "Subscription",
  manageSubscription: "Manage Subscription",
  currentPlan: "Current plan",
  planExpires: "Expires",
  lifetimeAccess: "Lifetime access",
  planStatusRefreshing: "Refreshing subscription details…",
  freePlan: "Free",
  proPlan: "Pro",
  upgradeToPro: "Upgrade to Pro",
  switchToFree: "Switch to Free",
  subscriptionSubtitle: "Choose how much AI practice, competition, and study support you want in your learning app.",
  subscriptionFreeFeatures: "Free includes one profile, local practice, limited daily AI sessions, and limited daily competitions.",
  subscriptionProFeatures: "Pro includes multiple profiles, unlimited AI practice, unlimited competitions, rematches, and advanced study support.",
  monthlyPlan: "Monthly Pro",
  yearlyPlan: "Yearly Pro",
  restorePurchases: "Restore Purchases",
  refreshStatus: "Refresh Status",
  loadingStoreStatus: "Loading store subscription details...",
  subscriptionStoreHint: "Google Play subscriptions are loaded from this app's store products. Use the buttons below to subscribe or restore an existing Pro plan.",
  subscriptionTestingPaused: "Subscription purchases are hidden during testing, but the billing SDK is already installed for Play Console setup.",
  subscriptionProductsUnavailable: "No subscription plans are available from Google Play yet. Confirm your product IDs and Play Console setup, then rebuild.",
  subscriptionSyncFailedTitle: "Subscription unavailable",
  subscriptionSyncFailedMessage: "We could not load your store subscription details right now.",
  purchaseSuccessTitle: "Subscription active",
  purchaseSuccessMessage: "Your Pro subscription is active on this device now.",
  purchasePendingTitle: "Purchase pending",
  purchasePendingMessage: "Google Play has received the request, but the subscription is not active yet.",
  purchaseFailedTitle: "Purchase failed",
  restoreSuccessTitle: "Subscription restored",
  restoreSuccessMessage: "Your Pro subscription has been restored successfully.",
  restoreFreeTitle: "No active subscription",
  restoreFreeMessage: "We could not find an active Pro subscription for this account.",
  subscriptionNotSupported: "Store purchases are not available in Expo Go. Use a preview or production build to test subscriptions.",
  childrenAdFreeNote: "Quiks Children stays ad-free for a safer child learning experience.",
  profileLimitReachedTitle: "Profile limit reached",
  profileLimitReachedMessage: "Free access allows only one learner profile. Upgrade to Pro to add more profiles.",
  freeAiLimitReached: "You have used today's free AI practice limit. Upgrade to Pro to continue using AI-generated questions.",
  freeCompetitionLimitReached: "You have reached today's free competition limit. Upgrade to Pro for unlimited competitions and rematches.",
  freePlanStatus: "You are on the Free plan.",
  proPlanStatus: "You are on the Pro plan.",
  localSubscriptionNote: "For now, plan changes are stored on this device while full store billing is prepared.",
  sponsoredLearningSpot: "Sponsored learning spot",
  demoAdBannerHint: "This is the fallback test banner. Install a fresh native preview or production build to see live ad rendering.",
  roleLabel: "Role",
  quiksIdLabel: "Quiks ID",
  classroomTitle: "Classroom",
  classroomProRequired: "Classroom is available to paid Pro subscribers. Upgrade or restore your subscription to continue.",
  classManagement: "Class management",
  className: "Class name",
  createClassAction: "Create class",
  yourClasses: "Your classes",
  noClassesYet: "No classes yet.",
  membersLabel: "Members",
  roster: "Roster",
  noMembers: "No members.",
  inviteStudentById: "Invite student by ID",
  inviteStudentsByLink: "Invite students by link",
  shareClassInvite: "Share class invitation",
  shareClassInviteHint: "Choose how you want to send this class invitation.",
  copyInviteLink: "Copy link",
  inviteLinkCopied: "Invitation link copied.",
  moreShareApps: "Messenger / More",
  studentQuiksId: "Student Quiks ID",
  sendInvite: "Send invite",
  pendingStudentRequests: "Pending student requests",
  noRequests: "No requests.",
  createActivity: "Create activity",
  activityType: "Activity type",
  assignmentType: "Assignment",
  testType: "Test",
  assignmentTitle: "Assignment title",
  testTitle: "Test title",
  formLabel: "Form",
  preset: "Preset",
  custom: "Custom",
  subjectLabel: "Subject",
  topicLabel: "Topic",
  testDate: "Test date",
  durationSeconds: "Duration (Seconds)",
  startTimeLabel: "Start time",
  endTimeLabel: "End time",
  setStartTimeAndDuration: "Set start time and duration",
  deadlineDate: "Deadline date",
  deadlineTime: "Deadline time",
  selectDate: "Select date",
  selectTime: "Select time",
  privateLabel: "Private",
  publicLabel: "Public",
  sameForAll: "Same for all",
  shufflePerStudent: "Shuffle per student",
  customQuestion: "Custom question",
  hideCustomQuestion: "Hide custom question",
  promptLabel: "Prompt",
  enterYourQuestion: "Enter your question",
  optionLabel: "Option {number}",
  markCorrect: "Mark",
  correctOption: "Correct",
  explanationOptional: "Explanation (optional)",
  addCustomQuestion: "Add custom question",
  loadQuestionCandidates: "Load question candidates",
  loadMoreQuestions: "Load more questions",
  accept: "Accept",
  skip: "Skip",
  reviewLabel: "Review",
  previous: "Previous",
  next: "Next",
  publishTest: "Publish test",
  publishAssignment: "Publish assignment",
  joinClass: "Join a class",
  enterClassCode: "Enter class code",
  requestJoin: "Request to join",
  invites: "Invites",
  noInvites: "No invites.",
  teacherLabel: "Teacher",
  approve: "Approve",
  reject: "Reject",
  publishedActivities: "Published activities",
  classActivities: "Class activities",
  noActivitiesYet: "No activities yet.",
  closedLabel: "Closed",
  submittedLabel: "Submitted",
  startsLabel: "Starts {value}",
  openUntilLabel: "Open until {value}",
  questionsLabel: "Questions: {count}",
  viewResult: "View result",
  waitForStart: "Wait for start",
  remove: "Remove",
  edit: "Edit",
  locked: "Locked",
  duplicate: "Duplicate",
  schoolName: "School name",
  teachingFocus: "Teaching focus",
  optional: "Optional",
  teacherAccount: "Teacher account",
  competitionWins: "Wins",
  challengesPlayed: "Challenges played",
  classCode: "Code",
  loadingClassroom: "Loading classroom...",
  chooseProfileBeforeClassroom: "Choose or create a profile before using classroom tools.",
  activityDetailsLabel: "Activity details",
  resultsLabel: "Results",
  questionOrderLabel: "Question order",
  questionCountLabel: "Question count",
  resultsAction: "Results",
  copyClassCodeSuccess: "Class code copied.",
  copyClassCodeFailure: "Unable to copy the class code.",
  enterClassNameFirst: "Enter a class name first.",
  unableCreateClass: "Unable to create class.",
  enterClassCodeFirst: "Enter a class code first.",
  joinRequestSent: "Join request sent",
  unableSendJoinRequest: "Unable to send join request.",
  selectClassAndStudentFirst: "Select a class and enter a student ID first.",
  inviteSent: "Invite sent",
  unableInviteStudent: "Unable to invite the student.",
  unableRemoveMember: "Unable to remove the member.",
  unableUpdateRequest: "Unable to update the request.",
  questionSelectionTitle: "Question selection",
  enterCustomTopicFirst: "Enter the custom topic first.",
  unableLoadCandidateQuestions: "Unable to load candidate questions.",
  customQuestionTitle: "Custom question",
  enterQuestionPrompt: "Enter the question prompt.",
  fillAllFourAnswerOptions: "Fill all four answer options.",
  chooseCorrectAnswer: "Choose the correct answer.",
  markedCorrectOptionEmpty: "The marked correct option cannot be empty.",
  questionCountAlreadyComplete: "Question count is already complete.",
  teacherAuthoredQuestion: "Teacher-authored question.",
  publishAssignmentTitle: "Assignment",
  acceptQuestionsBeforePublishing: "Accept {count} questions before publishing.",
  enterAssignmentTitleFirst: "Enter an assignment title first.",
  publishTestTitle: "Test",
  enterValidTestStart: "Enter a valid test date and start time.",
  enterValidDurationSeconds: "Enter a valid duration in seconds.",
  endTimeLaterThanStart: "End time must be later than start time.",
  testEndSameDay: "Test end time must remain on the same day as the test date.",
  enterValidDeadline: "Enter a valid deadline date and time.",
  deadlineMustBeFuture: "Deadline must be in the future.",
  activityUpdatedTitle: "Activity updated",
  testPublishedTitle: "Test published",
  assignmentPublishedTitle: "Assignment published",
  activityChangesSaved: "Your activity changes are saved.",
  testReadyForClass: "Your scheduled test is now ready for the class.",
  assignmentReadyForClass: "Your assignment is now available to the class.",
  unablePublishActivity: "Unable to publish the assignment.",
  unableDuplicateActivity: "Unable to duplicate the activity.",
  testEditLocked: "Tests can no longer be edited within 5 minutes of the start time.",
  unableLoadActivityForEditing: "Unable to load the activity for editing.",
  selectTimeTitle: "Select time",
  setTime: "Set time",
  createProfileSubtitle: "Set up this learner profile and save the details.",
};

const translations: Record<AppLanguage, TranslationMap> = {
  en: english,
  de: {
    ...english,
    createProfile: "Profil erstellen",
    editProfile: "Profil bearbeiten",
    updateLearnerDetails: "Aktualisiere die Angaben dieses Lernenden und speichere die Anderungen.",
    nameRequiredTitle: "Name erforderlich",
    nameRequiredMessage: "Bitte gib einen Lernendennamen ein.",
    invalidAgeTitle: "Ungultiges Alter",
    invalidAgeMessage: "Bitte gib ein gultiges Alter ein.",
    invalidGoalTitle: "Ungultiges Ziel",
    invalidGoalMessage: "Bitte gib mindestens 5 Minuten als Tagesziel ein.",
    name: "Name",
    age: "Alter",
    targetExam: "Zielprufung",
    preferredCurriculum: "Bevorzugter Lehrplan",
    preferredCurriculumPlaceholder: "z. B. nigerianisch, britisch, Cambridge oder IB",
    dailyGoalMinutes: "Tagliches Ziel in Minuten",
    language: "Sprache",
    cancel: "Abbrechen",
    saveChanges: "Anderungen speichern",
    enterLearnerName: "Name des Lernenden eingeben",
    homeCreateProfile: "Profil erstellen",
    homeOpenProfile: "Profil offnen",
    homeChooseLearner: "Lernenden auswahlen",
    studentsList: "Schulerliste",
    selectLearnerPrompt: "Wahle unten einen Lernenden aus und beginne zu uben.",
    noProfilesYet: "Noch keine Schulerprofile vorhanden.",
    createFirstLearner: "Ersten Lernenden erstellen",
    selected: "Ausgewahlt",
    select: "Auswahlen",
    lastActivity: "Letzte Aktivitat",
    noSessionsYet: "Noch keine Sitzungen",
    currentLearner: "Aktueller Lernender",
    ready: "Bereit",
    highestUnlockedBySubject: "Hochster freigeschalteter Stand nach Fach",
    noUnlockedProgressYet: "Noch kein freigeschalteter Fortschritt.",
    noStudentSelected: "Kein Schuler ausgewahlt",
    pickLearnerFirst: "Wahle zuerst einen Lernenden aus der Schulerliste, bevor du ein Fach offnest.",
    subjectsHintSelected: "{name}, wahl ein {item}.",
    subjectsHintUnselected: "Wahle zuerst einen Schuler und dann ein {item}.",
    backHome: "Zuruck zur Startseite",
    chooseLearner: "Lernenden auswahlen",
    whoIsPracticing: "Wer ubt heute {subject}?",
    selectLearnerForSession: "Wahle den Lernenden fur diese Sitzung aus.",
    use: "Verwenden",
    createLearner: "Lernenden erstellen",
    profileNoSelection: "Kein Schuler ausgewahlt",
    profileCreateOrChoose: "Erstelle zuerst ein Profil oder kehre zur Startseite zuruck und wahle einen Lernenden aus.",
    todaysStudyTime: "Heutige Lernzeit",
    historyDaySummary: "{count} Sitzung(en) aufgezeichnet am {date}.",
    targetExceeded: "Tagesziel ubertroffen. Tolle Konsequenz heute.",
    targetReached: "Tagesziel erreicht. Gut gemacht.",
    targetNotReached: "Tagesziel noch nicht erreicht. Noch {minutes} Minute(n).",
    noTargetYet: "Noch kein Lernziel verfugbar.",
    learningRecord: "Lernverlauf",
    bestScore: "Beste Punktzahl",
    sessionsCompleted: "Abgeschlossene Sitzungen",
    latestScore: "Letzte Punktzahl",
    profileDetails: "Profildetails",
    dailyTarget: "Tagesziel",
    editProfileAction: "Profil bearbeiten",
    createAnotherProfile: "Weiteres Profil erstellen",
    highestAttained: "Hochster Stand",
    notReachedYet: "Noch nicht erreicht",
    chooseMode: "Modus auswahlen",
    grade: "Klasse",
    chooseGradeFirst: "Wahle zuerst eine Klasse. Deine freigeschalteten Stufen erscheinen auf der Startkarte.",
    openSetup: "{mode}-Setup offnen",
    activeLearner: "Aktiver Lernender",
    subjectNotFound: "Fach nicht gefunden",
    courseNotFound: "Kurs nicht gefunden",
    general: "Allgemein",
    topicFocus: "Themenfokus",
    specialized: "Spezialisiert",
    questionFocus: "Fragenfokus",
    generalHint: "Allgemein mischt Fragen aus verschiedenen Themen in diesem {item}.",
    specializedHint: "Spezialisiert halt die ganze Sitzung innerhalb eines ausgewahlten akademischen Themas.",
    topicHint: "Themenfokus halt die ganze Sitzung innerhalb eines ausgewahlten Themas.",
    chooseTopic: "Thema auswahlen",
    selectTopic: "Thema auswahlen",
    topicPickerHint: "Tippe, um aus der vollstandigen Themenliste zu wahlen.",
    unlockedLevels: "Freigeschaltete Stufen",
    highestUnlockedSelected: "Die hochste freigeschaltete Stufe fur {grade} wurde fur dich ausgewahlt.",
    difficulty: "Schwierigkeit",
    start: "{mode} starten",
    preparingSession: "Deine Sitzung wird vorbereitet",
    loadingQuestionsFor: "Fragen fur {subject} werden geladen.",
    unableToStartSession: "Sitzung kann nicht gestartet werden",
    questionGenerationFailed: "Die Fragenerstellung ist fehlgeschlagen. Prufe deine KI-Konfiguration oder nutze den Demo-Modus.",
    topicFocusLabel: "Themenfokus: {topic}",
    generalMixedPractice: "Allgemeine gemischte Ubung",
    testSourceAi: "Testquelle: KI",
    testSourceLocal: "Testquelle: Lokaler Pool",
    testSourceDemo: "Testquelle: Demo",
    questionCount: "Frage {current} von {total}",
    correct: "Richtig",
    keepGoing: "Weiter so",
    nextQuestion: "Nächste Frage",
    noResultFound: "Kein Ergebnis gefunden",
    excellentWork: "Ausgezeichnete Arbeit",
    greatJob: "Sehr gut",
    keepTrying: "Versuch es weiter",
    passedLevel: "Du hast Stufe {level} in {subject} bestanden.",
    notPassedLevel: "Du hast Stufe {level} in {subject} noch nicht bestanden, aber mit einem weiteren Versuch kannst du dich verbessern.",
    rewardUnlocked: "Belohnung freigeschaltet",
    takeLearningBreather: "Lernpause starten",
    breatherRewardText: "Du hast {count} {levelWord} in {subject} bestanden. Eine kurze Pause ist bereit, wenn du vor der nächsten Übung eine machen möchtest.",
    performanceMessage: "Leistungsrückmeldung",
    sessionSummary: "Sitzungsübersicht",
    correctAnswers: "Richtige Antworten",
    timeUsed: "Benötigte Zeit",
    coinsEarned: "Verdiente Münzen",
    mode: "Modus",
    focus: "Fokus",
    studyPlan: "Lernplan",
    skipBreatherAndContinue: "Pause überspringen und fortfahren",
    nextLevel: "Nächste Stufe",
    repeatThisLevel: "Diese Stufe wiederholen",
    breatherNotAvailable: "Pause nicht verfügbar",
    learningBreather: "Lernpause",
    revisionBreather: "Wiederholungspause",
    studyBreather: "Studienpause",
    quickTakeaways: "Schnelle Merkpunkte",
    reflection: "Reflexion",
    continueLearning: "Weiterlernen",
    currentLanguage: "Aktuelle Sprache",
    sessionTitle: "{subject}-Sitzung",
    selectedGradeStartHint: "Gewahlte Klasse: {grade}. Wahlen Sie die Schwierigkeit und starten Sie Ihren {mode}.",
    chooseGradeStartHint: "Wahlen Sie eine Klasse und starten Sie Ihren {mode}.",
    levelLabel: "Stufe",
    difficultyBeginner: "Anfanger",
    difficultyIntermediate: "Mittelstufe",
    difficultyAdvanced: "Fortgeschritten",
    difficultyExpert: "Experte",
    topicPracticeDescription: "Gezielte Ubung zu {topic}.",
    aiCoachDescription: "{appName} kann Fragensatze, Feedback und anschliessende Lernplane fur {subject} erstellen.",
    noneSelected: "Keine",
    completedLabel: "abgeschlossen",
    storyLabel: "Text",
    whatThisTeaches: "Was das vermittelt",
  },
  fr: {
    ...english,
    roleLabel: "Role",
    quiksIdLabel: "ID Quiks",
    classroomTitle: "Classe",
    classManagement: "Gestion de classe",
    className: "Nom de la classe",
    createClassAction: "Creer la classe",
    yourClasses: "Vos classes",
    noClassesYet: "Aucune classe pour le moment.",
    membersLabel: "Membres",
    roster: "Liste des membres",
    noMembers: "Aucun membre.",
    inviteStudentById: "Inviter un eleve par ID",
    inviteStudentsByLink: "Inviter des eleves par lien",
    shareClassInvite: "Partager l'invitation de classe",
    shareClassInviteHint: "Choisissez comment envoyer cette invitation de classe.",
    copyInviteLink: "Copier le lien",
    inviteLinkCopied: "Lien d'invitation copie.",
    moreShareApps: "Messenger / Autres",
    studentQuiksId: "ID Quiks de l'eleve",
    sendInvite: "Envoyer l'invitation",
    pendingStudentRequests: "Demandes d'eleves en attente",
    noRequests: "Aucune demande.",
    createActivity: "Creer une activite",
    activityType: "Type d'activite",
    assignmentType: "Devoir",
    testType: "Test",
    assignmentTitle: "Titre du devoir",
    testTitle: "Titre du test",
    formLabel: "Mode",
    preset: "Predefini",
    custom: "Personnalise",
    subjectLabel: "Matiere",
    topicLabel: "Sujet",
    testDate: "Date du test",
    durationSeconds: "Duree (Secondes)",
    startTimeLabel: "Heure de debut",
    endTimeLabel: "Heure de fin",
    setStartTimeAndDuration: "Definissez l'heure de debut et la duree",
    deadlineDate: "Date limite",
    deadlineTime: "Heure limite",
    selectDate: "Choisir une date",
    selectTime: "Choisir l'heure",
    privateLabel: "Prive",
    publicLabel: "Public",
    sameForAll: "Identique pour tous",
    shufflePerStudent: "Melanger par eleve",
    customQuestion: "Question personnalisee",
    hideCustomQuestion: "Masquer la question",
    promptLabel: "Enonce",
    enterYourQuestion: "Saisissez votre question",
    optionLabel: "Option {number}",
    markCorrect: "Marquer",
    correctOption: "Correcte",
    explanationOptional: "Explication (facultatif)",
    addCustomQuestion: "Ajouter la question",
    loadQuestionCandidates: "Charger les questions",
    loadMoreQuestions: "Charger plus de questions",
    accept: "Accepter",
    skip: "Passer",
    reviewLabel: "Revoir",
    previous: "Precedent",
    next: "Suivant",
    publishTest: "Publier le test",
    publishAssignment: "Publier le devoir",
    joinClass: "Rejoindre une classe",
    enterClassCode: "Saisir le code de la classe",
    requestJoin: "Demander a rejoindre",
    invites: "Invitations",
    noInvites: "Aucune invitation.",
    teacherLabel: "Professeur",
    approve: "Approuver",
    reject: "Refuser",
    publishedActivities: "Activites publiees",
    classActivities: "Activites de la classe",
    noActivitiesYet: "Aucune activite pour le moment.",
    closedLabel: "Cloture",
    submittedLabel: "Soumis",
    startsLabel: "Commence {value}",
    openUntilLabel: "Ouvert jusqu'au {value}",
    questionsLabel: "Questions : {count}",
    viewResult: "Voir le resultat",
    waitForStart: "Attendre le debut",
    remove: "Retirer",
    edit: "Modifier",
    locked: "Verrouille",
    duplicate: "Dupliquer",
    schoolName: "Nom de l'ecole",
    teachingFocus: "Domaine d'enseignement",
    optional: "Facultatif",
    teacherAccount: "Compte enseignant",
    competitionWins: "Victoires",
    challengesPlayed: "Defis joues",
    classCode: "Code",
    loadingClassroom: "Chargement de la classe...",
    chooseProfileBeforeClassroom: "Choisissez ou creez un profil avant d'utiliser les outils de classe.",
    activityDetailsLabel: "Details de l'activite",
    resultsLabel: "Resultats",
    questionOrderLabel: "Ordre des questions",
    questionCountLabel: "Nombre de questions",
    resultsAction: "Resultats",
    copyClassCodeSuccess: "Code de la classe copie.",
    copyClassCodeFailure: "Impossible de copier le code de la classe.",
    enterClassNameFirst: "Saisissez d'abord un nom de classe.",
    unableCreateClass: "Impossible de creer la classe.",
    enterClassCodeFirst: "Saisissez d'abord un code de classe.",
    joinRequestSent: "Demande envoyee",
    unableSendJoinRequest: "Impossible d'envoyer la demande.",
    selectClassAndStudentFirst: "Choisissez une classe et saisissez d'abord un ID eleve.",
    inviteSent: "Invitation envoyee",
    unableInviteStudent: "Impossible d'inviter l'eleve.",
    unableRemoveMember: "Impossible de retirer le membre.",
    unableUpdateRequest: "Impossible de mettre a jour la demande.",
    questionSelectionTitle: "Selection des questions",
    enterCustomTopicFirst: "Saisissez d'abord le sujet personnalise.",
    unableLoadCandidateQuestions: "Impossible de charger les questions proposees.",
    customQuestionTitle: "Question personnalisee",
    enterQuestionPrompt: "Saisissez l'enonce de la question.",
    fillAllFourAnswerOptions: "Remplissez les quatre options de reponse.",
    chooseCorrectAnswer: "Choisissez la bonne reponse.",
    markedCorrectOptionEmpty: "L'option marquee correcte ne peut pas etre vide.",
    questionCountAlreadyComplete: "Le nombre de questions est deja atteint.",
    teacherAuthoredQuestion: "Question redigee par l'enseignant.",
    publishAssignmentTitle: "Devoir",
    acceptQuestionsBeforePublishing: "Acceptez {count} questions avant la publication.",
    enterAssignmentTitleFirst: "Saisissez d'abord un titre pour le devoir.",
    publishTestTitle: "Test",
    enterValidTestStart: "Saisissez une date de test et une heure de debut valides.",
    enterValidDurationSeconds: "Saisissez une duree valide en secondes.",
    endTimeLaterThanStart: "L'heure de fin doit etre apres l'heure de debut.",
    testEndSameDay: "L'heure de fin du test doit rester le meme jour que la date du test.",
    enterValidDeadline: "Saisissez une date et une heure limites valides.",
    deadlineMustBeFuture: "La date limite doit etre dans le futur.",
    activityUpdatedTitle: "Activite mise a jour",
    testPublishedTitle: "Test publie",
    assignmentPublishedTitle: "Devoir publie",
    activityChangesSaved: "Les modifications de l'activite ont ete enregistrees.",
    testReadyForClass: "Votre test programme est maintenant pret pour la classe.",
    assignmentReadyForClass: "Votre devoir est maintenant disponible pour la classe.",
    unablePublishActivity: "Impossible de publier l'activite.",
    unableDuplicateActivity: "Impossible de dupliquer l'activite.",
    testEditLocked: "Les tests ne peuvent plus etre modifies dans les 5 minutes precedant l'heure de debut.",
    unableLoadActivityForEditing: "Impossible de charger l'activite pour modification.",
    selectTimeTitle: "Choisir l'heure",
    setTime: "Definir l'heure",
    createProfileSubtitle: "Configurez ce profil d'apprenant et enregistrez les informations.",
    createProfile: "Creer un profil",
    editProfile: "Modifier le profil",
    name: "Nom",
    age: "Age",
    targetExam: "Examen cible",
    preferredCurriculum: "Programme scolaire prefere",
    preferredCurriculumPlaceholder: "p. ex. nigerian, britannique, Cambridge ou IB",
    dailyGoalMinutes: "Objectif quotidien en minutes",
    language: "Langue",
    cancel: "Annuler",
    saveChanges: "Enregistrer",
    homeCreateProfile: "Creer un profil",
    homeOpenProfile: "Ouvrir le profil",
    homeChooseLearner: "Choisir un eleve",
    selectLearnerPrompt: "Choisissez un eleve ci-dessous puis commencez l'entrainement.",
    updateLearnerDetails: "Mettez a jour les informations de cet apprenant et enregistrez les modifications.",
    backHome: "Retour accueil",
    chooseLearner: "Choisir l'apprenant",
    createLearner: "Creer un apprenant",
    noProfilesYet: "Aucun profil eleve pour le moment.",
    studentsList: "Liste des eleves",
    currentLearner: "Apprenant actuel",
    todaysStudyTime: "Temps d'etude aujourd'hui",
    historyDaySummary: "{count} session(s) enregistree(s) le {date}.",
    learningRecord: "Historique d'apprentissage",
    profileDetails: "Details du profil",
    bestScore: "Meilleur score",
    sessionsCompleted: "Sessions terminees",
    latestScore: "Dernier score",
    dailyTarget: "Objectif quotidien",
    currentLanguage: "Langue actuelle",
    chooseMode: "Choisir le mode",
    grade: "Classe",
    questionFocus: "Type de questions",
    chooseTopic: "Choisir un theme",
    unlockedLevels: "Niveaux debloques",
    difficulty: "Difficulte",
    preparingSession: "Preparation de la session",
    excellentWork: "Excellent travail",
    greatJob: "Bravo",
    keepTrying: "Continue",
    performanceMessage: "Message de performance",
    sessionSummary: "Resume de session",
    studyPlan: "Plan d'etude",
    sessionTitle: "Session de {subject}",
    selectedGradeStartHint: "Classe choisie : {grade}. Choisis la difficulte puis commence ton {mode}.",
    chooseGradeStartHint: "Choisis une classe puis commence ton {mode}.",
    levelLabel: "Niveau",
    difficultyBeginner: "Debutant",
    difficultyIntermediate: "Intermediaire",
    difficultyAdvanced: "Avance",
    difficultyExpert: "Expert",
    topicPracticeDescription: "Pratique ciblee sur {topic}.",
    aiCoachDescription: "{appName} peut generer des series de questions, des retours et des plans d'etude pour {subject}.",
    noneSelected: "Aucun",
    completedLabel: "termine",
    storyLabel: "Lecture",
    whatThisTeaches: "Ce que cela enseigne",
  },
  es: {
    ...english,
    createProfile: "Crear perfil",
    editProfile: "Editar perfil",
    name: "Nombre",
    age: "Edad",
    targetExam: "Examen objetivo",
    preferredCurriculum: "Plan de estudios preferido",
    preferredCurriculumPlaceholder: "p. ej., nigeriano, britanico, Cambridge o IB",
    dailyGoalMinutes: "Meta diaria en minutos",
    language: "Idioma",
    cancel: "Cancelar",
    saveChanges: "Guardar cambios",
    homeCreateProfile: "Crear perfil",
    homeOpenProfile: "Abrir perfil",
    homeChooseLearner: "Elegir estudiante",
    selectLearnerPrompt: "Elige un estudiante abajo y empieza a practicar.",
    backHome: "Volver al inicio",
    chooseLearner: "Elegir estudiante",
    createLearner: "Crear estudiante",
    studentsList: "Lista de estudiantes",
    currentLearner: "Estudiante actual",
    todaysStudyTime: "Tiempo de estudio de hoy",
    historyDaySummary: "{count} sesion(es) registradas el {date}.",
    learningRecord: "Registro de aprendizaje",
    profileDetails: "Detalles del perfil",
    chooseMode: "Elegir modo",
    questionFocus: "Enfoque de preguntas",
    chooseTopic: "Elegir tema",
    unlockedLevels: "Niveles desbloqueados",
    difficulty: "Dificultad",
    preparingSession: "Preparando tu sesion",
    performanceMessage: "Mensaje de rendimiento",
    studyPlan: "Plan de estudio",
    sessionTitle: "Sesion de {subject}",
    selectedGradeStartHint: "Grado seleccionado: {grade}. Elige la dificultad y comienza tu {mode}.",
    chooseGradeStartHint: "Elige un grado y comienza tu {mode}.",
    levelLabel: "Nivel",
    difficultyBeginner: "Principiante",
    difficultyIntermediate: "Intermedio",
    difficultyAdvanced: "Avanzado",
    difficultyExpert: "Experto",
    topicPracticeDescription: "Practica enfocada en {topic}.",
    aiCoachDescription: "{appName} puede generar series de preguntas, comentarios y planes de estudio para {subject}.",
    noneSelected: "Ninguno",
    completedLabel: "completado",
    storyLabel: "Lectura",
    whatThisTeaches: "Lo que esto ensena",
  },
  pt: {
    ...english,
    createProfile: "Criar perfil",
    editProfile: "Editar perfil",
    name: "Nome",
    age: "Idade",
    targetExam: "Exame alvo",
    preferredCurriculum: "Curriculo preferido",
    preferredCurriculumPlaceholder: "ex.: nigeriano, britanico, Cambridge ou IB",
    dailyGoalMinutes: "Meta diaria em minutos",
    language: "Idioma",
    cancel: "Cancelar",
    saveChanges: "Salvar alteracoes",
    homeCreateProfile: "Criar perfil",
    homeOpenProfile: "Abrir perfil",
    homeChooseLearner: "Escolher estudante",
    selectLearnerPrompt: "Escolha um estudante abaixo e comece a praticar.",
    backHome: "Voltar ao inicio",
    chooseLearner: "Escolher estudante",
    createLearner: "Criar estudante",
    studentsList: "Lista de estudantes",
    currentLearner: "Estudante atual",
    todaysStudyTime: "Tempo de estudo de hoje",
    historyDaySummary: "{count} sessao(oes) registada(s) em {date}.",
    learningRecord: "Registro de aprendizagem",
    profileDetails: "Detalhes do perfil",
    chooseMode: "Escolher modo",
    questionFocus: "Foco das questoes",
    chooseTopic: "Escolher topico",
    unlockedLevels: "Niveis desbloqueados",
    difficulty: "Dificuldade",
    preparingSession: "Preparando sua sessao",
    performanceMessage: "Mensagem de desempenho",
    studyPlan: "Plano de estudo",
    sessionTitle: "Sessao de {subject}",
    selectedGradeStartHint: "Classe selecionada: {grade}. Escolha a dificuldade e inicie sua {mode}.",
    chooseGradeStartHint: "Escolha uma classe e inicie sua {mode}.",
    levelLabel: "Nivel",
    difficultyBeginner: "Iniciante",
    difficultyIntermediate: "Intermedio",
    difficultyAdvanced: "Avancado",
    difficultyExpert: "Especialista",
    topicPracticeDescription: "Pratica focada em {topic}.",
    aiCoachDescription: "{appName} pode gerar conjuntos de perguntas, feedback e planos de estudo para {subject}.",
    noneSelected: "Nenhum",
    completedLabel: "concluido",
    storyLabel: "Leitura",
    whatThisTeaches: "O que isto ensina",
  },
  zh: {
    ...english,
    createProfile: "创建档案",
    editProfile: "编辑档案",
    updateLearnerDetails: "更新这位学习者的资料并保存更改。",
    nameRequiredTitle: "需要姓名",
    nameRequiredMessage: "请输入学习者姓名。",
    invalidAgeTitle: "年龄无效",
    invalidAgeMessage: "请输入有效年龄。",
    invalidGoalTitle: "目标无效",
    invalidGoalMessage: "每日目标至少需要 5 分钟。",
    name: "姓名",
    age: "年龄",
    targetExam: "目标考试",
    preferredCurriculum: "首选课程体系",
    preferredCurriculumPlaceholder: "例如：尼日利亚、英国、剑桥或 IB 课程",
    dailyGoalMinutes: "每日目标分钟数",
    language: "语言",
    cancel: "取消",
    saveChanges: "保存更改",
    enterLearnerName: "输入学习者姓名",
    homeCreateProfile: "创建档案",
    homeOpenProfile: "打开档案",
    homeChooseLearner: "选择学习者",
    studentsList: "学生列表",
    selectLearnerPrompt: "请先选择学习者，然后开始练习。",
    noProfilesYet: "还没有学生档案。",
    createFirstLearner: "创建第一位学习者",
    selected: "已选中",
    select: "选择",
    lastActivity: "最近活动",
    noSessionsYet: "还没有学习记录",
    currentLearner: "当前学习者",
    ready: "已准备",
    highestUnlockedBySubject: "各科最高解锁进度",
    noUnlockedProgressYet: "还没有解锁进度。",
    noStudentSelected: "尚未选择学生",
    pickLearnerFirst: "请先在学生列表中选择学习者，然后再打开科目。",
    subjectsHintSelected: "{name}，请选择一个{item}。",
    subjectsHintUnselected: "请先选择学生，然后再选择{item}。",
    backHome: "返回首页",
    chooseLearner: "选择学习者",
    whoIsPracticing: "今天是谁在练习 {subject}？",
    selectLearnerForSession: "请选择本次学习的学习者。",
    use: "使用",
    createLearner: "创建学习者",
    profileNoSelection: "尚未选择学生",
    profileCreateOrChoose: "请先创建档案，或返回首页选择学习者。",
    todaysStudyTime: "今日学习时间",
    targetExceeded: "已超过今日目标，做得非常好。",
    targetReached: "已达到今日目标，干得漂亮。",
    targetNotReached: "今日目标尚未完成，还差 {minutes} 分钟。",
    noTargetYet: "暂时还没有学习目标。",
    learningRecord: "学习记录",
    bestScore: "最高分",
    sessionsCompleted: "已完成学习次数",
    latestScore: "最近成绩",
    profileDetails: "档案详情",
    dailyTarget: "每日目标",
    editProfileAction: "编辑档案",
    createAnotherProfile: "再创建一个档案",
    highestAttained: "最高达到",
    notReachedYet: "尚未达到",
    chooseMode: "选择模式",
    grade: "年级",
    chooseGradeFirst: "请先选择年级，已解锁等级会显示在开始卡片中。",
    openSetup: "打开{mode}设置",
    activeLearner: "当前学习者",
    subjectNotFound: "未找到科目",
    courseNotFound: "未找到课程",
    general: "综合",
    topicFocus: "专题练习",
    specialized: "专项",
    questionFocus: "题目范围",
    generalHint: "综合模式会从这个{item}的不同主题中混合出题。",
    specializedHint: "专项模式会把整套练习限定在一个学术主题内。",
    topicHint: "专题练习会把整套练习限定在一个主题内。",
    chooseTopic: "选择主题",
    selectTopic: "选择主题",
    topicPickerHint: "点击可从完整主题列表中选择。",
    unlockedLevels: "已解锁等级",
    highestUnlockedSelected: "{grade} 已为你默认选中最高解锁等级。",
    difficulty: "难度",
    start: "开始{mode}",
    preparingSession: "正在准备学习环节",
    loadingQuestionsFor: "正在为 {subject} 加载题目。",
    unableToStartSession: "无法开始学习",
    questionGenerationFailed: "题目生成失败。请检查 AI 配置或改用演示模式。",
    topicFocusLabel: "专题：{topic}",
    generalMixedPractice: "综合混合练习",
    testSourceAi: "测试来源：AI",
    testSourceLocal: "测试来源：本地题库",
    testSourceDemo: "测试来源：演示",
    questionCount: "第 {current} 题，共 {total} 题",
    correct: "正确",
    keepGoing: "继续努力",
    nextQuestion: "下一题",
    noResultFound: "未找到结果",
    excellentWork: "表现非常出色",
    greatJob: "做得很好",
    keepTrying: "继续加油",
    passedLevel: "你已通过 {subject} 的第 {level} 级。",
    notPassedLevel: "你还没有通过 {subject} 的第 {level} 级，但再练习一次就会更好。",
    rewardUnlocked: "奖励已解锁",
    takeLearningBreather: "进入学习放松环节",
    breatherRewardText: "你已经在 {subject} 中连续通过了 {count} 个{levelWord}。如果你愿意，现在可以先进行一个简短放松后再继续。",
    performanceMessage: "表现反馈",
    sessionSummary: "学习总结",
    correctAnswers: "答对题数",
    timeUsed: "用时",
    coinsEarned: "获得金币",
    mode: "模式",
    focus: "范围",
    studyPlan: "学习计划",
    skipBreatherAndContinue: "跳过放松并继续",
    nextLevel: "下一等级",
    repeatThisLevel: "重做本等级",
    breatherNotAvailable: "暂时无法打开放松环节",
    learningBreather: "学习放松",
    revisionBreather: "复习放松",
    studyBreather: "学习缓冲",
    quickTakeaways: "快速要点",
    reflection: "思考",
    continueLearning: "继续学习",
    currentLanguage: "当前语言",
  },
  ar: {
    ...english,
    createProfile: "إنشاء ملف",
    editProfile: "تعديل الملف",
    updateLearnerDetails: "حدّث بيانات هذا المتعلم ثم احفظ التغييرات.",
    nameRequiredTitle: "الاسم مطلوب",
    nameRequiredMessage: "يرجى إدخال اسم المتعلم.",
    invalidAgeTitle: "العمر غير صالح",
    invalidAgeMessage: "يرجى إدخال عمر صحيح.",
    invalidGoalTitle: "الهدف غير صالح",
    invalidGoalMessage: "يجب أن يكون الهدف اليومي 5 دقائق على الأقل.",
    name: "الاسم",
    age: "العمر",
    targetExam: "الامتحان المستهدف",
    preferredCurriculum: "المنهج الدراسي المفضل",
    preferredCurriculumPlaceholder: "مثال: النيجيري أو البريطاني أو كامبردج أو البكالوريا الدولية",
    dailyGoalMinutes: "الهدف اليومي بالدقائق",
    language: "اللغة",
    cancel: "إلغاء",
    saveChanges: "حفظ التغييرات",
    enterLearnerName: "أدخل اسم المتعلم",
    homeCreateProfile: "إنشاء ملف",
    homeOpenProfile: "فتح الملف",
    homeChooseLearner: "اختيار المتعلم",
    studentsList: "قائمة الطلاب",
    selectLearnerPrompt: "اختر متعلماً من القائمة وابدأ التدريب.",
    noProfilesYet: "لا توجد ملفات طلاب بعد.",
    createFirstLearner: "إنشاء أول متعلم",
    selected: "تم الاختيار",
    select: "اختيار",
    lastActivity: "آخر نشاط",
    noSessionsYet: "لا توجد جلسات بعد",
    currentLearner: "المتعلم الحالي",
    ready: "جاهز",
    highestUnlockedBySubject: "أعلى تقدم مفتوح حسب المادة",
    noUnlockedProgressYet: "لا يوجد تقدم مفتوح بعد.",
    noStudentSelected: "لم يتم اختيار طالب",
    pickLearnerFirst: "اختر متعلماً من قائمة الطلاب قبل فتح أي مادة.",
    subjectsHintSelected: "{name}، اختر {item} مناسباً.",
    subjectsHintUnselected: "اختر طالباً أولاً ثم اختر {item}.",
    backHome: "العودة للرئيسية",
    chooseLearner: "اختر المتعلم",
    whoIsPracticing: "من يتدرب على {subject} اليوم؟",
    selectLearnerForSession: "اختر المتعلم لهذه الجلسة.",
    use: "استخدام",
    createLearner: "إنشاء متعلم",
    profileNoSelection: "لم يتم اختيار طالب",
    profileCreateOrChoose: "أنشئ ملفاً أولاً أو عد إلى الصفحة الرئيسية واختر متعلماً.",
    todaysStudyTime: "وقت الدراسة اليوم",
    targetExceeded: "تم تجاوز الهدف اليومي. التزام رائع اليوم.",
    targetReached: "تم الوصول إلى الهدف اليومي. أحسنت.",
    targetNotReached: "لم يتم الوصول إلى الهدف اليومي بعد. متبقٍ {minutes} دقيقة.",
    noTargetYet: "لا يوجد هدف دراسي متاح بعد.",
    learningRecord: "سجل التعلم",
    bestScore: "أفضل نتيجة",
    sessionsCompleted: "الجلسات المكتملة",
    latestScore: "آخر نتيجة",
    profileDetails: "تفاصيل الملف",
    dailyTarget: "الهدف اليومي",
    editProfileAction: "تعديل الملف",
    createAnotherProfile: "إنشاء ملف آخر",
    highestAttained: "أعلى مستوى تم بلوغه",
    notReachedYet: "لم يتم بلوغه بعد",
    chooseMode: "اختر الوضع",
    grade: "الصف",
    chooseGradeFirst: "اختر الصف أولاً، وستظهر المستويات المفتوحة في بطاقة البدء.",
    openSetup: "فتح إعداد {mode}",
    activeLearner: "المتعلم النشط",
    subjectNotFound: "المادة غير موجودة",
    courseNotFound: "المقرر غير موجود",
    general: "عام",
    topicFocus: "تركيز على موضوع",
    specialized: "متخصص",
    questionFocus: "تركيز الأسئلة",
    generalHint: "الوضع العام يخلط الأسئلة من مواضيع مختلفة داخل هذا {item}.",
    specializedHint: "الوضع المتخصص يجعل الجلسة كلها داخل موضوع أكاديمي واحد.",
    topicHint: "تركيز الموضوع يجعل الجلسة كلها داخل موضوع واحد محدد.",
    chooseTopic: "اختر موضوعاً",
    selectTopic: "اختيار الموضوع",
    topicPickerHint: "اضغط لاختيار موضوع من القائمة الكاملة.",
    unlockedLevels: "المستويات المفتوحة",
    highestUnlockedSelected: "تم اختيار أعلى مستوى مفتوح في {grade} لك تلقائياً.",
    difficulty: "الصعوبة",
    start: "ابدأ {mode}",
    preparingSession: "جار تجهيز الجلسة",
    loadingQuestionsFor: "جار تحميل الأسئلة لمادة {subject}.",
    unableToStartSession: "تعذر بدء الجلسة",
    questionGenerationFailed: "فشل إنشاء الأسئلة. تحقق من إعدادات الذكاء الاصطناعي أو استخدم وضع العرض.",
    topicFocusLabel: "تركيز الموضوع: {topic}",
    generalMixedPractice: "ممارسة عامة مختلطة",
    testSourceAi: "مصدر الاختبار: الذكاء الاصطناعي",
    testSourceLocal: "مصدر الاختبار: البنك المحلي",
    testSourceDemo: "مصدر الاختبار: العرض",
    questionCount: "السؤال {current} من {total}",
    correct: "صحيح",
    keepGoing: "واصل المحاولة",
    nextQuestion: "السؤال التالي",
    noResultFound: "لم يتم العثور على النتيجة",
    excellentWork: "عمل ممتاز",
    greatJob: "أحسنت",
    keepTrying: "استمر بالمحاولة",
    passedLevel: "لقد اجتزت المستوى {level} في {subject}.",
    notPassedLevel: "لم تجتز المستوى {level} في {subject} بعد، لكن يمكنك التحسن بمحاولة أخرى.",
    rewardUnlocked: "تم فتح المكافأة",
    takeLearningBreather: "خذ استراحة تعليمية",
    breatherRewardText: "لقد اجتزت {count} {levelWord} في {subject}. توجد استراحة قصيرة جاهزة إذا أردت قبل التمرين التالي.",
    performanceMessage: "رسالة الأداء",
    sessionSummary: "ملخص الجلسة",
    correctAnswers: "الإجابات الصحيحة",
    timeUsed: "الوقت المستخدم",
    coinsEarned: "العملات المكتسبة",
    mode: "الوضع",
    focus: "التركيز",
    studyPlan: "خطة الدراسة",
    skipBreatherAndContinue: "تخطَّ الاستراحة وتابع",
    nextLevel: "المستوى التالي",
    repeatThisLevel: "أعد هذا المستوى",
    breatherNotAvailable: "الاستراحة غير متاحة",
    learningBreather: "استراحة تعلم",
    revisionBreather: "استراحة مراجعة",
    studyBreather: "استراحة دراسة",
    quickTakeaways: "نقاط سريعة",
    reflection: "تأمل",
    continueLearning: "واصل التعلم",
    currentLanguage: "اللغة الحالية",
  },
  sw: {
    ...english,
    createProfile: "Tengeneza wasifu",
    editProfile: "Hariri wasifu",
    name: "Jina",
    age: "Umri",
    targetExam: "Mtihani lengwa",
    preferredCurriculum: "Mtaala unaopendelewa",
    preferredCurriculumPlaceholder: "mf. Nigeria, Uingereza, Cambridge au IB",
    dailyGoalMinutes: "Lengo la kila siku kwa dakika",
    language: "Lugha",
    cancel: "Ghairi",
    saveChanges: "Hifadhi mabadiliko",
    homeCreateProfile: "Tengeneza wasifu",
    homeOpenProfile: "Fungua wasifu",
    homeChooseLearner: "Chagua mwanafunzi",
    selectLearnerPrompt: "Chagua mwanafunzi hapa chini kisha uanze kufanya mazoezi.",
    backHome: "Rudi nyumbani",
    chooseLearner: "Chagua mwanafunzi",
    createLearner: "Unda mwanafunzi",
    studentsList: "Orodha ya wanafunzi",
    currentLearner: "Mwanafunzi wa sasa",
    todaysStudyTime: "Muda wa masomo wa leo",
    historyDaySummary: "Vipindi {count} vimerekodiwa tarehe {date}.",
    learningRecord: "Rekodi ya kujifunza",
    profileDetails: "Maelezo ya wasifu",
    chooseMode: "Chagua hali",
    questionFocus: "Mwelekeo wa maswali",
    chooseTopic: "Chagua mada",
    unlockedLevels: "Ngazi zilizofunguliwa",
    difficulty: "Ugumu",
    preparingSession: "Inaandaa kipindi chako",
    performanceMessage: "Ujumbe wa utendaji",
    studyPlan: "Mpango wa kusoma",
    sessionTitle: "Kipindi cha {subject}",
    selectedGradeStartHint: "Darasa lililochaguliwa: {grade}. Chagua ugumu na uanze {mode} yako.",
    chooseGradeStartHint: "Chagua darasa kisha uanze {mode} yako.",
    levelLabel: "Ngazi",
    difficultyBeginner: "Mwanzo",
    difficultyIntermediate: "Wastani",
    difficultyAdvanced: "Juu",
    difficultyExpert: "Bingwa",
    topicPracticeDescription: "Mazoezi maalum ya {topic}.",
    aiCoachDescription: "{appName} inaweza kutengeneza seti za maswali, mrejesho na mipango ya kusoma kwa {subject}.",
    noneSelected: "Hakuna",
    completedLabel: "imekamilika",
    storyLabel: "Usomaji",
    whatThisTeaches: "Hiki kinafundisha nini",
  },
};

export function normalizeLanguage(value?: string | null): AppLanguage {
  return LANGUAGE_OPTIONS.some((entry) => entry.code === value) ? (value as AppLanguage) : DEFAULT_LANGUAGE;
}

export function getLanguageLabel(language: AppLanguage) {
  return LANGUAGE_OPTIONS.find((entry) => entry.code === language)?.nativeLabel ?? "English";
}

export function getLanguagePromptLabel(language: AppLanguage) {
  return LANGUAGE_OPTIONS.find((entry) => entry.code === language)?.englishLabel ?? "English";
}

export function t(language: AppLanguage | undefined, key: TranslationKey, vars?: Record<string, string | number>) {
  let template = (translations[normalizeLanguage(language)] ?? english)[key] ?? english[key];
  if (vars) {
    Object.entries(vars).forEach(([name, value]) => {
      template = template.replaceAll(`{${name}}`, String(value));
    });
  }
  return template;
}

export function getDifficultyLabel(language: AppLanguage | undefined, difficulty: string) {
  switch (difficulty) {
    case "Beginner":
      return t(language, "difficultyBeginner");
    case "Intermediate":
      return t(language, "difficultyIntermediate");
    case "Advanced":
      return t(language, "difficultyAdvanced");
    case "Expert":
      return t(language, "difficultyExpert");
    default:
      return difficulty;
  }
}
