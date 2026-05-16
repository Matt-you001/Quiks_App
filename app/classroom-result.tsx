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

function sortByScore(entries: ClassroomSubmissionSummary[]) {
  return [...entries].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.timeTakenSeconds - right.timeTakenSeconds;
  });
}

export default function ClassroomResultScreen() {
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

  const visibleSubmissions = details?.submissions ?? [];
  const orderedSubmissions = useMemo(() => sortByScore(visibleSubmissions), [visibleSubmissions]);
  const ownSubmission = useMemo(
    () => orderedSubmissions.find((entry) => entry.profileId === profile?.id) ?? null,
    [orderedSubmissions, profile?.id]
  );
  const ownRank = useMemo(
    () => (ownSubmission ? orderedSubmissions.findIndex((entry) => entry.profileId === ownSubmission.profileId) + 1 : null),
    [orderedSubmissions, ownSubmission]
  );
  const isPublic = details?.activity.resultVisibility === "public";

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Loading classroom result...</Text>
        </View>
      </AppBackground>
    );
  }

  if (!details || !profile) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>We could not load this classroom result.</Text>
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
        <Text style={styles.heroMeta}>Teacher: {details.teacherName}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isPublic ? "Class result board" : "Your result"}</Text>
          <Text style={styles.bodyText}>
            Visibility: {isPublic ? "Public results for the whole class" : "Private result visible only to you"}
          </Text>
          <Text style={styles.bodyText}>Ends: {formatDateTime(details.activity.endAt)}</Text>
        </View>

        {ownSubmission ? (
          <View style={styles.highlightCard}>
            <Text style={styles.highlightLabel}>Your outcome</Text>
            <Text style={styles.highlightScore}>
              {ownSubmission.status === "absent" ? "0%" : `${ownSubmission.score}%`}
            </Text>
            <Text style={styles.highlightMeta}>
              {ownSubmission.status === "absent"
                ? "You did not participate before the deadline."
                : `${ownSubmission.correctAnswers}/${ownSubmission.totalQuestions} correct in ${ownSubmission.timeTakenSeconds}s`}
            </Text>
            {isPublic && ownRank ? (
              <Text style={styles.highlightMeta}>Class rank: #{ownRank}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.bodyText}>No result is available yet for this activity.</Text>
          </View>
        )}

        {isPublic ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leaderboard</Text>
            {orderedSubmissions.length === 0 ? (
              <Text style={styles.bodyText}>No class submissions yet.</Text>
            ) : (
              orderedSubmissions.map((submission, index) => {
                const isOwn = submission.profileId === profile.id;
                return (
                  <View
                    key={`${submission.profileId}-${submission.status}`}
                    style={[styles.resultRow, isOwn ? styles.resultRowOwn : null]}
                  >
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankValue}>#{index + 1}</Text>
                    </View>
                    <View style={styles.resultMeta}>
                      <Text style={styles.resultName}>
                        {submission.studentName}
                        {isOwn ? " (You)" : ""}
                      </Text>
                      <Text style={styles.resultSubtext}>{submission.quiksId}</Text>
                      <Text style={styles.resultSubtext}>
                        {submission.status === "absent"
                          ? "Absent"
                          : `${submission.correctAnswers}/${submission.totalQuestions} correct`}
                      </Text>
                    </View>
                    <View style={[styles.resultBadge, submission.status === "absent" ? styles.absentBadge : null]}>
                      <Text style={styles.resultBadgeValue}>
                        {submission.status === "absent" ? "0%" : `${submission.score}%`}
                      </Text>
                      <Text style={styles.resultBadgeTime}>
                        {submission.status === "absent" ? "Absent" : `${submission.timeTakenSeconds}s`}
                      </Text>
                    </View>
                  </View>
                );
              })
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
  highlightCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#EAF7FD",
    borderWidth: 1,
    borderColor: "#9CDCF2",
  },
  highlightLabel: {
    color: palette.navy,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  highlightScore: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: "900",
    marginTop: 8,
  },
  highlightMeta: {
    color: palette.slate,
    marginTop: 6,
    lineHeight: 22,
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
  resultRowOwn: {
    borderColor: palette.navy,
    backgroundColor: "#EFF9FD",
  },
  rankBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EAF7FD",
    alignItems: "center",
    justifyContent: "center",
  },
  rankValue: {
    color: palette.navy,
    fontWeight: "900",
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
