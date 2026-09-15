import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { t } from "../lib/i18n";
import { canUseClassroom } from "../lib/subscription";
import { readAppState } from "../lib/storage";
import { getSubjectDisplayName } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { getClassroomActivityDetails, gradeClassroomActivitySubmission, publishClassroomActivityResultsToSchool } from "../services/ai";
import type {
  ClassroomActivityDetailsResponse,
  ClassroomSubmissionDetail,
  ClassroomSubmissionSummary,
  UserProfile,
} from "../types/app";

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function formatSubmissionTime(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "Time unavailable";
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).replace(/\s/g, "").toLowerCase();
}

function getAverageScore(submissions: ClassroomSubmissionSummary[]) {
  if (submissions.length === 0) {
    return 0;
  }

  return Math.round(
    submissions.reduce((sum, submission) => sum + submission.score, 0) / submissions.length
  );
}

function activityTypeLabel(type: string) {
  return type === "exam" ? "Exam" : type === "test" ? "Test" : "Assignment";
}

export default function ClassroomActivityScreen() {
  const params = useLocalSearchParams<{ activityId?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [details, setDetails] = useState<ClassroomActivityDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [markingSubmissionId, setMarkingSubmissionId] = useState<string | null>(null);
  const [writtenMarks, setWrittenMarks] = useState<Record<string, { awardedPoints: string; feedback: string }>>({});
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [savingMarks, setSavingMarks] = useState(false);
  const [publishingSchoolResults, setPublishingSchoolResults] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [params.activityId])
  );

  const loadData = async () => {
    setLoading(true);
    const state = await readAppState();
    if (!state.isAuthenticated) {
      router.replace({ pathname: "/signup" } as never);
      return;
    }

    const activeProfile = state.profiles.find((entry) => entry.id === state.currentProfileId) ?? null;
    setProfile(activeProfile);

    if (!canUseClassroom(state.subscriptionTier)) {
      setPremiumBlocked(true);
      setLoading(false);
      return;
    }
    setPremiumBlocked(false);

    if (!activeProfile || !params.activityId || Array.isArray(params.activityId)) {
      setLoading(false);
      return;
    }

    try {
      const response = await getClassroomActivityDetails({
        profile: activeProfile,
        activityId: params.activityId,
      });
      setDetails(response);
    } catch {
      setDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const submissions = details?.submissions ?? [];
  const submittedLearners = useMemo(
    () => submissions.filter((entry) => entry.status === "submitted"),
    [submissions]
  );
  const absentLearners = useMemo(
    () => submissions.filter((entry) => entry.status === "absent"),
    [submissions]
  );
  const finalizedLearners = useMemo(
    () => submittedLearners.filter((entry) => entry.gradingStatus !== "awaiting_marking"),
    [submittedLearners]
  );
  const highestScore = finalizedLearners.length > 0 ? Math.max(...finalizedLearners.map((entry) => entry.score)) : 0;
  const averageScore = getAverageScore(finalizedLearners);
  const isTeacher = details?.activity.teacherProfileId === profile?.id;
  const selectedSubmission = useMemo(
    () => details?.submissionDetails?.find((entry) => entry.submissionId === markingSubmissionId) ?? null,
    [details?.submissionDetails, markingSubmissionId]
  );

  const openMarking = (submission: ClassroomSubmissionDetail) => {
    if (!submission.submissionId) return;
    const nextMarks: Record<string, { awardedPoints: string; feedback: string }> = {};
    submission.responses.filter((response) => response.type === "written").forEach((response) => {
      nextMarks[response.questionId] = {
        awardedPoints: response.awardedPoints == null ? "" : String(response.awardedPoints),
        feedback: response.teacherFeedback ?? "",
      };
    });
    setWrittenMarks(nextMarks);
    setTeacherFeedback(submission.teacherFeedback ?? "");
    setMarkingSubmissionId(submission.submissionId);
  };

  const saveWrittenMarks = async () => {
    if (!profile || !details || !selectedSubmission?.submissionId) return;
    const writtenResponses = selectedSubmission.responses.filter((response) => response.type === "written");
    const grades = writtenResponses.map((response) => ({
      questionId: response.questionId,
      awardedPoints: Number(writtenMarks[response.questionId]?.awardedPoints),
      feedback: writtenMarks[response.questionId]?.feedback?.trim() || undefined,
    }));
    if (grades.some((grade, index) => !Number.isFinite(grade.awardedPoints) || grade.awardedPoints < 0 || grade.awardedPoints > writtenResponses[index].points)) {
      Alert.alert("Check written marks", "Enter a mark from zero up to the maximum shown for every written question.");
      return;
    }
    setSavingMarks(true);
    try {
      await gradeClassroomActivitySubmission({
        teacherProfile: profile,
        activityId: details.activity.activityId,
        submissionId: selectedSubmission.submissionId,
        grades,
        teacherFeedback: teacherFeedback.trim() || undefined,
      });
      setMarkingSubmissionId(null);
      await loadData();
      Alert.alert("Marking saved", "The final combined result is now available in the classroom. Submit the activity results when they are ready for the school portal.");
    } catch (error) {
      Alert.alert("Could not save marks", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSavingMarks(false);
    }
  };

  const publishSchoolResults = async () => {
    if (!profile || !details) return;
    setPublishingSchoolResults(true);
    try {
      const result = await publishClassroomActivityResultsToSchool({
        teacherProfile: profile,
        activityId: details.activity.activityId,
      });
      await loadData();
      Alert.alert("Results submitted", `${result.publishedCount} finalized result${result.publishedCount === 1 ? "" : "s"} ${details.activity.schoolResultsPublishedAt ? "were updated in" : "were submitted to"} the school portal.`);
    } catch (error) {
      Alert.alert("Results not submitted", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPublishingSchoolResults(false);
    }
  };

  if (premiumBlocked) {
    return (
      <AppBackground>
        <PremiumFeatureDialog
          visible
          title={t(profile?.language, "classroomTitle")}
          message={t(profile?.language, "classroomProRequired")}
          upgradeLabel={t(profile?.language, "upgradeToPro")}
          cancelLabel={t(profile?.language, "cancel")}
          onClose={() => router.replace("/")}
          onUpgrade={() => router.replace({ pathname: "/subscription", params: { source: "classroom" } } as never)}
        />
      </AppBackground>
    );
  }

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Loading activity dashboard...</Text>
        </View>
      </AppBackground>
    );
  }

  if (!details || !profile) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>We could not load that classroom activity.</Text>
          <PrimaryButton label="Back to Classroom" onPress={() => router.replace("/classroom")} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{details.activity.title}</Text>
        <Text style={styles.heroMeta}>
          {activityTypeLabel(details.activity.type)} | {details.className}
        </Text>
        <Text style={styles.heroMeta}>
          {getSubjectDisplayName(details.activity.subjectId, details.activity.subjectName, profile.language)} | {details.activity.grade} | Level {details.activity.level}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity setup</Text>
          <Text style={styles.bodyText}>Teacher: {details.teacherName}</Text>
          <Text style={styles.bodyText}>Questions: {details.activity.questionCount}</Text>
          <Text style={styles.bodyText}>Answer format: {details.activity.assessmentFormat === "written" ? "Written answers" : details.activity.assessmentFormat === "mixed" ? "Objective and written" : "Objective"}</Text>
          <Text style={styles.bodyText}>Leaving activity: {details.activity.exitPolicy === "strict_submit" ? "Strict CBT mode" : details.activity.exitPolicy === "confirm_submit" ? "Auto-submit on confirmed exit" : "Warn and record"}</Text>
          <Text style={styles.bodyText}>Duration: {details.activity.durationMinutes} minutes</Text>
          <Text style={styles.bodyText}>Starts: {formatDateTime(details.activity.startAt)}</Text>
          <Text style={styles.bodyText}>Ends: {formatDateTime(details.activity.endAt)}</Text>
          <Text style={styles.bodyText}>
            Result visibility: {details.activity.resultVisibility === "public" ? "Public" : "Private"}
          </Text>
          <Text style={styles.bodyText}>
            Question order: {details.activity.questionOrderMode === "same" ? "Same for all students" : "Shuffled per student"}
          </Text>
        </View>

        {isTeacher ? (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Submitted</Text>
                <Text style={styles.statValue}>{submittedLearners.length}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Absent</Text>
                <Text style={styles.statValue}>{absentLearners.length}</Text>
              </View>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Average score</Text>
                <Text style={styles.statValue}>{averageScore}%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Highest score</Text>
                <Text style={styles.statValue}>{highestScore}%</Text>
              </View>
            </View>
            {submittedLearners.some((entry) => entry.gradingStatus === "awaiting_marking") ? (
              <View style={styles.pendingCard}>
                <Text style={styles.pendingTitle}>Written marking required</Text>
                <Text style={styles.bodyText}>{submittedLearners.filter((entry) => entry.gradingStatus === "awaiting_marking").length} submission(s) are awaiting final marking. Pending provisional scores are excluded from the average and highest score.</Text>
              </View>
            ) : null}
            {details.activity.schoolLinked ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>School portal submission</Text>
                <Text style={styles.bodyText}>These classroom results are not sent to School Administration automatically. Review the results and complete all written marking before submitting them.</Text>
                {details.activity.schoolResultsPublishedAt ? <Text style={styles.bodyText}>Last submitted: {formatDateTime(details.activity.schoolResultsPublishedAt)} · {details.activity.schoolResultsPublishedCount ?? 0} result(s)</Text> : <Text style={styles.bodyText}>Status: Not submitted to the school portal</Text>}
                <PrimaryButton
                  label={details.activity.schoolResultsPublishedAt ? "Update results in school portal" : "Submit results to school portal"}
                  onPress={() => {
                    const message = `Submit ${submittedLearners.length} finalized classroom result${submittedLearners.length === 1 ? "" : "s"} to School Administration?`;
                    if (globalThis.confirm && typeof document !== "undefined") {
                      if (globalThis.confirm(message)) void publishSchoolResults();
                    } else {
                      Alert.alert("Submit results to school?", message, [{ text: "Cancel", style: "cancel" }, { text: "Submit", onPress: () => void publishSchoolResults() }]);
                    }
                  }}
                  loading={publishingSchoolResults}
                  disabled={!submittedLearners.length || submittedLearners.some((entry) => entry.gradingStatus === "awaiting_marking")}
                />
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isTeacher ? "Submitted learners" : details.activity.resultVisibility === "public" ? "Class scores" : "Your result"}
          </Text>
          {submittedLearners.length === 0 ? (
            <Text style={styles.bodyText}>No submissions yet.</Text>
          ) : (
            submittedLearners
              .sort((left, right) => {
                if (right.score !== left.score) {
                  return right.score - left.score;
                }

                return left.timeTakenSeconds - right.timeTakenSeconds;
              })
              .map((submission) => {
                const detail = details.submissionDetails?.find((entry) => entry.submissionId === submission.submissionId);
                const pending = submission.gradingStatus === "awaiting_marking";
                return <View key={submission.submissionId ?? `${submission.profileId}-${submission.status}`} style={styles.resultRow}>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultName}>{submission.studentName}</Text>
                    <Text style={styles.resultSubtext}>{submission.quiksId}</Text>
                    <Text style={styles.resultSubtext}>
                      {pending ? "Written answers awaiting teacher marking" : `${submission.correctAnswers}/${submission.totalQuestions} objective answers correct`}
                    </Text>
                    {submission.securityEventCount ? <Text style={styles.warningText}>{submission.securityEventCount} activity exit/security event(s) recorded</Text> : null}
                    {isTeacher && pending && detail ? <Pressable onPress={() => openMarking(detail)} style={styles.markButton}><Text style={styles.markButtonText}>Mark written answers</Text></Pressable> : null}
                  </View>
                  <View style={[styles.resultBadge, pending ? styles.pendingBadge : null]}>
                    <Text style={styles.resultBadgeValue}>{pending ? `${submission.provisionalScore ?? submission.score}%*` : `${submission.score}%`}</Text>
                    <Text style={styles.resultBadgeTime}>{formatSubmissionTime(submission.submittedAt)}</Text>
                  </View>
                </View>
              })
          )}
        </View>

        {isTeacher && selectedSubmission ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mark {selectedSubmission.studentName}'s written answers</Text>
            <Text style={styles.bodyText}>Objective marks have already been calculated securely. Award each written response up to the displayed maximum.</Text>
            {selectedSubmission.responses.filter((response) => response.type === "written").map((response, index) => (
              <View key={response.questionId} style={styles.markingCard}>
                <Text style={styles.markingQuestion}>Question {index + 1}: {response.prompt}</Text>
                <Text style={styles.markingLabel}>Student response</Text>
                <Text style={styles.studentAnswer}>{response.answer || "No answer supplied."}</Text>
                {response.markingGuide ? <><Text style={styles.markingLabel}>Marking guide</Text><Text style={styles.bodyText}>{response.markingGuide}</Text></> : null}
                <Text style={styles.markingLabel}>Mark awarded (maximum {response.points})</Text>
                <TextInput keyboardType="decimal-pad" value={writtenMarks[response.questionId]?.awardedPoints ?? ""} onChangeText={(value) => setWrittenMarks((current) => ({ ...current, [response.questionId]: { awardedPoints: value, feedback: current[response.questionId]?.feedback ?? "" } }))} placeholder={`0 - ${response.points}`} placeholderTextColor="#7C8EA3" style={styles.markInput}/>
                <Text style={styles.markingLabel}>Question feedback (optional)</Text>
                <TextInput value={writtenMarks[response.questionId]?.feedback ?? ""} onChangeText={(value) => setWrittenMarks((current) => ({ ...current, [response.questionId]: { awardedPoints: current[response.questionId]?.awardedPoints ?? "", feedback: value } }))} multiline placeholder="Feedback for this response" placeholderTextColor="#7C8EA3" style={[styles.markInput, styles.feedbackInput]}/>
              </View>
            ))}
            <Text style={styles.markingLabel}>Overall feedback (optional)</Text>
            <TextInput value={teacherFeedback} onChangeText={setTeacherFeedback} multiline placeholder="Overall feedback for the student" placeholderTextColor="#7C8EA3" style={[styles.markInput, styles.feedbackInput]}/>
            <PrimaryButton label="Save final marks" onPress={saveWrittenMarks} loading={savingMarks}/>
            <PrimaryButton label="Cancel marking" variant="secondary" onPress={() => setMarkingSubmissionId(null)} disabled={savingMarks}/>
          </View>
        ) : null}

        {isTeacher ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Absent learners</Text>
            {absentLearners.length === 0 ? (
              <Text style={styles.bodyText}>No absent learners recorded for this activity.</Text>
            ) : (
              absentLearners.map((submission) => (
                <View key={`${submission.profileId}-${submission.status}`} style={styles.resultRow}>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultName}>{submission.studentName}</Text>
                    <Text style={styles.resultSubtext}>{submission.quiksId}</Text>
                    <Text style={styles.resultSubtext}>Did not participate before deadline</Text>
                  </View>
                  <View style={[styles.resultBadge, styles.absentBadge]}>
                    <Text style={styles.resultBadgeValue}>0%</Text>
                    <Text style={styles.resultBadgeTime}>Absent</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.actionColumn}>
          <PrimaryButton label="Back to Classroom" onPress={() => router.replace("/classroom")} />
        </View>

      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 22,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 30,
    fontWeight: "900",
  },
  heroMeta: {
    marginTop: 8,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  centerCard: {
    marginTop: 36,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    ...shadows.card,
  },
  centerTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  bodyText: {
    color: palette.slate,
    lineHeight: 22,
  },
  statRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  statLabel: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statValue: {
    color: palette.navy,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },
  resultRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E3EC",
    backgroundColor: "#FBFDFF",
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  resultMeta: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  resultSubtext: {
    color: palette.slate,
    lineHeight: 20,
  },
  resultBadge: {
    minWidth: 78,
    borderRadius: 16,
    backgroundColor: "#EAF7FD",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  absentBadge: {
    backgroundColor: "#FDECEC",
  },
  resultBadgeValue: {
    color: palette.navy,
    fontSize: 18,
    fontWeight: "900",
  },
  resultBadgeTime: {
    color: palette.slate,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  pendingCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FFF6D8",
    borderWidth: 1,
    borderColor: "#E8C766",
  },
  pendingTitle: { color: "#7A5200", fontSize: 17, fontWeight: "900", marginBottom: 6 },
  pendingBadge: { backgroundColor: "#FFF6D8" },
  warningText: { color: "#9B3A24", fontWeight: "800", fontSize: 12 },
  markButton: { alignSelf: "flex-start", marginTop: 6, backgroundColor: palette.navy, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  markButtonText: { color: palette.white, fontWeight: "900" },
  markingCard: { borderWidth: 1, borderColor: "#D8E3EC", borderRadius: 18, padding: 14, gap: 8 },
  markingQuestion: { color: palette.ink, fontWeight: "900", fontSize: 16, lineHeight: 23 },
  markingLabel: { color: palette.navy, fontWeight: "800", marginTop: 5 },
  studentAnswer: { color: palette.ink, lineHeight: 22, backgroundColor: "#F4F8FA", borderRadius: 12, padding: 12 },
  markInput: { borderWidth: 1, borderColor: "#C9D7E2", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: palette.ink, backgroundColor: palette.white },
  feedbackInput: { minHeight: 84, textAlignVertical: "top" },
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
});
