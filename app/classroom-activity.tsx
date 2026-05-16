import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { getClassroomActivityDetails } from "../services/ai";
import type {
  ClassroomActivityDetailsResponse,
  ClassroomSubmissionSummary,
  SubscriptionTier,
  UserProfile,
} from "../types/app";

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function getAverageScore(submissions: ClassroomSubmissionSummary[]) {
  if (submissions.length === 0) {
    return 0;
  }

  return Math.round(
    submissions.reduce((sum, submission) => sum + submission.score, 0) / submissions.length
  );
}

export default function ClassroomActivityScreen() {
  const params = useLocalSearchParams<{ activityId?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [details, setDetails] = useState<ClassroomActivityDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [params.activityId])
  );

  const loadData = async () => {
    setLoading(true);
    const state = await readAppState();
    if (!state.isAuthenticated) {
      router.replace({ pathname: "/login" } as never);
      return;
    }

    const activeProfile = state.profiles.find((entry) => entry.id === state.currentProfileId) ?? null;
    setProfile(activeProfile);
    setSubscriptionTier(state.subscriptionTier);

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
  const highestScore = submittedLearners.length > 0 ? Math.max(...submittedLearners.map((entry) => entry.score)) : 0;
  const averageScore = getAverageScore(submissions);
  const isTeacher = details?.activity.teacherProfileId === profile?.id;

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
          {details.activity.type === "test" ? "Test" : "Assignment"} | {details.className}
        </Text>
        <Text style={styles.heroMeta}>
          {details.activity.subjectName} | {details.activity.grade} | Level {details.activity.level}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity setup</Text>
          <Text style={styles.bodyText}>Teacher: {details.teacherName}</Text>
          <Text style={styles.bodyText}>Questions: {details.activity.questionCount}</Text>
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
              .map((submission) => (
                <View key={`${submission.profileId}-${submission.status}`} style={styles.resultRow}>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultName}>{submission.studentName}</Text>
                    <Text style={styles.resultSubtext}>{submission.quiksId}</Text>
                    <Text style={styles.resultSubtext}>
                      {submission.correctAnswers}/{submission.totalQuestions} correct
                    </Text>
                  </View>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeValue}>{submission.score}%</Text>
                    <Text style={styles.resultBadgeTime}>{submission.timeTakenSeconds}s</Text>
                  </View>
                </View>
              ))
          )}
        </View>

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

        {subscriptionTier === "free" ? <DemoAdBanner language={profile.language} /> : null}
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
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
});
