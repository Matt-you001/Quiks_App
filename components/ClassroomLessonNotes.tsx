import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { PrimaryButton } from "./PrimaryButton";
import { MathText } from "./MathText";
import {
  createClassroomLessonNote,
  createActivityFromClassroomLessonNote,
  deleteClassroomLessonNote,
  getClassroomLessonNoteAttachment,
  generateLessonNoteActivityCandidates,
  listClassroomLessonNotes,
  refineClassroomLessonNote,
  updateClassroomLessonNote,
} from "../services/ai";
import { palette, shadows } from "../lib/theme";
import type {
  ClassroomLessonNote,
  LessonNoteAttachmentInput,
  LessonNoteRefinementLevel,
  LessonNoteStudentAccess,
  LessonNoteActivityDifficulty,
  ClassroomActivityType,
  Question,
  UserProfile,
} from "../types/app";

interface Props {
  profile: UserProfile;
  classId: string;
  className: string;
  onActivityCreated?: () => void | Promise<void>;
}

const refinementOptions: Array<{ id: LessonNoteRefinementLevel; label: string; hint: string }> = [
  { id: "none", label: "As prepared", hint: "Publish your original note without changes." },
  { id: "minimal", label: "Minimal", hint: "Correct errors and make small clarity improvements." },
  { id: "rich", label: "Rich", hint: "Make the supplied content fuller, clearer, and more complete." },
  { id: "deep", label: "Deep", hint: "Add examples and lightweight pictorial learning diagrams." },
];

function askForConfirmation(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);
}

function bytesToLabel(bytes?: number) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDeadlineDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalDateValue(tomorrow);
}

