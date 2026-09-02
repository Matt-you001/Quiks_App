import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { palette } from "../lib/theme";
import { MathText } from "./MathText";
import { cleanNoteText } from "../lib/lesson-note-text";
import { createSchoolClass, getSchoolClassDetails, linkSchoolClass, listSchoolClasses } from "../services/ai";
import type { SchoolMembership } from "../types/app";
import type { SchoolClassDetails, SchoolClassRecord } from "../types/school-classrooms";

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: .5 }]}><Text style={s.white}>{label}</Text></Pressable>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View><Text style={s.label}>{label}</Text><Pressable accessibilityRole="button" style={s.input} onPress={() => setOpen(true)}><Text>{options.find(o => o.id === value)?.name ?? "Select…"} ▾</Text></Pressable><Modal visible={open} transparent onRequestClose={() => setOpen(false)}><View style={s.overlay}><View style={s.card}><Text style={s.heading}>{label}</Text><ScrollView style={{ maxHeight: 360 }}>{options.map(o => <Pressable key={o.id} style={s.input} onPress={() => { onChange(o.id); setOpen(false); }}><Text>{o.name}</Text></Pressable>)}</ScrollView><Button label="Close" onPress={() => setOpen(false)}/></View></View></Modal></View>;
}
export function SchoolClassesPanel({ schoolId, memberships, variants, onResults }: { schoolId: string; memberships: SchoolMembership[]; variants: string[]; onResults: () => void }) {
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [name, setName] = useState(""); const [teacher, setTeacher] = useState("");
  const [variant, setVariant] = useState(variants[0] ?? "children");
  const [policy, setPolicy] = useState<"shared" | "teacher_generated">("shared");
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<SchoolClassDetails | null>(null);
  const [tab, setTab] = useState("Members"); const [expanded, setExpanded] = useState<string | null>(null);
  async function load() { setClasses((await listSchoolClasses(schoolId)).classes); }
  async function run(task: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete the classroom request."); } finally { setBusy(false); }
  }
  useEffect(() => { void run(load); }, [schoolId]);
  async function view(id: string) { setSelected(await getSchoolClassDetails(schoolId, id)); setExpanded(null); }
  const teachers = memberships.filter(m => m.role === "teacher" && m.status === "active");
  return <View style={s.stack}>
    <View style={s.card}><Text style={s.heading}>School classrooms</Text><Text>School-linked teachers' classes appear here automatically. Register a teacher's class code to confirm its link. Records stay shared with Classroom.</Text><Button label="Refresh classes" disabled={busy} onPress={() => void run(async () => { await load(); if (selected) await view(selected.classroom.classId); })}/></View>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}{busy && <ActivityIndicator color={palette.navy}/>}
    <View style={s.card}><Text style={s.heading}>Create a school class</Text>
      <TextInput accessibilityLabel="Class name" placeholder="Class name, e.g. JSS 1A" value={name} onChangeText={setName} style={s.input}/>
      <Select label="App variant" value={variant} options={variants.map(id => ({ id, name: `Quiks ${id}` }))} onChange={setVariant}/>
      <Select label="Assigned teacher" value={teacher} options={teachers.map(m => ({ id: m.membershipId, name: `${m.displayName} (${m.email})` }))} onChange={setTeacher}/>
      {!teachers.length && <Text>Enrol and approve a teacher under Members & invitations first.</Text>}
      <Select label="Class codes" value={policy} options={[{ id: "shared", name: "Same code for assigned teacher and students" }, { id: "teacher_generated", name: "Teacher generates a separate student code" }]} onChange={v => setPolicy(v as typeof policy)}/>
      <Button label="Create class" disabled={busy || !name.trim() || !teacher} onPress={() => void run(async () => { const result = await createSchoolClass({ schoolId, className: name, teacherMembershipId: teacher, appVariant: variant, codePolicy: policy }); setName(""); await load(); await view(result.classroom.classId); setMessage("Class created. Share its teacher code with the assigned teacher."); })}/>
    </View>
    <View style={s.card}><Text style={s.heading}>Register a teacher-created class</Text><TextInput accessibilityLabel="Teacher's class code" placeholder="Class code from the teacher" value={code} onChangeText={setCode} autoCapitalize="characters" style={s.input}/><Button label="Link class to school" disabled={busy || !code.trim()} onPress={() => void run(async () => { await linkSchoolClass(schoolId, code); setCode(""); await load(); setMessage("Class linked. Its records are available in the school portal."); })}/></View>
    {!busy && !classes.length && <Text>No school classrooms yet.</Text>}
    {classes.map(c => <View key={c.classId} style={s.card}><Text style={s.heading}>{c.className}</Text><Text>{c.appVariant} · {c.teacherName} · {c.awaitingTeacher ? "Awaiting teacher" : "Open"}</Text><Text>{c.studentCount} students · {c.activityCount} activities · {c.noteCount} lesson notes</Text><Button label="View classroom records" disabled={busy} onPress={() => void run(() => view(c.classId))}/></View>)}
    {selected && <Modal visible animationType="slide" onRequestClose={() => setSelected(null)}><ScrollView contentContainerStyle={{ padding: 20 }}><View style={s.card}><Button label="Close records" onPress={() => setSelected(null)}/><Text style={s.heading}>{selected.classroom.className} — records</Text><Text>Teacher: {selected.classroom.teacherName}</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text>{message}</Text> : null}
      {selected.classroom.teacherAccessCode && <View><Text selectable>Teacher code: {selected.classroom.teacherAccessCode}</Text><Button label="Copy teacher code" onPress={() => void run(async () => { await Clipboard.setStringAsync(selected.classroom.teacherAccessCode!); setMessage("Teacher code copied."); })}/></View>}
      <Text selectable>Student code: {selected.classroom.classCode ?? "Assigned teacher must generate it in Classroom"}</Text>
      {selected.classroom.classCode && <Button label="Copy student code" onPress={() => void run(async () => { await Clipboard.setStringAsync(selected.classroom.classCode!); setMessage("Student code copied."); })}/>}
      <View style={s.row}>{["Members", "Activities", "Notes", "Chat", "Results"].map(t => <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: tab === t }} style={[s.input, tab === t && s.active]} onPress={() => { setTab(t); setExpanded(null); }}><Text>{t}</Text></Pressable>)}</View>
      {tab === "Members" && <><Text>{selected.members.length} membership records</Text>{selected.members.map(m => <Text key={m.membershipId}>{m.name} · {m.role} · {m.status}</Text>)}</>}
      {tab === "Activities" && <><Text>{selected.activities.length} activities</Text>{selected.activities.map(a => <View key={a.id} style={s.record}><Text style={s.label}>{a.title}</Text><Text>{a.type} · {a.subjectName} · {a.questionCount} questions</Text><Button label={expanded === a.id ? "Hide questions" : "View questions"} onPress={() => setExpanded(expanded === a.id ? null : a.id)}/>{expanded === a.id && a.questions.map((q, i) => <View key={i} style={s.record}><MathText value={`${i + 1}. ${q.prompt}`}/>{q.options.map((option, j) => <MathText key={j} value={`${String.fromCharCode(65 + j)}. ${option}`}/>)}<MathText value={`Answer: ${q.answer}`}/><MathText value={q.explanation}/></View>)}</View>)}</>}
      {tab === "Notes" && <><Text>{selected.notes.length} lesson notes</Text>{selected.notes.map(n => <View key={n.noteId} style={s.record}><Text style={s.label}>{n.title || n.topic}</Text><Text>{n.subject} · {n.status}</Text><Button label={expanded === n.noteId ? "Close note" : "Read note"} onPress={() => setExpanded(expanded === n.noteId ? null : n.noteId)}/>{expanded === n.noteId && <><MathText value={cleanNoteText(n.content)}/>{(n.illustrations ?? []).map((ill, i) => <View key={i} style={[s.card, s.active]}><Text style={s.heading}>{ill.title}</Text>{ill.points.map((point, j) => <View key={j} style={s.record}><Text>{j + 1}. {cleanNoteText(point)}</Text>{j < ill.points.length - 1 && <Text>↓</Text>}</View>)}<Text>{ill.caption}</Text></View>)}</>}</View>)}</>}
      {tab === "Chat" && <><Text>{selected.messages.length} messages</Text>{selected.messages.map(m => <View key={m.messageId} style={s.record}><Text style={s.label}>{m.senderName} · {new Date(m.createdAt).toLocaleString()}</Text><Text>{m.text}</Text></View>)}</>}
      {tab === "Results" && <><Button label="Open school results & reports" onPress={onResults}/><Text>{selected.submissions.length} submissions · marks are client-reported, pending review</Text>{selected.submissions.map(r => <View key={r.submissionId} style={s.record}><Text>{r.studentName} · {selected.activities.find(a => a.id === r.activityId)?.title}</Text><Text>{r.score}% · {new Date(r.submittedAt).toLocaleString()}</Text></View>)}</>}
      <Button label="Close records" onPress={() => setSelected(null)}/>
    </View></ScrollView></Modal>}
  </View>;
}
const s = StyleSheet.create({ stack: { gap: 16 }, card: { backgroundColor: "white", borderRadius: 20, padding: 20, gap: 12 }, heading: { fontSize: 22, fontWeight: "800", color: palette.navy }, label: { fontWeight: "700", color: palette.navy }, input: { padding: 14, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, backgroundColor: "#F8FAFC", marginTop: 6 }, button: { padding: 13, borderRadius: 12, backgroundColor: palette.navy, alignItems: "center" }, white: { color: "white", fontWeight: "700" }, overlay: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0008" }, row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, active: { backgroundColor: "#CDECE8" }, record: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingVertical: 12, gap: 8 }, error: { color: "#B91C1C" } });
