import { useFocusEffect, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
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
  getClassroomActivityDetails,
  getClassroomDetails,
  inviteStudentToClassroom,
  listClassroomActivities,
  listClassroomClasses,
  removeClassroomMember,
  requestJoinClassroom,
  respondToClassroomMembership,
  syncClassroomProfile,
  updateClassroomActivity,
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

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function canEditScheduledActivity(activity: ClassroomActivitySummary) {
  if (activity.type !== "test") {
    return true;
  }

  return activity.startAt - Date.now() > 5 * 60 * 1000;
}

export default function ClassroomScreen() {
  const hydratingActivityRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [activities, setActivities] = useState<ClassroomActivitySummary[]>([]);
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassroomClassDetailsResponse | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [inviteStudentId, setInviteStudentId] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
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
  const [durationSeconds, setDurationSeconds] = useState("600");
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
  const [customQuestionAnswerIndex, setCustomQuestionAnswerIndex] = useState<number | null>(null);
  const [customQuestionExplanation, setCustomQuestionExplanation] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [hasStartedQuestionSelection, setHasStartedQuestionSelection] = useState(false);
  const [publishingAssignment, setPublishingAssignment] = useState(false);
  const [classActionLoading, setClassActionLoading] = useState(false);
  const [openPicker, setOpenPicker] = useState<"startDate" | "startTime" | "deadlineDate" | "deadlineTime" | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => getMonthStart(new Date()));
  const [pickerHour, setPickerHour] = useState("00");
  const [pickerMinute, setPickerMinute] = useState("00");
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(true);

  const language = profile?.language ?? "en";
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")), []);
  const quarterHourOptions = useMemo(
    () =>
      Array.from({ length: 24 * 4 }, (_, index) => {
        const hour = String(Math.floor(index / 4)).padStart(2, "0");
        const minute = String((index % 4) * 15).padStart(2, "0");
        return `${hour}:${minute}`;
      }),
    []
  );
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
  const computedTestDurationMinutes = useMemo(() => {
    if (activityType !== "test") {
      return 0;
    }

    const seconds = Math.max(0, Number(durationSeconds) || 0);
    if (seconds <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(seconds / 60));
  }, [activityType, durationSeconds]);
  const computedTestEndAt = useMemo(() => {
    if (activityType !== "test") {
      return null;
    }

    const parsedStart = parseDateTimeInput(startDate, startTime);
    const seconds = Math.max(0, Number(durationSeconds) || 0);
    if (!parsedStart || seconds <= 0) {
      return null;
    }

    return parsedStart + seconds * 1000;
  }, [activityType, durationSeconds, startDate, startTime]);
  const computedTestEndTimeLabel = useMemo(() => {
    if (!computedTestEndAt) {
      return "Set start time and duration";
    }

    const endDate = new Date(computedTestEndAt);
    const hours = String(endDate.getHours()).padStart(2, "0");
    const minutes = String(endDate.getMinutes()).padStart(2, "0");
    const seconds = String(endDate.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [computedTestEndAt]);
  const calendarDays = useMemo(() => {
    const monthStart = getMonthStart(pickerMonth);
    const firstWeekday = monthStart.getDay();
    const firstCell = new Date(monthStart);
    firstCell.setDate(monthStart.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        date,
        value: formatLocalDateValue(date),
        inMonth: date.getMonth() === monthStart.getMonth(),
      };
    });
  }, [pickerMonth]);

  useEffect(() => {
    if (hydratingActivityRef.current) {
      hydratingActivityRef.current = false;
      return;
    }

    setCandidateQuestions([]);
    setAcceptedQuestions([]);
    setIsReviewingQuestions(false);
    setReviewPage(0);
    setHasStartedQuestionSelection(false);
  }, [activityType, customSubjectName, customTopicLabel, difficulty, focusMode, grade, level, questionCount, questionOrderMode, resultVisibility, subjectId, topicId, useCustomSubject]);

  useEffect(() => {
    if (activityType !== "test") {
      return;
    }

    if (!startDate) {
      const today = formatLocalDateValue(new Date());
      setStartDate(today);
    }
  }, [activityType, startDate]);

  useEffect(() => {
    if (!hasStartedQuestionSelection || candidateLoading || acceptedQuestions.length >= desiredQuestionCount) {
      return;
    }

    if (candidateQuestions.length > 0) {
      return;
    }

    void generateCandidates();
  }, [acceptedQuestions.length, candidateLoading, candidateQuestions.length, desiredQuestionCount, hasStartedQuestionSelection]);

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
    } else {
      setSelectedClassDetails(null);
    }
  };

  const openDatePicker = (picker: "startDate" | "deadlineDate") => {
    const currentValue =
      picker === "startDate" ? startDate : deadlineDate;
    const parsed = currentValue ? parseLocalDateValue(currentValue) : null;
    setPickerMonth(getMonthStart(parsed ?? new Date()));
    setOpenPicker(picker);
  };

  const selectDateValue = (value: string) => {
    if (openPicker === "startDate") {
      setStartDate(value);
    } else if (openPicker === "deadlineDate") {
      setDeadlineDate(value);
    }

    setOpenPicker(null);
  };

  const resetActivityBuilder = () => {
    setEditingActivityId(null);
    setAssignmentTitle("");
    setAcceptedQuestions([]);
    setCandidateQuestions([]);
    setIsReviewingQuestions(false);
    setReviewPage(0);
    setDeadlineDate("");
    setDeadlineTime("");
    setStartDate("");
    setStartTime("");
    setDurationSeconds("600");
    setCustomSubjectName("");
    setCustomTopicLabel("");
    setUseCustomSubject(false);
    setShowCustomQuestionForm(false);
    setHasStartedQuestionSelection(false);
    setOpenPicker(null);
    setCustomQuestionAnswerIndex(null);
    setCustomQuestionPrompt("");
    setCustomQuestionOptions(["", "", "", ""]);
    setCustomQuestionExplanation("");
  };

  const copyClassCode = async (classCode: string) => {
    try {
      await Clipboard.setStringAsync(classCode);
      Alert.alert("Classroom", "Class code copied.");
    } catch {
      Alert.alert("Classroom", "Unable to copy the class code.");
    }
  };

  const openTimePicker = (picker: "startTime" | "deadlineTime") => {
    const currentValue = picker === "startTime" ? startTime : deadlineTime;
    const [hour = "00", minute = "00"] = currentValue ? currentValue.split(":") : ["00", "00"];
    setPickerHour(hour);
    setPickerMinute(minute);
    setOpenPicker(picker);
  };

  const confirmTimeValue = () => {
    const value = `${pickerHour}:${pickerMinute}`;
    if (openPicker === "startTime") {
      setStartTime(value);
    } else if (openPicker === "deadlineTime") {
      setDeadlineTime(value);
    }
    setOpenPicker(null);
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
    setHasStartedQuestionSelection(true);
    try {
      const remainingCount = Math.max(1, desiredQuestionCount - acceptedQuestions.length);
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
        batchCount: Math.min(10, remainingCount),
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

    if (customQuestionAnswerIndex === null) {
      Alert.alert("Custom question", "Choose the correct answer.");
      return;
    }

    const answer = customQuestionOptions[customQuestionAnswerIndex]?.trim();
    if (!answer) {
      Alert.alert("Custom question", "The marked correct option cannot be empty.");
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
    setCustomQuestionAnswerIndex(null);
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
    const parsedEndAt = activityType === "test" ? computedTestEndAt : null;
    const parsedDeadline = activityType === "assignment" ? parseDateTimeInput(deadlineDate, deadlineTime) : null;

    if (activityType === "test" && !parsedStartAt) {
      Alert.alert("Test", "Enter a valid start date and time.");
      return;
    }

    if (activityType === "test" && !parsedEndAt) {
      Alert.alert("Test", "Enter a valid duration in seconds.");
      return;
    }

    if (activityType === "test" && parsedStartAt && parsedEndAt && parsedEndAt <= parsedStartAt) {
      Alert.alert("Test", "End time must be later than start time.");
      return;
    }

    if (activityType === "test" && parsedStartAt && parsedEndAt) {
      const startDateValue = formatLocalDateValue(new Date(parsedStartAt));
      const endDateValue = formatLocalDateValue(new Date(parsedEndAt));
      if (startDateValue !== endDateValue) {
        Alert.alert("Test", "Test end time must remain on the same day as the test date.");
        return;
      }
    }

    if (activityType === "assignment" && !parsedDeadline) {
      Alert.alert("Assignment", "Enter a valid deadline date and time.");
      return;
    }

    if (activityType === "assignment" && parsedDeadline && parsedDeadline <= Date.now()) {
      Alert.alert("Assignment", "Deadline must be in the future.");
      return;
    }

    setPublishingAssignment(true);
    try {
      const payload = {
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
        durationMinutes:
          activityType === "test"
            ? Math.max(1, computedTestDurationMinutes)
            : Math.max(5, Math.ceil(((parsedDeadline ?? Date.now()) - Date.now()) / 60000)),
        availabilityHours: 24,
        startAt: parsedStartAt ?? undefined,
        endAt:
          activityType === "test"
            ? parsedEndAt ?? undefined
            : parsedDeadline ?? undefined,
        resultVisibility,
        questionOrderMode,
        questions: acceptedQuestions.slice(0, desiredQuestionCount),
      };

      if (editingActivityId) {
        await updateClassroomActivity({
          ...payload,
          activityId: editingActivityId,
        });
      } else {
        await createClassroomAssignment(payload);
      }
      resetActivityBuilder();
      await refreshClassroomData();
      Alert.alert(
        editingActivityId ? "Activity updated" : activityType === "test" ? "Test published" : "Assignment published",
        editingActivityId
          ? "Your activity changes are saved."
          : activityType === "test"
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

  const editActivity = async (activity: ClassroomActivitySummary) => {
    if (!profile) {
      return;
    }

    if (!canEditScheduledActivity(activity)) {
      Alert.alert("Classroom", "Tests can no longer be edited within 5 minutes of the start time.");
      return;
    }

    setClassActionLoading(true);
    try {
      const details = await getClassroomActivityDetails({
        profile,
        activityId: activity.activityId,
      });
      hydratingActivityRef.current = true;
      setSelectedClassId(activity.classId);
      setEditingActivityId(activity.activityId);
      setActivityExpanded(true);
      setAssignmentTitle(activity.title);
      setActivityType(activity.type);
      setGrade(activity.grade);
      setLevel(String(activity.level));
      setDifficulty(activity.difficulty);
      setFocusMode(activity.focusMode);
      setQuestionCount(String(activity.questionCount));
      setResultVisibility(activity.resultVisibility);
      setQuestionOrderMode(activity.questionOrderMode);
      setAcceptedQuestions(details.questions);
      setCandidateQuestions([]);
      setIsReviewingQuestions(false);
      setReviewPage(0);
      setShowCustomQuestionForm(false);
      setHasStartedQuestionSelection(true);
      setOpenPicker(null);
      setCustomQuestionAnswerIndex(null);
      setCustomQuestionPrompt("");
      setCustomQuestionOptions(["", "", "", ""]);
      setCustomQuestionExplanation("");

      if (activity.usesCustomSubject) {
        setUseCustomSubject(true);
        setCustomSubjectName(activity.subjectName);
      } else {
        setUseCustomSubject(false);
        setSubjectId(activity.subjectId);
      }

      if (activity.focusMode === "topic") {
        if (activity.usesCustomTopic) {
          setCustomTopicLabel(activity.topicLabel ?? "");
        } else {
          setTopicId(activity.topicId ?? null);
          setCustomTopicLabel("");
        }
      } else {
        setTopicId(activity.topicId ?? null);
        setCustomTopicLabel("");
      }

      if (activity.type === "test") {
        const start = new Date(activity.startAt);
        setStartDate(formatLocalDateValue(start));
        setStartTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
        setDurationSeconds(String(Math.max(1, Math.round((activity.endAt - activity.startAt) / 1000))));
        setDeadlineDate("");
        setDeadlineTime("");
      } else {
        const deadline = new Date(activity.endAt);
        setDeadlineDate(formatLocalDateValue(deadline));
        setDeadlineTime(`${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}`);
        setStartDate("");
        setStartTime("");
        setDurationSeconds("600");
      }
    } catch (error) {
      Alert.alert("Classroom", error instanceof Error ? error.message : "Unable to load the activity for editing.");
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
              <Pressable style={styles.sectionToggle} onPress={() => setManagementExpanded((current) => !current)}>
                <Text style={styles.cardTitle}>Class management</Text>
                <Text style={styles.sectionToggleIcon}>{managementExpanded ? "-" : "+"}</Text>
              </Pressable>
              {managementExpanded ? (
                <>
                  <TextInput
                    value={newClassName}
                    onChangeText={setNewClassName}
                    placeholder="Class name"
                    placeholderTextColor="#8092A7"
                    style={styles.input}
                  />
                  <PrimaryButton label="Create class" onPress={createClass} loading={saving} />

                  <Text style={styles.sectionLabel}>Your classes</Text>
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
                        <View style={styles.codeRow}>
                          <Text style={styles.classMeta}>Code: {entry.classCode}</Text>
                          <Pressable onPress={() => copyClassCode(entry.classCode)} style={styles.copyButton}>
                            <MaterialIcons name="content-copy" size={16} color={palette.navy} />
                          </Pressable>
                        </View>
                        <Text style={styles.classMeta}>Members: {entry.memberCount}</Text>
                      </Pressable>
                    ))
                  )}

                  {selectedClass ? (
                    <>
                      <Text style={styles.sectionLabel}>Roster</Text>
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

                      <Text style={styles.sectionLabel}>Invite student by ID</Text>
                      <TextInput
                        value={inviteStudentId}
                        onChangeText={setInviteStudentId}
                        placeholder="Student Quiks ID"
                        placeholderTextColor="#8092A7"
                        style={styles.input}
                      />
                      <PrimaryButton label="Send invite" onPress={inviteStudent} loading={saving} />
                    </>
                  ) : null}
                </>
              ) : null}
            </View>

            {selectedClass ? (
              <>
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
                  <Pressable style={styles.sectionToggle} onPress={() => setActivityExpanded((current) => !current)}>
                    <Text style={styles.cardTitle}>Create activity</Text>
                    <Text style={styles.sectionToggleIcon}>{activityExpanded ? "-" : "+"}</Text>
                  </Pressable>
                  {activityExpanded ? (
                    <>
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

                  {activityType === "test" ? (
                    <>
                      <View style={styles.dualInputRow}>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Test date</Text>
                          <Pressable onPress={() => openDatePicker("startDate")} style={styles.pickerTrigger}>
                            <Text style={[styles.pickerValue, !startDate ? styles.pickerPlaceholder : null]}>
                              {startDate || "Select date"}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Duration (Seconds)</Text>
                          <TextInput value={durationSeconds} onChangeText={setDurationSeconds} keyboardType="number-pad" style={styles.input} />
                        </View>
                      </View>

                      <View style={styles.dualInputRow}>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Start time</Text>
                          <Pressable onPress={() => openTimePicker("startTime")} style={styles.pickerTrigger}>
                            <Text style={[styles.pickerValue, !startTime ? styles.pickerPlaceholder : null]}>
                              {startTime || "Select time"}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>End time</Text>
                          <View style={styles.readOnlyField}>
                            <Text style={styles.readOnlyValue}>{computedTestEndTimeLabel}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.dualInputRow}>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Custom question</Text>
                          <PrimaryButton
                            label={showCustomQuestionForm ? "Hide custom question" : "Custom question"}
                            variant="secondary"
                            onPress={() => setShowCustomQuestionForm((current) => !current)}
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.dualInputRow}>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Deadline date</Text>
                          <Pressable onPress={() => openDatePicker("deadlineDate")} style={styles.pickerTrigger}>
                            <Text style={[styles.pickerValue, !deadlineDate ? styles.pickerPlaceholder : null]}>
                              {deadlineDate || "Select date"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.dualInputRow}>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Deadline time</Text>
                          <Pressable onPress={() => openTimePicker("deadlineTime")} style={styles.pickerTrigger}>
                            <Text style={[styles.pickerValue, !deadlineTime ? styles.pickerPlaceholder : null]}>
                              {deadlineTime || "Select time"}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.dualInputItem}>
                          <Text style={styles.sectionLabel}>Custom question</Text>
                          <PrimaryButton
                            label={showCustomQuestionForm ? "Hide custom question" : "Custom question"}
                            variant="secondary"
                            onPress={() => setShowCustomQuestionForm((current) => !current)}
                          />
                        </View>
                      </View>
                    </>
                  )}

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
                          <TextInput
                            value={option}
                            onChangeText={(value) => setCustomQuestionOptions((current) => current.map((entry, optionIndex) => (optionIndex === index ? value : entry)))}
                            placeholder={`Option ${index + 1}`}
                            placeholderTextColor="#7C8EA3"
                            style={[styles.input, styles.customOptionInput]}
                          />
                          <Pressable onPress={() => setCustomQuestionAnswerIndex(index)} style={[styles.answerPick, customQuestionAnswerIndex === index ? styles.answerPickActive : null]}>
                            <Text style={[styles.answerPickText, customQuestionAnswerIndex === index ? styles.answerPickTextActive : null]}>
                              {customQuestionAnswerIndex === index ? "Correct" : "Mark"}
                            </Text>
                          </Pressable>
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
                      <PrimaryButton label={editingActivityId ? "Save changes" : activityType === "test" ? "Publish test" : "Publish assignment"} onPress={publishAssignment} loading={publishingAssignment} style={styles.inlineButton} />
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
                    </>
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
                  <View style={styles.activityActionRow}>
                    <PrimaryButton
                      label={canEditScheduledActivity(activity) ? "Edit" : "Locked"}
                      variant="secondary"
                      onPress={() => editActivity(activity)}
                      loading={classActionLoading}
                      style={styles.activityActionButton}
                      compact
                      disabled={!canEditScheduledActivity(activity)}
                    />
                    <PrimaryButton
                      label="Results"
                      variant="secondary"
                      onPress={() => openActivityDashboard(activity)}
                      style={styles.activityActionButton}
                      compact
                    />
                    <PrimaryButton
                      label="Duplicate"
                      onPress={() => duplicateActivity(activity)}
                      loading={classActionLoading}
                      style={styles.activityActionButton}
                      compact
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
      <Modal visible={openPicker !== null} transparent animationType="fade" onRequestClose={() => setOpenPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenPicker(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {openPicker === "startDate" || openPicker === "deadlineDate" ? (
              <>
                <View style={styles.modalHeader}>
                  <PrimaryButton
                    label="Prev"
                    variant="secondary"
                    onPress={() => setPickerMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                    style={styles.modalNavButton}
                  />
                  <Text style={styles.modalTitle}>
                    {pickerMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </Text>
                  <PrimaryButton
                    label="Next"
                    variant="secondary"
                    onPress={() => setPickerMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                    style={styles.modalNavButton}
                  />
                </View>
                <View style={styles.calendarWeekRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <Text key={day} style={styles.calendarWeekday}>
                      {day}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((entry) => {
                    const selectedValue =
                      openPicker === "startDate"
                        ? startDate
                        : deadlineDate;
                    const todayValue = formatLocalDateValue(new Date());
                    const isSelected = selectedValue === entry.value;
                    const isPastDate = entry.value < todayValue;
                    return (
                      <Pressable
                        key={entry.key}
                        onPress={() => {
                          if (!isPastDate) {
                            selectDateValue(entry.value);
                          }
                        }}
                        disabled={isPastDate}
                        style={[
                          styles.calendarCell,
                          !entry.inMonth ? styles.calendarCellMuted : null,
                          isPastDate ? styles.calendarCellDisabled : null,
                          isSelected ? styles.calendarCellActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellText,
                            !entry.inMonth ? styles.calendarCellTextMuted : null,
                            isPastDate ? styles.calendarCellTextDisabled : null,
                            isSelected ? styles.calendarCellTextActive : null,
                          ]}
                        >
                          {entry.date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : openPicker === "deadlineTime" ? (
              <>
                <Text style={styles.modalTitle}>Select time</Text>
                <ScrollView style={styles.modalList} nestedScrollEnabled>
                  {quarterHourOptions.map((value) => (
                    <Pressable
                      key={`deadline-${value}`}
                      onPress={() => {
                        setDeadlineTime(value);
                        setOpenPicker(null);
                      }}
                      style={[styles.modalListItem, deadlineTime === value ? styles.modalListItemActive : null]}
                    >
                      <Text style={[styles.modalListItemText, deadlineTime === value ? styles.modalListItemTextActive : null]}>{value}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Select time</Text>
                <View style={styles.timePickerRow}>
                  <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
                    {hourOptions.map((hour) => (
                      <Pressable
                        key={`hour-${hour}`}
                        onPress={() => setPickerHour(hour)}
                        style={[styles.modalListItem, pickerHour === hour ? styles.modalListItemActive : null]}
                      >
                        <Text style={[styles.modalListItemText, pickerHour === hour ? styles.modalListItemTextActive : null]}>{hour}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
                    {minuteOptions.map((minute) => (
                      <Pressable
                        key={`minute-${minute}`}
                        onPress={() => setPickerMinute(minute)}
                        style={[styles.modalListItem, pickerMinute === minute ? styles.modalListItemActive : null]}
                      >
                        <Text style={[styles.modalListItemText, pickerMinute === minute ? styles.modalListItemTextActive : null]}>{minute}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <PrimaryButton label="Set time" onPress={confirmTimeValue} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionToggleIcon: {
    color: palette.navy,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
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
  pickerTrigger: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  pickerValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  pickerPlaceholder: {
    color: "#7C8EA3",
    fontWeight: "500",
  },
  pickerMenu: {
    maxHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: palette.white,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F8",
  },
  pickerOptionText: {
    color: palette.ink,
    fontWeight: "600",
  },
  readOnlyField: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F2F5F8",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  readOnlyValue: {
    color: palette.ink,
    fontWeight: "600",
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
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  copyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F4F7",
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
  activityActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  activityActionButton: {
    flex: 1,
    minWidth: 0,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8,17,31,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    gap: 14,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  modalNavButton: {
    minWidth: 84,
  },
  calendarWeekRow: {
    flexDirection: "row",
  },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    color: palette.slate,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  calendarCellMuted: {
    opacity: 0.35,
  },
  calendarCellDisabled: {
    backgroundColor: "#F4F6F8",
  },
  calendarCellActive: {
    backgroundColor: palette.navy,
  },
  calendarCellText: {
    color: palette.ink,
    fontWeight: "700",
  },
  calendarCellTextMuted: {
    color: palette.slate,
  },
  calendarCellTextDisabled: {
    color: "#B6C1CC",
  },
  calendarCellTextActive: {
    color: palette.white,
  },
  modalList: {
    maxHeight: 320,
  },
  timePickerRow: {
    flexDirection: "row",
    gap: 12,
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 280,
  },
  modalListItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F8",
  },
  modalListItemActive: {
    backgroundColor: "#EEF8FB",
  },
  modalListItemText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  modalListItemTextActive: {
    color: palette.navy,
    fontWeight: "800",
  },
});
