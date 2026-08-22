import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { PrimaryButton } from "./PrimaryButton";
import {
  createClassroomLessonNote,
  deleteClassroomLessonNote,
  getClassroomLessonNoteAttachment,
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
  UserProfile,
} from "../types/app";

interface Props {
  profile: UserProfile;
  classId: string;
  className: string;
}

const refinementOptions: Array<{ id: LessonNoteRefinementLevel; label: string; hint: string }> = [
  { id: "none", label: "As prepared", hint: "Publish your original note without AI changes." },
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

export function ClassroomLessonNotes({ profile, classId, className }: Props) {
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
  const [studentAccess, setStudentAccess] = useState<LessonNoteStudentAccess>("read_only");
  const [error, setError] = useState<string | null>(null);

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
    if (!title.trim() || !content.trim() || refinementLevel === "none") {
      Alert.alert("Note details needed", "Enter a title and lesson-note content, then select Minimal, Rich, or Deep refinement.");
      return;
    }
    setWorking(true);
    try {
      const refined = await refineClassroomLessonNote({ teacherProfile: profile, classId, title, subject, topic, content, refinementLevel });
      setTitle(refined.title);
      setContent(refined.content);
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
    const resolvedContent = content.trim() || (attachment ? `Attached lesson note: ${attachment.name}` : "");
    if (!title.trim() || !resolvedContent) {
      Alert.alert("Note details needed", "Enter a title and note content, or attach a lesson-note file.");
      return;
    }
    setWorking(true);
    try {
      if (editingNoteId) {
        await updateClassroomLessonNote({ teacherProfile: profile, noteId: editingNoteId, title, subject, topic, content: resolvedContent, illustrations, refinementLevel, status, studentAccess, attachment });
      } else {
        await createClassroomLessonNote({ teacherProfile: profile, classId, title, subject, topic, content: resolvedContent, illustrations, refinementLevel, status, studentAccess, attachment });
      }
      resetForm();
      await loadNotes();
      Alert.alert(status === "published" ? "Lesson note published" : "Draft saved", status === "published" ? "Students in this class can now view and download it." : "Only you can see this draft.");
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

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.title}>Lesson Notes</Text>
      <Text style={styles.helper}>Notes for {className}. Published notes are available to every active student in the class.</Text>

      {isTeacher ? (
        <View style={styles.editorCard}>
          <Text style={styles.subtitle}>{editingNoteId ? "Edit lesson note" : "Prepare a lesson note"}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Lesson-note title" placeholderTextColor="#8092A7" style={styles.input} />
          <View style={styles.twoColumn}>
            <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor="#8092A7" style={[styles.input, styles.flexInput]} />
            <TextInput value={topic} onChangeText={setTopic} placeholder="Topic" placeholderTextColor="#8092A7" style={[styles.input, styles.flexInput]} />
          </View>
          <TextInput value={content} onChangeText={setContent} placeholder="Type or paste the lesson note here..." placeholderTextColor="#8092A7" style={[styles.input, styles.contentInput]} multiline textAlignVertical="top" />
          <PrimaryButton label={attachment ? `Attached: ${attachment.name}` : editingNoteId ? "Replace attachment" : "Upload PDF, Word, or text note"} variant="secondary" onPress={() => void chooseAttachment()} />
          <Text style={styles.optionHint}>Paste the note content above for in-app reading and AI refinement. Text files are filled in automatically; PDF and Word files remain available as attachments.</Text>
          {attachment ? <Text style={styles.attachmentMeta}>{attachment.name} · {bytesToLabel(attachment.size)}</Text> : null}

          <Text style={styles.label}>Refinement level</Text>
          <View style={styles.optionGrid}>
            {refinementOptions.map((option) => (
              <Pressable key={option.id} onPress={() => { setRefinementLevel(option.id); setReviewReady(option.id === "none"); }} style={[styles.option, refinementLevel === option.id ? styles.optionActive : null]}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </Pressable>
            ))}
          </View>
          {refinementLevel !== "none" ? <PrimaryButton label="Refine and review" onPress={() => void refineNote()} loading={working} /> : null}
          {reviewReady || refinementLevel === "none" || editingNoteId ? (
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
              <Text style={styles.subtitle}>{note.title}</Text>
              <Text style={styles.noteMeta}>{[note.subject, note.topic, note.status === "draft" ? "Draft" : "Published"].filter(Boolean).join(" · ")}</Text>
            </View>
            <Text style={styles.date}>{new Date(note.updatedAt).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.noteContent}>{note.content}</Text>
          {(note.illustrations ?? []).map((illustration, index) => (
            <View key={`${note.noteId}-illustration-${index}`} style={styles.illustration}>
              <Text style={styles.illustrationTitle}>◈ {illustration.title}</Text>
              <View style={styles.diagramRow}>
                {illustration.points.map((point) => <View key={point} style={styles.diagramPoint}><Text style={styles.diagramText}>{point}</Text></View>)}
              </View>
              <Text style={styles.caption}>{illustration.caption}</Text>
            </View>
          ))}
          {note.attachmentName && (isTeacher || note.studentAccess === "allow_download") ? <PrimaryButton label={`Download ${note.attachmentName}`} variant="secondary" onPress={() => void downloadAttachment(note)} compact /> : null}
          {note.attachmentName && !isTeacher && note.studentAccess === "read_only" ? <Text style={styles.readOnlyLabel}>Read Only · Download disabled by the teacher</Text> : null}
          {isTeacher ? (
            <View style={styles.actionRow}>
              <PrimaryButton label="Edit" variant="secondary" onPress={() => editNote(note)} style={styles.actionButton} compact />
              <PrimaryButton label="Delete" variant="ghost" onPress={() => removeNote(note)} style={styles.actionButton} compact />
            </View>
          ) : null}
        </View>
      ))}
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
  label: { color: palette.navy, fontWeight: "800", marginTop: 4 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: { flexGrow: 1, flexBasis: 180, borderWidth: 1, borderColor: "#CEDCE6", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12 },
  optionActive: { borderColor: palette.aqua, backgroundColor: "#EAFBF8" },
  optionTitle: { color: palette.navy, fontWeight: "900" },
  optionHint: { color: "#5D7484", fontSize: 12, lineHeight: 17, marginTop: 3 },
  attachmentMeta: { color: "#536B7B", fontSize: 12 },
  readOnlyLabel: { color: "#7A5C00", fontSize: 12, fontWeight: "800", backgroundColor: "#FFF7D6", borderRadius: 12, padding: 10 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { flexGrow: 1, flexBasis: 150 },
  noteCard: { borderWidth: 1, borderColor: "#DCE7EE", borderRadius: 20, padding: 16, gap: 12, backgroundColor: "#FFFFFF" },
  noteHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  noteHeaderText: { flex: 1 },
  noteMeta: { color: palette.aqua, fontSize: 12, fontWeight: "800", marginTop: 3 },
  date: { color: "#718696", fontSize: 12 },
  noteContent: { color: "#263E4D", fontSize: 15, lineHeight: 23 },
  illustration: { backgroundColor: "#EFF8FA", borderRadius: 16, padding: 14, gap: 10 },
  illustrationTitle: { color: palette.navy, fontWeight: "900", textAlign: "center" },
  diagramRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  diagramPoint: { backgroundColor: palette.aqua, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  diagramText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  caption: { color: "#506878", fontSize: 13, lineHeight: 18, textAlign: "center" },
});
