import { useFocusEffect, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
  generateClassroomQuestionCandidates,
  inviteStudentToClassroom,
  listClassroomActivities,
  listClassroomClasses,
  requestJoinClassroom,
  respondToClassroomMembership,
  syncClassroomProfile,
} from "../services/ai";
import { getLocalizedSubjects } from "../lib/subjects";
import type {
  ClassroomActivitySummary,
  ClassroomActivityType,
  ClassroomMemberSummary,
  ClassroomQuestionOrderMode,
  ClassroomResultVisibility,
  ClassroomSummary,
  Difficulty,
  Question,
  QuestionFocusMode,
  SubscriptionTier,
  UserProfile,
} from "../types/app";

const difficultyOptions: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function ClassroomScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [activities, setActivities] = useState<ClassroomActivitySummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
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
  const [questionCount, setQuestionCount] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [availabilityHours, setAvailabilityHours] = useState("24");
  const [startInMinutes, setStartInMinutes] = useState("5");
  const [resultVisibility, setResultVisibility] = useState<ClassroomResultVisibility>("private");
  const [questionOrderMode, setQuestionOrderMode] = useState<ClassroomQuestionOrderMode>("same");
  const [candidateQuestions, setCandidateQuestions] = useState<Question[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<Question[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [publishingAssignment, setPublishingAssignment] = useState(false);

  const language = profile?.language ?? "en";
  const localizedSubjects = useMemo(() => getLocalizedSubjects(language), [language]);
  const selectedSubject = useMemo(
    () => localizedSubjects.find((subject) => subject.id === subjectId) ?? localizedSubjects[0] ?? null,
    [localizedSubjects, subjectId]
  );
  const selectedClass = useMemo(
    () => classes.find((entry) => entry.classId === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );
  const pendingTeacherApprovals = useMemo(
    () => selectedClass?.pendingTeacherApprovals ?? [],
    [selectedClass]
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
    setSelectedClassId((current) =>
      nextClasses.classes.some((entry) => entry.classId === current) ? current : nextClasses.classes[0]?.classId ?? null
    );
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
    if (!profile || !selectedClass || !selectedSubject) {
      return;
    }

    const desiredCount = Math.max(1, Number(questionCount) || 5);
    setCandidateLoading(true);
    try {
      const response = await generateClassroomQuestionCandidates({
        teacherProfile: profile,
        classId: selectedClass.classId,
        subject: selectedSubject,
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId: focusMode === "topic" ? topicId ?? undefined : undefined,
        topicLabel:
          focusMode === "topic"
            ? selectedSubject.topics.find((topic) => topic.id === topicId)?.label
            : undefined,
        questionCount: desiredCount,
        batchCount: Math.min(3, Math.max(1, desiredCount - acceptedQuestions.length)),
      });
      setCandidateQuestions(response.questions);
    } catch (error) {
      Alert.alert("Question selection", error instanceof Error ? error.message : "Unable to load candidate questions.");
    } finally {
      setCandidateLoading(false);
    }
  };

  const acceptCandidate = (question: Question) => {
    const desiredCount = Math.max(1, Number(questionCount) || 5);
    setAcceptedQuestions((current) => {
      if (current.some((entry) => entry.id === question.id) || current.length >= desiredCount) {
        return current;
      }

      return [...current, question];
    });
    setCandidateQuestions((current) => current.filter((entry) => entry.id !== question.id));
  };

  const removeAcceptedQuestion = (questionId: string) => {
    setAcceptedQuestions((current) => current.filter((entry) => entry.id !== questionId));
  };

  const publishAssignment = async () => {
    if (!profile || !selectedClass || !selectedSubject) {
      return;
    }

    const desiredCount = Math.max(1, Number(questionCount) || 5);
    if (acceptedQuestions.length < desiredCount) {
      Alert.alert("Assignment", `Accept ${desiredCount} questions before publishing.`);
      return;
    }

    if (!assignmentTitle.trim()) {
      Alert.alert("Assignment", "Enter an assignment title first.");
      return;
    }

    setPublishingAssignment(true);
    try {
      await createClassroomAssignment({
        teacherProfile: profile,
        classId: selectedClass.classId,
        type: activityType,
        title: assignmentTitle.trim(),
        subject: selectedSubject,
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId: focusMode === "topic" ? topicId ?? undefined : undefined,
        topicLabel:
          focusMode === "topic"
            ? selectedSubject.topics.find((topic) => topic.id === topicId)?.label
            : undefined,
        durationMinutes: Math.max(5, Number(durationMinutes) || 30),
        availabilityHours: Math.max(1, Number(availabilityHours) || 24),
        startInMinutes: Math.max(0, Number(startInMinutes) || 0),
        resultVisibility,
        questionOrderMode,
        questions: acceptedQuestions.slice(0, desiredCount),
      });
      setAssignmentTitle("");
      setAcceptedQuestions([]);
      setCandidateQuestions([]);
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

  const desiredQuestionCount = Math.max(1, Number(questionCount) || 5);

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Classroom</Text>
        <Text style={styles.heroText}>
          {profile.role === "teacher"
            ? "Create classes, approve students, and publish assignments."
            : "Join classes, approve invites, and complete assignments before deadline."}
        </Text>
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
                <Text style={styles.helperText}>No classes yet. Create your first class to begin.</Text>
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
                  <Text style={styles.cardTitle}>Pending student requests</Text>
                  {pendingTeacherApprovals.length === 0 ? (
                    <Text style={styles.helperText}>No student requests waiting for approval.</Text>
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
                  <Text style={styles.cardTitle}>Create classroom activity</Text>
                  <Text style={styles.sectionLabel}>Activity type</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label="Assignment"
                      onPress={() => setActivityType("assignment")}
                      variant={activityType === "assignment" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label="Test"
                      onPress={() => setActivityType("test")}
                      variant={activityType === "test" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                  </View>
                  <TextInput
                    value={assignmentTitle}
                    onChangeText={setAssignmentTitle}
                    placeholder={activityType === "test" ? "Test title" : "Assignment title"}
                    placeholderTextColor="#8092A7"
                    style={styles.input}
                  />
                  <Text style={styles.sectionLabel}>Subject</Text>
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
                        <Text style={[styles.choiceChipText, entry.id === selectedSubject?.id ? styles.choiceChipTextActive : null]}>
                          {entry.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.sectionLabel}>Grade</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {appVariant.allowedGrades.map((entry) => (
                      <Pressable
                        key={entry}
                        onPress={() => setGrade(entry)}
                        style={[styles.choiceChip, entry === grade ? styles.choiceChipActive : null]}
                      >
                        <Text style={[styles.choiceChipText, entry === grade ? styles.choiceChipTextActive : null]}>
                          {entry}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.sectionLabel}>Question focus</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label="General"
                      onPress={() => setFocusMode("general")}
                      variant={focusMode === "general" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label="Topic Focus"
                      onPress={() => setFocusMode("topic")}
                      variant={focusMode === "topic" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                  </View>

                  {focusMode === "topic" && selectedSubject ? (
                    <>
                      <Text style={styles.sectionLabel}>Topic</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {selectedSubject.topics.map((entry) => (
                          <Pressable
                            key={entry.id}
                            onPress={() => setTopicId(entry.id)}
                            style={[styles.choiceChip, entry.id === topicId ? styles.choiceChipActive : null]}
                          >
                            <Text style={[styles.choiceChipText, entry.id === topicId ? styles.choiceChipTextActive : null]}>
                              {entry.label}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </>
                  ) : null}

                  <Text style={styles.sectionLabel}>Difficulty</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {difficultyOptions.map((entry) => (
                      <Pressable
                        key={entry}
                        onPress={() => setDifficulty(entry)}
                        style={[styles.choiceChip, entry === difficulty ? styles.choiceChipActive : null]}
                      >
                        <Text style={[styles.choiceChipText, entry === difficulty ? styles.choiceChipTextActive : null]}>
                          {getDifficultyLabel(language, entry)}
                        </Text>
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
                      <TextInput
                        value={questionCount}
                        onChangeText={setQuestionCount}
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <View style={styles.dualInputRow}>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Duration (minutes)</Text>
                      <TextInput
                        value={durationMinutes}
                        onChangeText={setDurationMinutes}
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>
                        {activityType === "test" ? "Starts in (minutes)" : "Deadline (hours)"}
                      </Text>
                      <TextInput
                        value={activityType === "test" ? startInMinutes : availabilityHours}
                        onChangeText={activityType === "test" ? setStartInMinutes : setAvailabilityHours}
                        keyboardType="number-pad"
                        style={styles.input}
                      />
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>Results</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label="Private"
                      onPress={() => setResultVisibility("private")}
                      variant={resultVisibility === "private" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label="Public"
                      onPress={() => setResultVisibility("public")}
                      variant={resultVisibility === "public" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                  </View>

                  <Text style={styles.sectionLabel}>Question order</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label="Same for all"
                      onPress={() => setQuestionOrderMode("same")}
                      variant={questionOrderMode === "same" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label="Shuffle per student"
                      onPress={() => setQuestionOrderMode("shuffled")}
                      variant={questionOrderMode === "shuffled" ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                  </View>

                  <PrimaryButton
                    label={
                      acceptedQuestions.length >= desiredQuestionCount ? "Question set complete" : "Load question candidates"
                    }
                    onPress={generateCandidates}
                    loading={candidateLoading}
                    disabled={acceptedQuestions.length >= desiredQuestionCount}
                  />

                  <Text style={styles.sectionLabel}>
                    Accepted questions ({acceptedQuestions.length}/{desiredQuestionCount})
                  </Text>
                  {acceptedQuestions.length === 0 ? (
                    <Text style={styles.helperText}>Accept candidate questions to build the assignment.</Text>
                  ) : (
                    acceptedQuestions.map((question) => (
                      <View key={question.id} style={styles.questionCard}>
                        <Text style={styles.questionPrompt}>{question.prompt}</Text>
                        <PrimaryButton
                          label="Remove"
                          variant="secondary"
                          onPress={() => removeAcceptedQuestion(question.id)}
                        />
                      </View>
                    ))
                  )}

                  <Text style={styles.sectionLabel}>Candidate questions</Text>
                  {candidateQuestions.length === 0 ? (
                    <Text style={styles.helperText}>Load candidates, then accept or ignore them.</Text>
                  ) : (
                    candidateQuestions.map((question) => (
                      <View key={question.id} style={styles.questionCard}>
                        <Text style={styles.questionPrompt}>{question.prompt}</Text>
                        <Text style={styles.helperText}>{question.options.join(" | ")}</Text>
                        <View style={styles.inlineActions}>
                          <PrimaryButton
                            label="Accept"
                            onPress={() => acceptCandidate(question)}
                            style={styles.inlineButton}
                          />
                          <PrimaryButton
                            label="Ignore"
                            variant="secondary"
                            onPress={() =>
                              setCandidateQuestions((current) => current.filter((entry) => entry.id !== question.id))
                            }
                            style={styles.inlineButton}
                          />
                        </View>
                      </View>
                    ))
                  )}

                  <PrimaryButton
                    label={activityType === "test" ? "Publish test" : "Publish assignment"}
                    onPress={publishAssignment}
                    loading={publishingAssignment}
                    disabled={acceptedQuestions.length < desiredQuestionCount}
                  />
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
              <Text style={styles.cardTitle}>Teacher invites</Text>
              {pendingStudentInvites.length === 0 ? (
                <Text style={styles.helperText}>No invites waiting for your approval.</Text>
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
                  <PrimaryButton
                    label="View results"
                    variant="secondary"
                    onPress={() => openActivityDashboard(activity)}
                  />
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
  heroText: {
    color: "#E8F4FB",
    marginTop: 10,
    lineHeight: 22,
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
});
