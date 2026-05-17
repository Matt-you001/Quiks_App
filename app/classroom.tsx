import { useFocusEffect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getDifficultyLabel } from "../lib/i18n";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import {
  createClassroomAssignment,
  createClassroomClass,
  duplicateClassroomActivity,
  generateClassroomQuestionCandidates,
  getClassroomDetails,
  inviteStudentToClassroom,
  listClassroomActivities,
  listClassroomClasses,
  removeClassroomMember,
  requestJoinClassroom,
  respondToClassroomMembership,
  syncClassroomProfile,
  updateClassroomClass,
} from "../services/ai";
import { getLocalizedSubjects } from "../lib/subjects";
import type {
  ClassroomActivitySummary,
  ClassroomActivityType,
  ClassroomClassDetailsResponse,
  ClassroomMemberSummary,
  ClassroomQuestionOrderMode,
  ClassroomResultVisibility,
  ClassroomSummary,
  Difficulty,
  Question,
  QuestionFocusMode,
  SubscriptionTier,
  Subject,
  UserProfile,
} from "../types/app";

const difficultyOptions: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

function toSubjectId(value: string) {
  return `custom-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subject"}`;
}

function parseDateTimeInput(dateText: string, timeText: string) {
  if (!dateText.trim() || !timeText.trim()) {
    return null;
  }

  const candidate = new Date(`${dateText.trim()}T${timeText.trim()}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate.getTime();
}

export default function ClassroomScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [activities, setActivities] = useState<ClassroomActivitySummary[]>([]);
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassroomClassDetailsResponse | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editClassName, setEditClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [inviteStudentId, setInviteStudentId] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [activityType, setActivityType] = useState<ClassroomActivityType>("assignment");
  const [grade, setGrade] = useState(appVariant.allowedGrades[0] ?? "Grade 6");
  const [level, setLevel] = useState("1");
  const [difficulty, setDifficulty] = useState<Difficulty>(appVariant.defaultDifficulty);
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>("general");
  const [subjectId, setSubjectId] = useState(appVariant.allowedSubjectIds[0] ?? "");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [useCustomSubject, setUseCustomSubject] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customTopicLabel, setCustomTopicLabel] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [resultVisibility, setResultVisibility] = useState<ClassroomResultVisibility>("private");
  const [questionOrderMode, setQuestionOrderMode] = useState<ClassroomQuestionOrderMode>("same");
  const [candidateQuestions, setCandidateQuestions] = useState<Question[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<Question[]>([]);
  const [isReviewingQuestions, setIsReviewingQuestions] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [showCustomQuestionForm, setShowCustomQuestionForm] = useState(false);
  const [customQuestionPrompt, setCustomQuestionPrompt] = useState("");
  const [customQuestionOptions, setCustomQuestionOptions] = useState(["", "", "", ""]);
  const [customQuestionAnswerIndex, setCustomQuestionAnswerIndex] = useState(0);
  const [customQuestionExplanation, setCustomQuestionExplanation] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [publishingAssignment, setPublishingAssignment] = useState(false);
  const [classActionLoading, setClassActionLoading] = useState(false);

  const language = profile?.language ?? "en";
  const localizedSubjects = useMemo(() => getLocalizedSubjects(language), [language]);
  const selectedSubject = useMemo(
    () => localizedSubjects.find((subject) => subject.id === subjectId) ?? localizedSubjects[0] ?? null,
    [localizedSubjects, subjectId]
  );
  const resolvedActivitySubject = useMemo((): Subject | null => {
    if (useCustomSubject) {
      const name = customSubjectName.trim();
      if (!name) {
        return null;
      }

      return {
        id: toSubjectId(name),
        name,
        tagline: "Custom subject",
        icon: "book-open-variant",
        accent: ["#0E5C63", "#7EE2D9"],
        description: "Teacher-defined subject",
        aiPromptHint: `Treat ${name} as a teacher-defined subject or course. Keep the questions aligned to the teacher's chosen grade, level, difficulty, and topic focus.`,
        topics: customTopicLabel.trim()
          ? [
              {
                id: `custom-topic-${toSubjectId(customTopicLabel)}`,
                label: customTopicLabel.trim(),
                description: "Teacher-defined topic",
                keywords: [customTopicLabel.trim().toLowerCase()],
              },
            ]
          : [],
      };
    }

    return selectedSubject;
  }, [customSubjectName, customTopicLabel, selectedSubject, useCustomSubject]);
  const selectedClass = useMemo(
    () => classes.find((entry) => entry.classId === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );
  const pendingTeacherApprovals = useMemo(
    () => selectedClassDetails?.classroom.pendingTeacherApprovals ?? selectedClass?.pendingTeacherApprovals ?? [],
    [selectedClassDetails, selectedClass]
  );
  const pendingStudentInvites = useMemo(() => {
    if (!profile) {
      return [];
    }

    return classes.flatMap((entry) =>
      entry.pendingStudentApprovals
        .filter((membership) => membership.profileId === profile.id)
        .map((membership) => ({ classroom: entry, membership }))
    );
  }, [classes, profile]);
  const desiredQuestionCount = Math.max(1, Number(questionCount) || 5);
  const currentCandidateQuestion = candidateQuestions[0] ?? null;
  const reviewQuestions = acceptedQuestions.slice(reviewPage * 5, reviewPage * 5 + 5);
  const reviewPageCount = Math.max(1, Math.ceil(acceptedQuestions.length / 5));
  const activeMembers = useMemo(
    () => (selectedClassDetails?.members ?? []).filter((member) => member.status === "active"),
    [selectedClassDetails]
  );

  useEffect(() => {
    if (!profile || !selectedClassId) {
      setSelectedClassDetails(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const details = await getClassroomDetails({
          profile,
          classId: selectedClassId,
        });
        if (!cancelled) {
          setSelectedClassDetails(details);
          setEditClassName(details.classroom.className);
        }
      } catch {
        if (!cancelled) {
          setSelectedClassDetails(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, selectedClassId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [])
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

    if (!activeProfile || appVariant.id === "children") {
      setLoading(false);
      return;
    }

    try {
      await syncClassroomProfile({ profile: activeProfile });
      const [nextClasses, nextActivities] = await Promise.all([
        listClassroomClasses({ profile: activeProfile }),
        listClassroomActivities({ profile: activeProfile }),
      ]);
      setClasses(nextClasses.classes);
      setActivities(nextActivities.activities);
      setSelectedClassId((current) =>
        nextClasses.classes.some((entry) => entry.classId === current) ? current : nextClasses.classes[0]?.classId ?? null
      );
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to load classroom data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshClassroomData = async () => {
    if (!profile || appVariant.id === "children") {
      return;
    }

    const [nextClasses, nextActivities] = await Promise.all([
      listClassroomClasses({ profile }),
      listClassroomActivities({ profile }),
    ]);
    setClasses(nextClasses.classes);
    setActivities(nextActivities.activities);
    const nextSelectedClassId = nextClasses.classes.some((entry) => entry.classId === selectedClassId)
      ? selectedClassId
      : nextClasses.classes[0]?.classId ?? null;
    setSelectedClassId(nextSelectedClassId);

    if (nextSelectedClassId) {
      const details = await getClassroomDetails({
        profile,
        classId: nextSelectedClassId,
      });
      setSelectedClassDetails(details);
      setEditClassName(details.classroom.className);
    } else {
      setSelectedClassDetails(null);
      setEditClassName("");
    }
  };

  const createClass = async () => {
    if (!profile || !newClassName.trim()) {
      Alert.alert("Classroom", "Enter a class name first.");
      return;
    }

    setSaving(true);
    try {
      await createClassroomClass({
        teacherProfile: profile,
        className: newClassName.trim(),
      });
      setNewClassName("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to create class.");
    } finally {
      setSaving(false);
    }
  };

  const requestJoin = async () => {
    if (!profile || !joinCode.trim()) {
      Alert.alert("Classroom", "Enter a class code first.");
      return;
    }

    setSaving(true);
    try {
      const response = await requestJoinClassroom({
        studentProfile: profile,
        classCode: joinCode.trim(),
      });
      Alert.alert("Join request sent", response.message);
      setJoinCode("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to send join request.");
    } finally {
      setSaving(false);
    }
  };

  const inviteStudent = async () => {
    if (!profile || !selectedClass || !inviteStudentId.trim()) {
      Alert.alert("Classroom", "Select a class and enter a student ID first.");
      return;
    }

    setSaving(true);
    try {
      const response = await inviteStudentToClassroom({
        teacherProfile: profile,
        classId: selectedClass.classId,
        studentQuiksId: inviteStudentId.trim(),
      });
      Alert.alert("Invite sent", response.message);
      setInviteStudentId("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to invite the student.");
    } finally {
      setSaving(false);
    }
  };

  const renameClass = async () => {
    if (!profile || !selectedClass || !editClassName.trim()) {
      return;
    }

    setClassActionLoading(true);
    try {
      await updateClassroomClass({
        teacherProfile: profile,
        classId: selectedClass.classId,
        className: editClassName.trim(),
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to update the class name.");
    } finally {
      setClassActionLoading(false);
    }
  };

  const removeMember = async (membership: ClassroomMemberSummary) => {
    if (!profile || !selectedClass) {
      return;
    }

    setClassActionLoading(true);
    try {
      await removeClassroomMember({
        teacherProfile: profile,
        classId: selectedClass.classId,
        membershipId: membership.membershipId,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to remove the member.");
    } finally {
      setClassActionLoading(false);
    }
  };

  const respondToMembership = async (
    classroom: ClassroomSummary,
    membership: ClassroomMemberSummary,
    decision: "approve" | "reject"
  ) => {
    if (!profile) {
      return;
    }

    setSaving(true);
    try {
      await respondToClassroomMembership({
        actorProfile: profile,
        classId: classroom.classId,
        membershipId: membership.membershipId,
        decision,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to update the request.");
    } finally {
      setSaving(false);
    }
  };

  const generateCandidates = async () => {
    if (!profile || !selectedClass || !resolvedActivitySubject) {
      return;
    }

    if (focusMode === "topic" && useCustomSubject && !customTopicLabel.trim()) {
      Alert.alert("Question selection", "Enter the custom topic first.");
      return;
    }

    setCandidateLoading(true);
    try {
      const response = await generateClassroomQuestionCandidates({
        teacherProfile: profile,
        classId: selectedClass.classId,
        subject: resolvedActivitySubject,
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId:
          focusMode === "topic"
            ? useCustomSubject
              ? resolvedActivitySubject.topics[0]?.id
              : topicId ?? undefined
            : undefined,
        topicLabel:
          focusMode === "topic"
            ? useCustomSubject
              ? customTopicLabel.trim() || undefined
              : selectedSubject?.topics.find((topic) => topic.id === topicId)?.label
            : undefined,
        questionCount: desiredQuestionCount,
        batchCount: Math.min(6, Math.max(3, desiredQuestionCount - acceptedQuestions.length)),
      });
      setCandidateQuestions((current) => [
        ...current,
        ...response.questions.map((question, index) => ({
          ...question,
          id: `${question.id}-${Date.now()}-${current.length + index}`,
        })),
      ]);
    } catch (error) {
      Alert.alert("Question selection", error instanceof Error ? error.message : "Unable to load candidate questions.");
    } finally {
      setCandidateLoading(false);
    }
  };

  const acceptCandidate = (question: Question) => {
    setAcceptedQuestions((current) => {
      if (current.some((entry) => entry.id === question.id) || current.length >= desiredQuestionCount) {
        return current;
      }

      return [...current, question];
    });
    setCandidateQuestions((current) => current.filter((entry) => entry.id !== question.id));
    setIsReviewingQuestions(false);
  };

  const skipCandidate = () => {
    setCandidateQuestions((current) => current.slice(1));
  };

  const removeAcceptedQuestion = (questionId: string) => {
    setAcceptedQuestions((current) => current.filter((entry) => entry.id !== questionId));
    setIsReviewingQuestions(false);
    setReviewPage(0);
  };

  const addCustomQuestion = () => {
    if (!customQuestionPrompt.trim()) {
      Alert.alert("Custom question", "Enter the question prompt.");
      return;
    }

    if (customQuestionOptions.some((option) => !option.trim())) {
      Alert.alert("Custom question", "Fill all four answer options.");
      return;
    }

    const answer = customQuestionOptions[customQuestionAnswerIndex]?.trim();
    if (!answer) {
      Alert.alert("Custom question", "Choose the correct answer.");
      return;
    }

    if (acceptedQuestions.length >= desiredQuestionCount) {
      Alert.alert("Custom question", "Question count is already complete.");
      return;
    }

    const customQuestion: Question = {
      id: `custom-${Date.now()}-${acceptedQuestions.length + 1}`,
      prompt: customQuestionPrompt.trim(),
      options: customQuestionOptions.map((option) => option.trim()),
      answer,
      explanation: customQuestionExplanation.trim() || "Teacher-authored question.",
    };

    setAcceptedQuestions((current) => [...current, customQuestion]);
    setCustomQuestionPrompt("");
    setCustomQuestionOptions(["", "", "", ""]);
    setCustomQuestionAnswerIndex(0);
    setCustomQuestionExplanation("");
    setShowCustomQuestionForm(false);
  };

  const publishAssignment = async () => {
    if (!profile || !selectedClass || !resolvedActivitySubject) {
      return;
    }

    if (acceptedQuestions.length < desiredQuestionCount) {
      Alert.alert("Assignment", `Accept ${desiredQuestionCount} questions before publishing.`);
      return;
    }

    if (!assignmentTitle.trim()) {
      Alert.alert("Assignment", "Enter an assignment title first.");
      return;
    }

    if (focusMode === "topic" && useCustomSubject && !customTopicLabel.trim()) {
      Alert.alert("Assignment", "Enter the custom topic first.");
      return;
    }

    const parsedStartAt = activityType === "test" ? parseDateTimeInput(startDate, startTime) : null;
    const parsedDeadline = activityType === "assignment" ? parseDateTimeInput(deadlineDate, deadlineTime) : null;

    if (activityType === "test" && !parsedStartAt) {
      Alert.alert("Test", "Enter a valid start date and time.");
      return;
    }

    if (activityType === "assignment" && !parsedDeadline) {
      Alert.alert("Assignment", "Enter a valid deadline date and time.");
      return;
    }

    setPublishingAssignment(true);
    try {
      await createClassroomAssignment({
        teacherProfile: profile,
        classId: selectedClass.classId,
        type: activityType,
        title: assignmentTitle.trim(),
        subject: resolvedActivitySubject,
        usesCustomSubject: useCustomSubject,
        usesCustomTopic: Boolean(focusMode === "topic" && (useCustomSubject || customTopicLabel.trim())),
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId:
          focusMode === "topic"
            ? useCustomSubject
              ? resolvedActivitySubject.topics[0]?.id
              : topicId ?? undefined
            : undefined,
        topicLabel:
          focusMode === "topic"
            ? useCustomSubject
              ? customTopicLabel.trim() || undefined
              : selectedSubject?.topics.find((topic) => topic.id === topicId)?.label
            : undefined,
        durationMinutes: Math.max(5, Number(durationMinutes) || 30),
        availabilityHours: 24,
        startAt: parsedStartAt ?? undefined,
        endAt:
          parsedDeadline ??
          (parsedStartAt
            ? parsedStartAt + Math.max(5, Number(durationMinutes) || 30) * 60 * 1000
            : undefined),
        resultVisibility,
        questionOrderMode,
        questions: acceptedQuestions.slice(0, desiredQuestionCount),
      });
      setAssignmentTitle("");
      setAcceptedQuestions([]);
      setCandidateQuestions([]);
      setIsReviewingQuestions(false);
      setReviewPage(0);
      setDeadlineDate("");
      setDeadlineTime("");
      setStartDate("");
      setStartTime("");
      setCustomSubjectName("");
      setCustomTopicLabel("");
      setUseCustomSubject(false);
      setShowCustomQuestionForm(false);
      await refreshClassroomData();
      Alert.alert(
        activityType === "test" ? "Test published" : "Assignment published",
        activityType === "test"
          ? "Your scheduled test is now ready for the class."
          : "Your assignment is now available to the class."
      );
    } catch (error) {
      Alert.alert("Assignment", error instanceof Error ? error.message : "Unable to publish the assignment.");
    } finally {
      setPublishingAssignment(false);
    }
  };

  const duplicateActivity = async (activity: ClassroomActivitySummary) => {
    if (!profile) {
      return;
    }

    setClassActionLoading(true);
    try {
      await duplicateClassroomActivity({
        teacherProfile: profile,
        activityId: activity.activityId,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to duplicate the activity.");
    } finally {
      setClassActionLoading(false);
    }
  };

  const openActivity = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/session",
      params: {
        subjectId: activity.subjectId,
        grade: activity.grade,
        level: String(activity.level),
        difficulty: activity.difficulty,
        focusMode: activity.focusMode,
        topicId: activity.topicId,
        mode: "quiz",
        autoStart: "1",
        classroomActivityId: activity.activityId,
      },
    });
  };

  const openActivityDashboard = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/classroom-activity",
      params: {
        activityId: activity.activityId,
      },
    });
  };

  const openStudentResult = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/classroom-result" as never,
      params: {
        activityId: activity.activityId,
      },
    } as never);
  };

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Loading classroom...</Text>
        </View>
      </AppBackground>
    );
  }

  if (appVariant.id === "children") {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Classroom tools are available in Quiks Teens and Quiks Uni.</Text>
          <PrimaryButton label="Back Home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (!profile) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Choose or create a profile before using classroom tools.</Text>
          <PrimaryButton label="Go Home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }
  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Classroom</Text>
        <View style={styles.identityRow}>
          <View style={styles.identityChip}>
            <Text style={styles.identityLabel}>Role</Text>
            <Text style={styles.identityValue}>{profile.role === "teacher" ? "Teacher" : "Student"}</Text>
          </View>
          <View style={styles.identityChip}>
            <Text style={styles.identityLabel}>Quiks ID</Text>
            <Text style={styles.identityValue}>{profile.quiksId}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {profile.role === "teacher" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Create class</Text>
              <TextInput
                value={newClassName}
                onChangeText={setNewClassName}
                placeholder="Class name"
                placeholderTextColor="#8092A7"
                style={styles.input}
              />
              <PrimaryButton label="Create class" onPress={createClass} loading={saving} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your classes</Text>
              {classes.length === 0 ? (
                <Text style={styles.helperText}>No classes yet.</Text>
              ) : (
                classes.map((entry) => (
                  <Pressable
                    key={entry.classId}
                    onPress={() => setSelectedClassId(entry.classId)}
                    style={[styles.classCard, entry.classId === selectedClass?.classId ? styles.classCardActive : null]}
                  >
                    <Text style={styles.classTitle}>{entry.className}</Text>
                    <Text style={styles.classMeta}>Code: {entry.classCode}</Text>
                    <Text style={styles.classMeta}>Members: {entry.memberCount}</Text>
                  </Pressable>
                ))
              )}
            </View>

            {selectedClass ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Class</Text>
                  <TextInput
                    value={editClassName}
                    onChangeText={setEditClassName}
                    placeholder="Class name"
                    placeholderTextColor="#8092A7"
                    style={styles.input}
                  />
                  <PrimaryButton label="Save name" onPress={renameClass} loading={classActionLoading} />
                  <Text style={styles.classMeta}>Code: {selectedClass.classCode}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Roster</Text>
                  {activeMembers.length === 0 ? (
                    <Text style={styles.helperText}>No members.</Text>
                  ) : (
                    activeMembers.map((membership) => (
                      <View key={membership.membershipId} style={styles.memberRow}>
                        <View style={styles.memberMeta}>
                          <Text style={styles.requestTitle}>{membership.name}</Text>
                          <Text style={styles.classMeta}>
                            {membership.role === "teacher" ? "Teacher" : membership.quiksId}
                          </Text>
                        </View>
                        {membership.role === "student" ? (
                          <PrimaryButton
                            label="Remove"
                            variant="secondary"
                            onPress={() => removeMember(membership)}
                            style={styles.memberAction}
                          />
                        ) : null}
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Pending student requests</Text>
                  {pendingTeacherApprovals.length === 0 ? (
                    <Text style={styles.helperText}>No requests.</Text>
                  ) : (
                    pendingTeacherApprovals.map((membership) => (
                      <View key={membership.membershipId} style={styles.requestCard}>
                        <Text style={styles.requestTitle}>{membership.name}</Text>
                        <Text style={styles.classMeta}>{membership.quiksId}</Text>
                        <View style={styles.inlineActions}>
                          <PrimaryButton
                            label="Approve"
                            onPress={() => respondToMembership(selectedClass, membership, "approve")}
                            style={styles.inlineButton}
                          />
                          <PrimaryButton
                            label="Reject"
                            variant="secondary"
                            onPress={() => respondToMembership(selectedClass, membership, "reject")}
                            style={styles.inlineButton}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Invite student by ID</Text>
                  <TextInput
                    value={inviteStudentId}
                    onChangeText={setInviteStudentId}
                    placeholder="Student Quiks ID"
                    placeholderTextColor="#8092A7"
                    style={styles.input}
                  />
                  <PrimaryButton label="Send invite" onPress={inviteStudent} loading={saving} />
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Create activity</Text>
                  <Text style={styles.sectionLabel}>Activity type</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="Assignment" onPress={() => setActivityType("assignment")} variant={activityType === "assignment" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label="Test" onPress={() => setActivityType("test")} variant={activityType === "test" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  <TextInput value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder={activityType === "test" ? "Test title" : "Assignment title"} placeholderTextColor="#8092A7" style={styles.input} />

                  <Text style={styles.sectionLabel}>Form</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="Preset" onPress={() => setUseCustomSubject(false)} variant={useCustomSubject ? "secondary" : "primary"} style={styles.inlineButton} />
                    <PrimaryButton label="Custom" onPress={() => setUseCustomSubject(true)} variant={useCustomSubject ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  <Text style={styles.sectionLabel}>Subject</Text>
                  {useCustomSubject ? (
                    <TextInput value={customSubjectName} onChangeText={setCustomSubjectName} placeholder="Custom subject or course" placeholderTextColor="#8092A7" style={styles.input} />
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {localizedSubjects.map((entry) => (
                        <Pressable
                          key={entry.id}
                          onPress={() => {
                            setSubjectId(entry.id);
                            setTopicId(entry.topics[0]?.id ?? null);
                          }}
                          style={[styles.choiceChip, entry.id === selectedSubject?.id ? styles.choiceChipActive : null]}
                        >
                          <Text style={[styles.choiceChipText, entry.id === selectedSubject?.id ? styles.choiceChipTextActive : null]}>{entry.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={styles.sectionLabel}>Grade</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {appVariant.allowedGrades.map((entry) => (
                      <Pressable key={entry} onPress={() => setGrade(entry)} style={[styles.choiceChip, entry === grade ? styles.choiceChipActive : null]}>
                        <Text style={[styles.choiceChipText, entry === grade ? styles.choiceChipTextActive : null]}>{entry}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.sectionLabel}>Question focus</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="General" onPress={() => setFocusMode("general")} variant={focusMode === "general" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label="Topic Focus" onPress={() => setFocusMode("topic")} variant={focusMode === "topic" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  {focusMode === "topic" ? (
                    <>
                      <Text style={styles.sectionLabel}>Topic</Text>
                      {useCustomSubject ? (
                        <TextInput value={customTopicLabel} onChangeText={setCustomTopicLabel} placeholder="Custom topic" placeholderTextColor="#8092A7" style={styles.input} />
                      ) : selectedSubject ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                          {selectedSubject.topics.map((entry) => (
                            <Pressable key={entry.id} onPress={() => setTopicId(entry.id)} style={[styles.choiceChip, entry.id === topicId ? styles.choiceChipActive : null]}>
                              <Text style={[styles.choiceChipText, entry.id === topicId ? styles.choiceChipTextActive : null]}>{entry.label}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      ) : null}
                    </>
                  ) : null}

                  <Text style={styles.sectionLabel}>Difficulty</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {difficultyOptions.map((entry) => (
                      <Pressable key={entry} onPress={() => setDifficulty(entry)} style={[styles.choiceChip, entry === difficulty ? styles.choiceChipActive : null]}>
                        <Text style={[styles.choiceChipText, entry === difficulty ? styles.choiceChipTextActive : null]}>{getDifficultyLabel(language, entry)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.dualInputRow}>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Level</Text>
                      <TextInput value={level} onChangeText={setLevel} keyboardType="number-pad" style={styles.input} />
                    </View>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Question count</Text>
                      <TextInput value={questionCount} onChangeText={setQuestionCount} keyboardType="number-pad" style={styles.input} />
                    </View>
                  </View>

                  <View style={styles.dualInputRow}>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Duration (minutes)</Text>
                      <TextInput value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="number-pad" style={styles.input} />
                    </View>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>{activityType === "test" ? "Start date" : "Deadline date"}</Text>
                      <TextInput value={activityType === "test" ? startDate : deadlineDate} onChangeText={activityType === "test" ? setStartDate : setDeadlineDate} placeholder="YYYY-MM-DD" placeholderTextColor="#7C8EA3" style={styles.input} />
                    </View>
                  </View>

                  <View style={styles.dualInputRow}>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>{activityType === "test" ? "Start time" : "Deadline time"}</Text>
                      <TextInput value={activityType === "test" ? startTime : deadlineTime} onChangeText={activityType === "test" ? setStartTime : setDeadlineTime} placeholder="HH:MM" placeholderTextColor="#7C8EA3" style={styles.input} />
                    </View>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Custom question</Text>
                      <PrimaryButton label={showCustomQuestionForm ? "Hide custom question" : "Custom question"} variant="secondary" onPress={() => setShowCustomQuestionForm((current) => !current)} />
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>Results</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="Private" onPress={() => setResultVisibility("private")} variant={resultVisibility === "private" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label="Public" onPress={() => setResultVisibility("public")} variant={resultVisibility === "public" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  <Text style={styles.sectionLabel}>Question order</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label="Same for all" onPress={() => setQuestionOrderMode("same")} variant={questionOrderMode === "same" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label="Shuffle per student" onPress={() => setQuestionOrderMode("shuffled")} variant={questionOrderMode === "shuffled" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  {showCustomQuestionForm ? (
                    <View style={styles.questionCard}>
                      <Text style={styles.sectionLabel}>Prompt</Text>
                      <TextInput value={customQuestionPrompt} onChangeText={setCustomQuestionPrompt} placeholder="Enter your question" placeholderTextColor="#8092A7" style={[styles.input, styles.textAreaInput]} multiline />
                      {customQuestionOptions.map((option, index) => (
                        <View key={`custom-option-${index}`} style={styles.customOptionRow}>
                          <Pressable onPress={() => setCustomQuestionAnswerIndex(index)} style={[styles.answerPick, customQuestionAnswerIndex === index ? styles.answerPickActive : null]}>
                            <Text style={[styles.answerPickText, customQuestionAnswerIndex === index ? styles.answerPickTextActive : null]}>{index + 1}</Text>
                          </Pressable>
                          <TextInput
                            value={option}
                            onChangeText={(value) => setCustomQuestionOptions((current) => current.map((entry, optionIndex) => (optionIndex === index ? value : entry)))}
                            placeholder={`Option ${index + 1}`}
                            placeholderTextColor="#7C8EA3"
                            style={[styles.input, styles.customOptionInput]}
                          />
                        </View>
                      ))}
                      <TextInput value={customQuestionExplanation} onChangeText={setCustomQuestionExplanation} placeholder="Explanation (optional)" placeholderTextColor="#7C8EA3" style={[styles.input, styles.textAreaInput]} multiline />
                      <PrimaryButton label="Add custom question" onPress={addCustomQuestion} />
                    </View>
                  ) : null}

                  <Text style={styles.sectionLabel}>Question count ({acceptedQuestions.length}/{desiredQuestionCount})</Text>
                  {acceptedQuestions.length < desiredQuestionCount ? (
                    currentCandidateQuestion ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionPrompt}>{currentCandidateQuestion.prompt}</Text>
                        {currentCandidateQuestion.options.map((option, index) => (
                          <Text key={`${currentCandidateQuestion.id}-option-${index}`} style={styles.optionPreview}>
                            {index + 1}. {option}
                          </Text>
                        ))}
                        <View style={styles.inlineActions}>
                          <PrimaryButton label="Accept" onPress={() => acceptCandidate(currentCandidateQuestion)} style={styles.inlineButton} />
                          <PrimaryButton label="Skip" variant="secondary" onPress={skipCandidate} style={styles.inlineButton} />
                        </View>
                      </View>
                    ) : (
                      <PrimaryButton label={candidateQuestions.length === 0 ? "Load question candidates" : "Load more questions"} onPress={generateCandidates} loading={candidateLoading} />
                    )
                  ) : (
                    <View style={styles.inlineActions}>
                      <PrimaryButton label="Review" variant="secondary" onPress={() => { setIsReviewingQuestions(true); setReviewPage(0); }} style={styles.inlineButton} />
                      <PrimaryButton label={activityType === "test" ? "Publish test" : "Publish assignment"} onPress={publishAssignment} loading={publishingAssignment} style={styles.inlineButton} />
                    </View>
                  )}

                  {isReviewingQuestions ? (
                    <View style={styles.reviewWrap}>
                      <Text style={styles.sectionLabel}>Review</Text>
                      {reviewQuestions.map((question) => (
                        <View key={question.id} style={styles.questionCard}>
                          <Text style={styles.questionPrompt}>{question.prompt}</Text>
                          <PrimaryButton label="Remove" variant="secondary" onPress={() => removeAcceptedQuestion(question.id)} />
                        </View>
                      ))}
                      <View style={styles.inlineActions}>
                        <PrimaryButton label="Previous" variant="secondary" onPress={() => setReviewPage((current) => Math.max(0, current - 1))} disabled={reviewPage === 0} style={styles.inlineButton} />
                        <PrimaryButton label="Next" variant="secondary" onPress={() => setReviewPage((current) => Math.min(reviewPageCount - 1, current + 1))} disabled={reviewPage >= reviewPageCount - 1} style={styles.inlineButton} />
                      </View>
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Join a class</Text>
              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Enter class code"
                placeholderTextColor="#8092A7"
                style={styles.input}
                autoCapitalize="characters"
              />
              <PrimaryButton label="Request to join" onPress={requestJoin} loading={saving} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Invites</Text>
              {pendingStudentInvites.length === 0 ? (
                <Text style={styles.helperText}>No invites.</Text>
              ) : (
                pendingStudentInvites.map(({ classroom, membership }) => (
                  <View key={membership.membershipId} style={styles.requestCard}>
                    <Text style={styles.classTitle}>{classroom.className}</Text>
                    <Text style={styles.classMeta}>Teacher: {classroom.teacherName}</Text>
                    <View style={styles.inlineActions}>
                      <PrimaryButton
                        label="Accept"
                        onPress={() => respondToMembership(classroom, membership, "approve")}
                        style={styles.inlineButton}
                      />
                      <PrimaryButton
                        label="Decline"
                        variant="secondary"
                        onPress={() => respondToMembership(classroom, membership, "reject")}
                        style={styles.inlineButton}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{profile.role === "teacher" ? "Published activities" : "Class activities"}</Text>
          {activities.length === 0 ? (
            <Text style={styles.helperText}>No activities yet.</Text>
          ) : (
            activities.map((activity) => (
              <View key={activity.activityId} style={styles.classCard}>
                <Text style={styles.classTitle}>{activity.title}</Text>
                <Text style={styles.classMeta}>
                  {activity.type === "test" ? "Test" : "Assignment"} | {activity.subjectName} | {activity.grade} | Level {activity.level}
                </Text>
                <Text style={styles.classMeta}>
                  {activity.status === "closed"
                    ? "Closed"
                    : activity.submitted
                      ? "Submitted"
                      : activity.status === "scheduled"
                        ? `Starts ${new Date(activity.startAt).toLocaleString()}`
                        : `Open until ${new Date(activity.endAt).toLocaleString()}`}
                </Text>
                <Text style={styles.classMeta}>Questions: {activity.questionCount}</Text>
                {profile.role === "teacher" ? (
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label="Results"
                      variant="secondary"
                      onPress={() => openActivityDashboard(activity)}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label="Duplicate"
                      onPress={() => duplicateActivity(activity)}
                      loading={classActionLoading}
                      style={styles.inlineButton}
                    />
                  </View>
                ) : (
                  <PrimaryButton
                    label={
                      activity.submitted
                        ? "View result"
                        : activity.status === "closed"
                          ? "View result"
                          : activity.status === "scheduled"
                            ? "Wait for start"
                            : activity.type === "test"
                              ? "Start test"
                              : "Start assignment"
                    }
                    onPress={() =>
                      activity.submitted || activity.status === "closed"
                        ? openStudentResult(activity)
                        : openActivity(activity)
                    }
                    disabled={activity.status === "scheduled"}
                  />
                )}
              </View>
            ))
          )}
        </View>

        {subscriptionTier === "free" ? <DemoAdBanner language={language} /> : null}
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
    fontSize: 32,
    fontWeight: "900",
  },
  identityRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  identityChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 12,
  },
  identityLabel: {
    color: "#D6ECF9",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  identityValue: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
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
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    color: palette.ink,
  },
  textAreaInput: {
    minHeight: 90,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  helperText: {
    color: palette.slate,
    lineHeight: 20,
  },
  classCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    padding: 14,
    gap: 6,
  },
  classCardActive: {
    borderColor: palette.navy,
    backgroundColor: "#EEF8FB",
  },
  classTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  classMeta: {
    color: palette.slate,
    lineHeight: 20,
  },
  requestCard: {
    borderRadius: 18,
    backgroundColor: "#F6FAFD",
    padding: 14,
    gap: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    padding: 14,
  },
  memberMeta: {
    flex: 1,
    gap: 4,
  },
  memberAction: {
    minWidth: 110,
  },
  requestTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  inlineButton: {
    flex: 1,
    minWidth: 130,
  },
  sectionLabel: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  choiceChip: {
    borderRadius: 16,
    backgroundColor: "#F2F5F8",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceChipActive: {
    backgroundColor: palette.navy,
  },
  choiceChipText: {
    color: palette.navy,
    fontWeight: "700",
  },
  choiceChipTextActive: {
    color: palette.white,
  },
  dualInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  dualInputItem: {
    flex: 1,
    gap: 8,
  },
  customOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customOptionInput: {
    flex: 1,
  },
  answerPick: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FBFD",
  },
  answerPickActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  answerPickText: {
    color: palette.navy,
    fontWeight: "800",
  },
  answerPickTextActive: {
    color: palette.white,
  },
  questionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E3EC",
    backgroundColor: "#FBFDFF",
    padding: 14,
    gap: 10,
  },
  questionPrompt: {
    color: palette.ink,
    lineHeight: 22,
    fontWeight: "700",
  },
  optionPreview: {
    color: palette.slate,
    lineHeight: 20,
  },
  reviewWrap: {
    gap: 12,
  },
});