function cleanNoteText(value: string) {
  return value
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function derivedNoteTitle(subject: string, topic: string) {
  return [subject.trim(), topic.trim()].filter(Boolean).join(": ") || "Lesson Note";
}

function lessonNoteListTitle(note: ClassroomLessonNote) {
  if (note.topic?.trim()) return note.topic.trim();
  const subjectPrefix = note.subject?.trim();
  if (subjectPrefix && note.title.toLowerCase().startsWith(`${subjectPrefix.toLowerCase()}:`)) {
    return note.title.slice(subjectPrefix.length + 1).trim() || note.title;
  }
  return note.title;
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function illustrationIcon(value: string) {
  const text = value.toLowerCase();
  if (/plant|leaf|photosynth/.test(text)) return "leaf";
  if (/human|body|person|male|female/.test(text)) return "human-male-female";
  if (/cell|micro|bacter|amoeba/.test(text)) return "hexagon-multiple-outline";
  if (/water|rain|liquid/.test(text)) return "water";
  if (/earth|world|global/.test(text)) return "earth";
  if (/number|math|fraction|calculate/.test(text)) return "calculator-variant-outline";
  return "lightbulb-on-outline";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function buildLessonNoteDocument(note: ClassroomLessonNote) {
  const paragraphs = cleanNoteText(note.content).split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const visuals = (note.illustrations ?? []).map((illustration) => `
    <section class="visual">
      <h2>◉ ${escapeHtml(illustration.title)}</h2>
      <div class="steps">${illustration.points.map((point, index) => `<div class="step"><div class="icon">${index + 1}</div><strong>${escapeHtml(cleanNoteText(point))}</strong></div>${index < illustration.points.length - 1 ? '<div class="arrow">↓</div>' : ""}`).join("")}</div>
      <p class="caption">${escapeHtml(illustration.caption)}</p>
    </section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(note.title)}</title><style>
    body{font-family:Arial,sans-serif;color:#163845;max-width:820px;margin:0 auto;padding:36px;line-height:1.55}h1{color:#075e66;margin-bottom:4px}.meta{color:#17a99d;font-weight:700;margin-bottom:28px}p{white-space:normal}.visual{background:#eef9fa;border:1px solid #cfe9e8;border-radius:22px;padding:24px;margin:28px 0;page-break-inside:avoid}.visual h2{text-align:center;color:#075e66}.steps{display:flex;flex-direction:column;align-items:center;gap:8px}.step{text-align:center;max-width:560px}.icon{width:52px;height:52px;border-radius:50%;background:#17b8aa;color:white;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;margin:0 auto 8px}.arrow{font-size:30px;color:#17b8aa}.caption{text-align:center;color:#536d79;font-style:italic}.footer{margin-top:36px;border-top:1px solid #d8e7ea;padding-top:12px;color:#6a7f88;font-size:12px}@media print{body{padding:10mm}.visual{break-inside:avoid}}</style></head><body>
    <h1>${escapeHtml(note.title)}</h1><div class="meta">${escapeHtml([note.subject, note.topic].filter(Boolean).join(" · "))}</div>${paragraphs}${visuals}<div class="footer">Prepared in Quiks Classroom</div>
  </body></html>`;
}

function parseLocalDateTime(dateValue: string, timeValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) return null;
  return parsed.getTime();
}

function formatTimeWithSeconds(timestamp: number | null) {
  if (!timestamp) return "Set start time and duration";
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

export function ClassroomLessonNotes({ profile, classId, className, onActivityCreated }: Props) {
  const isTeacher = profile.role === "teacher";
  const [notes, setNotes] = useState<ClassroomLessonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [refinementLevel, setRefinementLevel] = useState<LessonNoteRefinementLevel>("none");
  const [illustrations, setIllustrations] = useState<ClassroomLessonNote["illustrations"]>([]);
  const [attachment, setAttachment] = useState<LessonNoteAttachmentInput | undefined>();
  const [reviewReady, setReviewReady] = useState(false);
  const [refinementDropdownOpen, setRefinementDropdownOpen] = useState(false);
  const [studentAccess, setStudentAccess] = useState<LessonNoteStudentAccess>("read_only");
  const [error, setError] = useState<string | null>(null);
  const [viewingNoteId, setViewingNoteId] = useState<string | null>(null);
  const [activityNoteId, setActivityNoteId] = useState<string | null>(null);
  const [noteActivityType, setNoteActivityType] = useState<ClassroomActivityType>("assignment");
  const [noteActivityDifficulty, setNoteActivityDifficulty] = useState<LessonNoteActivityDifficulty>("easy");
  const [difficultyDropdownOpen, setDifficultyDropdownOpen] = useState(false);
  const [noteActivityQuestionCount, setNoteActivityQuestionCount] = useState("5");
  const [noteActivityDeadlineDate, setNoteActivityDeadlineDate] = useState(getDefaultDeadlineDate);
  const [noteActivityDeadlineTime, setNoteActivityDeadlineTime] = useState("18:00");
  const [noteActivityTestDate, setNoteActivityTestDate] = useState(getDefaultDeadlineDate);
  const [noteActivityTestStartTime, setNoteActivityTestStartTime] = useState("09:00");
  const [noteActivityTestDurationSeconds, setNoteActivityTestDurationSeconds] = useState("600");
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"assignment" | "test" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [candidateQuestions, setCandidateQuestions] = useState<Question[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<Question[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [reviewingAccepted, setReviewingAccepted] = useState(false);
  const noteActivityTestStartAt = useMemo(
    () => parseLocalDateTime(noteActivityTestDate, noteActivityTestStartTime),
    [noteActivityTestDate, noteActivityTestStartTime]
  );
  const noteActivityTestEndAt = useMemo(() => {
    const duration = Number(noteActivityTestDurationSeconds);
    return noteActivityTestStartAt && Number.isFinite(duration) && duration > 0
      ? noteActivityTestStartAt + duration * 1000
      : null;
  }, [noteActivityTestDurationSeconds, noteActivityTestStartAt]);
  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, value: toLocalDateValue(date), inMonth: date.getMonth() === calendarMonth.getMonth() };
    });
  }, [calendarMonth]);

  const loadNotes = useCallback(async () => {
    try {
      const response = await listClassroomLessonNotes({ profile, classId });
      setNotes(response.notes);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lesson notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [classId, profile]);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const resetForm = () => {
    setEditingNoteId(null);
    setTitle("");
    setSubject("");
    setTopic("");
    setContent("");
    setRefinementLevel("none");
    setIllustrations([]);
    setAttachment(undefined);
    setReviewReady(false);
    setRefinementDropdownOpen(false);
    setStudentAccess("read_only");
  };

  const chooseAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      Alert.alert("File too large", "Choose a lesson-note file that is 5 MB or smaller.");
      return;
    }
    let dataBase64 = "";
    if (Platform.OS === "web" && asset.file) {
      dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The selected file could not be read."));
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.readAsDataURL(asset.file!);
      });
    } else {
      dataBase64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    }
    setAttachment({ name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", size: asset.size ?? 0, dataBase64 });
    if ((asset.mimeType === "text/plain" || asset.name.toLowerCase().endsWith(".txt")) && !content.trim()) {
      try {
        const plainText = Platform.OS === "web" && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setContent(plainText);
      } catch {
        // The attachment remains usable even when its text cannot be prefilled.
      }
    }
  };

  const refineNote = async () => {
    if (!content.trim() || refinementLevel === "none") {
      Alert.alert("Note details needed", "Enter the lesson-note content, then select Minimal, Rich, or Deep refinement.");
      return;
    }
    setWorking(true);
    try {
      const refined = await refineClassroomLessonNote({ teacherProfile: profile, classId, title: title || derivedNoteTitle(subject, topic), subject, topic, content, refinementLevel });
      setTitle(cleanNoteText(refined.title));
      setContent(cleanNoteText(refined.content));
      setIllustrations(refined.illustrations);
      setReviewReady(true);
      Alert.alert("Refinement ready", "Review and edit the refined lesson note before publishing it.");
    } catch (caught) {
      Alert.alert("Refinement failed", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const saveNote = async (status: "draft" | "published") => {
    if (status === "published" && studentAccess === "read_only" && !content.trim()) {
      Alert.alert("Readable content needed", "Read Only notes must include content that students can read inside Quiks. Paste the note content before publishing.");
      return;
    }
    const resolvedContent = cleanNoteText(content.trim()) || (attachment ? `Attached lesson note: ${attachment.name}` : "");
    const resolvedTitle = cleanNoteText(title.trim() || derivedNoteTitle(subject, topic));
    if (!resolvedContent) {
      Alert.alert("Note details needed", "Enter note content, or attach a lesson-note file.");
      return;
    }
    setWorking(true);
    try {
      if (editingNoteId) {
        await updateClassroomLessonNote({ teacherProfile: profile, noteId: editingNoteId, title: resolvedTitle, subject, topic, content: resolvedContent, illustrations, refinementLevel, status, studentAccess, attachment });
      } else {
        await createClassroomLessonNote({ teacherProfile: profile, classId, title: resolvedTitle, subject, topic, content: resolvedContent, illustrations, refinementLevel, status, studentAccess, attachment });
      }
      resetForm();
      await loadNotes();
      Alert.alert(status === "published" ? "Lesson note published" : "Draft saved", status === "published" ? (studentAccess === "allow_download" ? "Students can now read and download it." : "Students can now read it in Quiks.") : "Only you can see this draft.");
    } catch (caught) {
      Alert.alert("Could not save note", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const editNote = (note: ClassroomLessonNote) => {
    setEditingNoteId(note.noteId);
    setTitle(note.title);
    setSubject(note.subject ?? "");
    setTopic(note.topic ?? "");
    setContent(note.content);
    setRefinementLevel(note.refinementLevel);
    setIllustrations(note.illustrations ?? []);
    setReviewReady(true);
    setStudentAccess(note.studentAccess ?? "allow_download");
  };

  const removeNote = (note: ClassroomLessonNote) => askForConfirmation(
    "Delete lesson note?",
    `“${note.title}” and its attachment will be permanently removed from ${className}.`,
    () => void (async () => {
      try {
        await deleteClassroomLessonNote({ teacherProfile: profile, noteId: note.noteId });
        if (editingNoteId === note.noteId) resetForm();
        await loadNotes();
      } catch (caught) {
        Alert.alert("Could not delete note", caught instanceof Error ? caught.message : "Please try again.");
      }
    })()
  );

  const downloadAttachment = async (note: ClassroomLessonNote) => {
    try {
      const file = await getClassroomLessonNoteAttachment({ profile, noteId: note.noteId });
      if (Platform.OS === "web") {
        const binary = atob(file.dataBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const path = `${FileSystem.cacheDirectory}${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        await FileSystem.writeAsStringAsync(path, file.dataBase64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: file.mimeType, dialogTitle: `Save ${file.name}` });
        } else {
          const openPath = Platform.OS === "android" ? await FileSystem.getContentUriAsync(path) : path;
          await Linking.openURL(openPath);
        }
      }
    } catch (caught) {
      Alert.alert("Download failed", caught instanceof Error ? caught.message : "The attachment could not be downloaded.");
    }
  };

  const downloadLessonNote = async (note: ClassroomLessonNote) => {
    try {
      const fileName = `${note.title.replace(/[^a-zA-Z0-9._-]+/g, "-") || "lesson-note"}.html`;
      const noteDocument = buildLessonNoteDocument(note);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([noteDocument], { type: "text/html;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const path = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(path, noteDocument, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: "text/html", dialogTitle: `Save ${note.title}` });
        else await Linking.openURL(Platform.OS === "android" ? await FileSystem.getContentUriAsync(path) : path);
      }
    } catch (caught) {
      Alert.alert("Download failed", caught instanceof Error ? caught.message : "The lesson note could not be downloaded.");
    }
  };

  const openActivityCreator = (note: ClassroomLessonNote) => {
    setActivityNoteId((current) => current === note.noteId ? null : note.noteId);
    setNoteActivityType("assignment");
    setNoteActivityDifficulty("easy");
    setNoteActivityQuestionCount("5");
    setNoteActivityDeadlineDate(getDefaultDeadlineDate());
    setNoteActivityDeadlineTime("18:00");
    setNoteActivityTestDate(getDefaultDeadlineDate());
    setNoteActivityTestStartTime("09:00");
    setNoteActivityTestDurationSeconds("600");
    setDifficultyDropdownOpen(false);
    setCandidateQuestions([]);
    setAcceptedQuestions([]);
    setReviewingAccepted(false);
  };

  const loadNoteActivityCandidates = async (note: ClassroomLessonNote) => {
    const requested = Number(noteActivityQuestionCount);
    if (!Number.isInteger(requested) || requested < 1 || requested > 20) {
      Alert.alert("Question count needed", "Enter between 1 and 20 questions.");
      return;
    }
    setCandidateLoading(true);
    try {
      const response = await generateLessonNoteActivityCandidates({
        teacherProfile: profile,
        noteId: note.noteId,
        difficulty: noteActivityDifficulty,
        questionCount: requested,
        batchCount: Math.min(6, Math.max(1, requested - acceptedQuestions.length)),
      });
      setCandidateQuestions((current) => [...current, ...response.questions.map((question, index) => ({ ...question, id: `${question.id}-${Date.now()}-${index}` }))]);
    } catch (caught) {
      Alert.alert("Questions not generated", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setCandidateLoading(false);
    }
  };

  const acceptNoteQuestion = (question: Question) => {
    const desired = Math.max(1, Number(noteActivityQuestionCount) || 1);
    setAcceptedQuestions((current) => current.length >= desired ? current : [...current, question]);
    setCandidateQuestions((current) => current.filter((item) => item.id !== question.id));
  };

  const createNoteActivity = async (note: ClassroomLessonNote) => {
    const requestedQuestionTotal = Number(noteActivityQuestionCount);
    const questionTotal = Math.max(1, Math.min(requestedQuestionTotal, 20));
    const deadlineAt = parseLocalDateTime(noteActivityDeadlineDate, noteActivityDeadlineTime);
    const durationSeconds = Number(noteActivityTestDurationSeconds);
    if (!Number.isInteger(requestedQuestionTotal) || requestedQuestionTotal < 1 || requestedQuestionTotal > 20) {
      Alert.alert("Question count needed", "Enter between 1 and 20 questions.");
      return;
    }
    if (acceptedQuestions.length < questionTotal) {
      Alert.alert("Review questions first", `Generate and accept ${questionTotal} questions before publishing this activity.`);
      return;
    }
    if (noteActivityType === "assignment" && (!deadlineAt || deadlineAt <= Date.now())) {
      Alert.alert("Invalid deadline", "Enter a future deadline using YYYY-MM-DD and HH:MM.");
      return;
    }
    if (noteActivityType === "test" && (!noteActivityTestStartAt || noteActivityTestStartAt <= Date.now())) {
      Alert.alert("Invalid test start", "Choose a future test date and start time.");
      return;
    }
    if (noteActivityType === "test" && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) {
      Alert.alert("Invalid duration", "Enter the test duration in seconds.");
      return;
    }
    if (
      noteActivityType === "test" &&
      noteActivityTestEndAt &&
      toLocalDateValue(new Date(noteActivityTestEndAt)) !== noteActivityTestDate
    ) {
      Alert.alert("Invalid test duration", "The test must start and end on the same date.");
      return;
    }
    setCreatingActivity(true);
    try {
      await createActivityFromClassroomLessonNote({
        teacherProfile: profile,
        noteId: note.noteId,
        type: noteActivityType,
        difficulty: noteActivityDifficulty,
        questionCount: questionTotal,
        deadlineAt: noteActivityType === "assignment" ? deadlineAt ?? undefined : undefined,
        startAt: noteActivityType === "test" ? noteActivityTestStartAt ?? undefined : undefined,
        durationSeconds: noteActivityType === "test" ? durationSeconds : undefined,
        questions: acceptedQuestions.slice(0, questionTotal),
      });
      setActivityNoteId(null);
      await onActivityCreated?.();
      Alert.alert("Activity created", `${note.title} ${noteActivityType === "test" ? "Test" : "Assignment"} has been published. Open Class Activities and select View to inspect it.`);
    } catch (caught) {
      Alert.alert("Activity not created", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setCreatingActivity(false);
    }
  };

  const openDateCalendar = (target: "assignment" | "test") => {
    const value = target === "assignment" ? noteActivityDeadlineDate : noteActivityTestDate;
    const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
    const base = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setCalendarTarget(target);
  };

  const selectCalendarDate = (value: string) => {
    if (calendarTarget === "assignment") setNoteActivityDeadlineDate(value);
    if (calendarTarget === "test") setNoteActivityTestDate(value);
    setCalendarTarget(null);
  };

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.title}>Lesson Notes</Text>
      <Text style={styles.helper}>Notes for {className}. Published notes are available to every active student in the class.</Text>

      {isTeacher ? (
        <View style={styles.editorCard}>
          <Text style={styles.subtitle}>{editingNoteId ? "Edit lesson note" : "Prepare a lesson note"}</Text>
          <View style={styles.twoColumn}>
            <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor="#8092A7" style={[styles.input, styles.flexInput]} />
            <TextInput value={topic} onChangeText={setTopic} placeholder="Topic" placeholderTextColor="#8092A7" style={[styles.input, styles.flexInput]} />
          </View>
          <TextInput value={content} onChangeText={setContent} placeholder="Type or paste the lesson note here..." placeholderTextColor="#8092A7" style={[styles.input, styles.contentInput]} multiline textAlignVertical="top" />
          <PrimaryButton label={attachment ? `Attached: ${attachment.name}` : editingNoteId ? "Replace attachment" : "Upload PDF, Word, or text note"} variant="secondary" onPress={() => void chooseAttachment()} />
          <Text style={styles.optionHint}>Paste the note content above for in-app reading and AI refinement. Text files are filled in automatically; PDF and Word files remain available as attachments.</Text>
          {attachment ? <Text style={styles.attachmentMeta}>{attachment.name} · {bytesToLabel(attachment.size)}</Text> : null}

          <Text style={styles.label}>Refinement level</Text>
          <Pressable style={styles.dropdownTrigger} onPress={() => setRefinementDropdownOpen((current) => !current)}>
            <View style={styles.dropdownTextWrap}>
              <Text style={styles.optionTitle}>{refinementOptions.find((option) => option.id === refinementLevel)?.label}</Text>
              <Text style={styles.optionHint}>{refinementOptions.find((option) => option.id === refinementLevel)?.hint}</Text>
            </View>
            <MaterialIcons name={refinementDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={palette.navy} />
          </Pressable>
          {refinementDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              {refinementOptions.map((option) => (
                <Pressable key={option.id} style={styles.dropdownOption} onPress={() => { setRefinementLevel(option.id); setReviewReady(false); setRefinementDropdownOpen(false); }}>
                  <Text style={styles.optionTitle}>{option.label}</Text><Text style={styles.optionHint}>{option.hint}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {refinementLevel !== "none" ? <PrimaryButton label="Refine and review" onPress={() => void refineNote()} loading={working} /> : null}
          {refinementLevel === "none" && !reviewReady ? <PrimaryButton label="Review note" onPress={() => content.trim() || attachment ? setReviewReady(true) : Alert.alert("Note details needed", "Enter or upload lesson-note content first.")} /> : null}
          {reviewReady || editingNoteId ? (
            <>
              <Text style={styles.label}>Student permission</Text>
              <View style={styles.actionRow}>
                <PrimaryButton label="Read Only" variant={studentAccess === "read_only" ? "primary" : "secondary"} onPress={() => setStudentAccess("read_only")} style={styles.actionButton} />
                <PrimaryButton label="Allow Download" variant={studentAccess === "allow_download" ? "primary" : "secondary"} onPress={() => setStudentAccess("allow_download")} style={styles.actionButton} />
              </View>
              <Text style={styles.optionHint}>{studentAccess === "read_only" ? "Students can read the note in Quiks, but cannot download its attachment." : "Students can read the note and download its attachment."}</Text>
              <View style={styles.actionRow}>
                <PrimaryButton label="Save draft" variant="secondary" onPress={() => void saveNote("draft")} loading={working} style={styles.actionButton} />
                <PrimaryButton label={editingNoteId ? "Save and publish" : "Publish for students"} onPress={() => void saveNote("published")} loading={working} style={styles.actionButton} />
                {editingNoteId ? <PrimaryButton label="Cancel edit" variant="ghost" onPress={resetForm} style={styles.actionButton} /> : null}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {loading ? <Text style={styles.helper}>Loading lesson notes...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && notes.length === 0 ? <Text style={styles.empty}>No lesson notes have been published for this class yet.</Text> : null}
      {notes.map((note) => (
        <View key={note.noteId} style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <View style={styles.noteHeaderText}>
              <Text style={styles.subtitle}>{lessonNoteListTitle(note)}</Text>
              {note.subject?.trim() || note.topic?.trim() ? (
                <Text style={styles.noteMeta}>
                  {[note.subject?.trim(), note.topic?.trim()].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
              {note.status === "draft" ? <Text style={styles.noteMeta}>Draft</Text> : null}
            </View>
            <Text style={styles.date}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
          </View>
          <PrimaryButton label={viewingNoteId === note.noteId ? "Close note" : "View note"} variant="secondary" onPress={() => setViewingNoteId((current) => current === note.noteId ? null : note.noteId)} compact />
          {viewingNoteId === note.noteId ? (
          <>
          <Text style={styles.noteContent}>{cleanNoteText(note.content)}</Text>
          {(note.illustrations ?? []).map((illustration, index) => (
            <View key={`${note.noteId}-illustration-${index}`} style={styles.illustration}>
              <View style={styles.illustrationHeading}>
                <MaterialCommunityIcons name={illustrationIcon(illustration.title)} size={30} color={palette.aqua} />
                <Text style={styles.illustrationTitle}>{illustration.title}</Text>
              </View>
              <View style={styles.diagramColumn}>
                {illustration.points.map((point, pointIndex) => <View key={point} style={styles.diagramStep}>
                  <View style={styles.diagramIcon}><MaterialCommunityIcons name={illustrationIcon(point)} size={24} color="#FFFFFF" /></View>
                  <Text style={styles.diagramText}>{cleanNoteText(point)}</Text>
                  {pointIndex < illustration.points.length - 1 ? <MaterialIcons name="arrow-downward" size={20} color={palette.aqua} style={styles.diagramArrow} /> : null}
                </View>)}
              </View>
              <Text style={styles.caption}>{illustration.caption}</Text>
            </View>
          ))}
          {(isTeacher || note.studentAccess === "allow_download") ? <PrimaryButton label="Download lesson note" variant="secondary" onPress={() => void downloadLessonNote(note)} compact /> : null}
          {note.attachmentName && (isTeacher || note.studentAccess === "allow_download") ? <PrimaryButton label={`Download original attachment (${note.attachmentName})`} variant="ghost" onPress={() => void downloadAttachment(note)} compact /> : null}
          {!isTeacher && note.studentAccess === "read_only" ? <Text style={styles.readOnlyLabel}>Read Only · Download disabled by the teacher</Text> : null}
          {isTeacher ? (
            <>
              <View style={styles.actionRow}>
                <PrimaryButton label="Create Activity" onPress={() => openActivityCreator(note)} style={styles.actionButton} compact />
                <PrimaryButton label="Edit" variant="secondary" onPress={() => editNote(note)} style={styles.actionButton} compact />
                <PrimaryButton label="Delete" variant="ghost" onPress={() => removeNote(note)} style={styles.actionButton} compact />
              </View>
              {activityNoteId === note.noteId ? (
                <View style={styles.activityCreator}>
                  <Text style={styles.subtitle}>Create activity from this lesson note</Text>
                  <Text style={styles.optionHint}>Subject: {note.subject || "Lesson Note"} · Topic: {note.topic || note.title}. AI questions will use the note content as their source.</Text>
                  <Text style={styles.label}>Activity type</Text>
                  <View style={styles.actionRow}>
                    <PrimaryButton label="Assignment" variant={noteActivityType === "assignment" ? "primary" : "secondary"} onPress={() => setNoteActivityType("assignment")} style={styles.actionButton} />
                    <PrimaryButton label="Test" variant={noteActivityType === "test" ? "primary" : "secondary"} onPress={() => setNoteActivityType("test")} style={styles.actionButton} />
                  </View>
                  <Text style={styles.label}>Difficulty level</Text>
                  <Pressable style={styles.dropdownTrigger} onPress={() => setDifficultyDropdownOpen((current) => !current)}>
                    <Text style={styles.optionTitle}>{noteActivityDifficulty === "easy" ? "Easy" : noteActivityDifficulty === "hard" ? "Hard" : "Very Hard"}</Text>
                    <MaterialIcons name={difficultyDropdownOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={palette.navy} />
                  </Pressable>
                  {difficultyDropdownOpen ? <View style={styles.dropdownMenu}>{(["easy", "hard", "very_hard"] as const).map((difficulty) => (
                    <Pressable key={difficulty} style={styles.dropdownOption} onPress={() => { setNoteActivityDifficulty(difficulty); setDifficultyDropdownOpen(false); setCandidateQuestions([]); setAcceptedQuestions([]); }}>
                      <Text style={styles.optionTitle}>{difficulty === "easy" ? "Easy" : difficulty === "hard" ? "Hard" : "Very Hard"}</Text>
                    </Pressable>
                  ))}</View> : null}
                  <Text style={styles.label}>Number of questions</Text>
                  <TextInput value={noteActivityQuestionCount} onChangeText={setNoteActivityQuestionCount} keyboardType="number-pad" placeholder="1 to 20" placeholderTextColor="#8092A7" style={styles.input} />
                  {noteActivityType === "test" ? (
                    <>
                      <View style={styles.twoColumn}>
                        <View style={styles.fieldColumn}>
                          <Text style={styles.label}>Test date</Text>
                          <Pressable style={styles.dateTrigger} onPress={() => openDateCalendar("test")}><Text style={styles.dateTriggerText}>{noteActivityTestDate}</Text><MaterialIcons name="calendar-month" size={22} color={palette.aqua} /></Pressable>
                        </View>
                        <View style={styles.fieldColumn}>
                          <Text style={styles.label}>Duration (seconds)</Text>
                          <TextInput value={noteActivityTestDurationSeconds} onChangeText={setNoteActivityTestDurationSeconds} keyboardType="number-pad" placeholder="600" placeholderTextColor="#8092A7" style={styles.input} />
                        </View>
                      </View>
                      <View style={styles.twoColumn}>
                        <View style={styles.fieldColumn}>
                          <Text style={styles.label}>Start time</Text>
                          <TextInput value={noteActivityTestStartTime} onChangeText={setNoteActivityTestStartTime} placeholder="HH:MM" placeholderTextColor="#8092A7" style={styles.input} />
                        </View>
                        <View style={styles.fieldColumn}>
                          <Text style={styles.label}>End time</Text>
                          <View style={styles.readOnlyField}><Text style={styles.readOnlyValue}>{formatTimeWithSeconds(noteActivityTestEndAt)}</Text></View>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Submission deadline</Text>
                      <View style={styles.twoColumn}>
                        <Pressable style={[styles.dateTrigger, styles.flexInput]} onPress={() => openDateCalendar("assignment")}><Text style={styles.dateTriggerText}>{noteActivityDeadlineDate}</Text><MaterialIcons name="calendar-month" size={22} color={palette.aqua} /></Pressable>
                        <TextInput value={noteActivityDeadlineTime} onChangeText={setNoteActivityDeadlineTime} placeholder="HH:MM" placeholderTextColor="#8092A7" style={[styles.input, styles.flexInput]} />
                      </View>
                    </>
                  )}
                  <Text style={styles.label}>Question review ({acceptedQuestions.length}/{Math.max(1, Number(noteActivityQuestionCount) || 1)})</Text>
                  {candidateQuestions[0] ? (
                    <View style={styles.questionCard}>
                      <MathText value={candidateQuestions[0].prompt} textStyle={styles.questionPrompt} />
                      {candidateQuestions[0].options.map((option, index) => <MathText key={`${candidateQuestions[0].id}-${index}`} value={`${index + 1}. ${option}`} textStyle={styles.questionOption} />)}
                      <Text style={styles.answerText}>Answer: {candidateQuestions[0].answer}</Text>
                      <Text style={styles.optionHint}>{candidateQuestions[0].explanation}</Text>
                      <View style={styles.actionRow}>
                        <PrimaryButton label="Accept" onPress={() => acceptNoteQuestion(candidateQuestions[0])} style={styles.actionButton} compact />
                        <PrimaryButton label="Skip" variant="secondary" onPress={() => setCandidateQuestions((current) => current.slice(1))} style={styles.actionButton} compact />
                      </View>
                    </View>
                  ) : acceptedQuestions.length < Math.max(1, Number(noteActivityQuestionCount) || 1) ? (
                    <PrimaryButton label={acceptedQuestions.length ? "Load more questions" : "Generate questions"} onPress={() => void loadNoteActivityCandidates(note)} loading={candidateLoading} />
                  ) : null}
                  {acceptedQuestions.length ? <PrimaryButton label={reviewingAccepted ? "Hide accepted questions" : "View accepted questions"} variant="secondary" onPress={() => setReviewingAccepted((current) => !current)} /> : null}
                  {reviewingAccepted ? acceptedQuestions.map((question, index) => <View key={question.id} style={styles.acceptedQuestion}><MathText value={`${index + 1}. ${question.prompt}`} textStyle={styles.questionPrompt} /><PrimaryButton label="Remove" variant="ghost" onPress={() => setAcceptedQuestions((current) => current.filter((item) => item.id !== question.id))} compact /></View>) : null}
                  <View style={styles.actionRow}>
                    <PrimaryButton label={`Publish ${noteActivityType === "test" ? "Test" : "Assignment"}`} onPress={() => void createNoteActivity(note)} loading={creatingActivity} disabled={acceptedQuestions.length < Math.max(1, Number(noteActivityQuestionCount) || 1)} style={styles.actionButton} />
                    <PrimaryButton label="Cancel" variant="ghost" onPress={() => setActivityNoteId(null)} style={styles.actionButton} />
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
          </>
          ) : null}
        </View>
      ))}
      <Modal visible={calendarTarget !== null} transparent animationType="fade" onRequestClose={() => setCalendarTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCalendarTarget(null)}>
          <Pressable style={styles.calendarCard} onPress={() => undefined}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setCalendarMonth((current) => addMonths(current, -1))} disabled={calendarMonth <= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}><MaterialIcons name="chevron-left" size={28} color={palette.navy} /></Pressable>
              <Text style={styles.subtitle}>{calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</Text>
              <Pressable onPress={() => setCalendarMonth((current) => addMonths(current, 1))}><MaterialIcons name="chevron-right" size={28} color={palette.navy} /></Pressable>
            </View>
            <View style={styles.weekRow}>{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekDay}>{day}</Text>)}</View>
            <View style={styles.calendarGrid}>{calendarDays.map(({ date, value, inMonth }) => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const disabled = date.getTime() < today.getTime() || !inMonth;
              return <Pressable key={value} disabled={disabled} onPress={() => selectCalendarDate(value)} style={[styles.calendarDay, disabled ? styles.calendarDayDisabled : null]}><Text style={[styles.calendarDayText, disabled ? styles.calendarDayTextDisabled : null]}>{date.getDate()}</Text></Pressable>;
            })}</View>
            <PrimaryButton label="Cancel" variant="ghost" onPress={() => setCalendarTarget(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: { marginTop: 18, backgroundColor: "#FFFFFF", borderRadius: 28, padding: 20, gap: 14, ...shadows.card },
  editorCard: { backgroundColor: "#F4FAFC", borderRadius: 20, padding: 16, gap: 12 },
  title: { color: palette.navy, fontSize: 25, fontWeight: "900" },
  subtitle: { color: palette.navy, fontSize: 18, fontWeight: "900" },
  helper: { color: "#486273", fontSize: 14, lineHeight: 21 },
  error: { color: "#B42318", fontWeight: "700" },
  empty: { color: "#5D7484", paddingVertical: 16, textAlign: "center" },
  input: { backgroundColor: "#FFFFFF", borderColor: "#D7E3EC", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: palette.navy, fontSize: 15 },
  contentInput: { minHeight: 180 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  flexInput: { flexGrow: 1, flexBasis: 220 },
  fieldColumn: { flexGrow: 1, flexBasis: 220, gap: 6 },
  readOnlyField: { minHeight: 48, justifyContent: "center", backgroundColor: "#E7EFF4", borderColor: "#D0DDE6", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  readOnlyValue: { color: palette.navy, fontSize: 15, fontWeight: "800" },
  label: { color: palette.navy, fontWeight: "800", marginTop: 4 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: { flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: "#CEDCE6", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12 },
  optionActive: { borderColor: palette.aqua, backgroundColor: "#EAFBF8" },
  optionTitle: { color: palette.navy, fontWeight: "900" },
  optionHint: { color: "#5D7484", fontSize: 12, lineHeight: 17, marginTop: 3 },
  dropdownTrigger: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CEDCE6", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  dropdownTextWrap: { flex: 1 },
  dropdownMenu: { borderWidth: 1, borderColor: "#CEDCE6", borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFFFF" },
  dropdownOption: { padding: 13, borderBottomWidth: 1, borderBottomColor: "#E5EDF2" },
  attachmentMeta: { color: "#536B7B", fontSize: 12 },
  readOnlyLabel: { color: "#7A5C00", fontSize: 12, fontWeight: "800", backgroundColor: "#FFF7D6", borderRadius: 12, padding: 10 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { flexGrow: 1, flexBasis: 150 },
  noteCard: { borderWidth: 1, borderColor: "#DCE7EE", borderRadius: 20, padding: 16, gap: 12, backgroundColor: "#FFFFFF" },
  activityCreator: { backgroundColor: "#F1F8FA", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "#D8E8ED" },
  noteHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  noteHeaderText: { flex: 1 },
  noteMeta: { color: palette.aqua, fontSize: 12, fontWeight: "800", marginTop: 3 },
  date: { color: "#718696", fontSize: 12 },
  noteContent: { color: "#263E4D", fontSize: 15, lineHeight: 23 },
  illustration: { backgroundColor: "#EFF8FA", borderRadius: 16, padding: 14, gap: 10 },
  illustrationHeading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  illustrationTitle: { flexShrink: 1, color: palette.navy, fontWeight: "900", textAlign: "center" },
  diagramColumn: { alignItems: "center", gap: 2 },
  diagramStep: { width: "100%", alignItems: "center" },
  diagramIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.aqua, marginBottom: 6 },
  diagramText: { color: palette.navy, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center", maxWidth: 300 },
  diagramArrow: { marginVertical: 4 },
  caption: { color: "#506878", fontSize: 13, lineHeight: 18, textAlign: "center" },
  dateTrigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#FFFFFF", borderColor: "#D7E3EC", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  dateTriggerText: { color: palette.navy, fontSize: 15 },
  questionCard: { borderWidth: 1, borderColor: "#CFE0E8", borderRadius: 16, backgroundColor: "#FFFFFF", padding: 14, gap: 8 },
  questionPrompt: { color: palette.navy, fontSize: 15, lineHeight: 21, fontWeight: "800" },
  questionOption: { color: "#334E5E", fontSize: 14, lineHeight: 20 },
  answerText: { color: palette.aqua, fontWeight: "900" },
  acceptedQuestion: { borderWidth: 1, borderColor: "#D8E5EB", borderRadius: 14, padding: 12, gap: 8, backgroundColor: "#FFFFFF" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(2, 20, 31, 0.58)", alignItems: "center", justifyContent: "center", padding: 18 },
  calendarCard: { width: "100%", maxWidth: 430, backgroundColor: "#FFFFFF", borderRadius: 22, padding: 18, gap: 14 },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekRow: { flexDirection: "row" },
  weekDay: { width: "14.285%", textAlign: "center", color: "#607888", fontWeight: "800" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  calendarDayDisabled: { opacity: 0.25 },
  calendarDayText: { color: palette.navy, fontWeight: "800" },
  calendarDayTextDisabled: { color: "#8092A7" },
});
