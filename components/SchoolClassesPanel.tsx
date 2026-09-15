import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { palette } from "../lib/theme";
import { MathText } from "./MathText";
import { cleanNoteText } from "../lib/lesson-note-text";
import { createSchoolClass, getSchoolClassDetails, linkSchoolClass, listSchoolClasses, updateSchoolClassNaming } from "../services/ai";
import type { SchoolClassNaming, SchoolClassNamingMode, SchoolMembership } from "../types/app";
import type { SchoolClassDetails, SchoolClassRecord } from "../types/school-classrooms";

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: .5 }]}><Text style={s.white}>{label}</Text></Pressable>;
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View><Text style={s.label}>{label}</Text><Pressable accessibilityRole="button" style={s.input} onPress={() => setOpen(true)}><Text>{options.find(o => o.id === value)?.name ?? "Select…"} ▾</Text></Pressable><Modal visible={open} transparent onRequestClose={() => setOpen(false)}><View style={s.overlay}><View style={s.card}><Text style={s.heading}>{label}</Text><ScrollView style={{ maxHeight: 360 }}>{options.map(o => <Pressable key={o.id} style={s.input} onPress={() => { onChange(o.id); setOpen(false); }}><Text>{o.name}</Text></Pressable>)}</ScrollView><Button label="Close" onPress={() => setOpen(false)}/></View></View></Modal></View>;
}
const namingChoices = [
  { id: "grade", name: "Grade 1–12" }, { id: "primary_secondary", name: "Nursery, Primary, JSS and SS" },
  { id: "year", name: "Year 1–13" }, { id: "class", name: "Class 1–12" }, { id: "custom", name: "My school's custom names" },
];

const localDateKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const safeFilename = (value: string) => value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "class-results";
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function ClassResultsTable({ details }: { details: SchoolClassDetails }) {
  const [sortBy, setSortBy] = useState<"subject" | "date">("subject");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const students = details.members.filter(member => member.role === "student" && member.status === "active");
  const activityIds = new Set(details.results.map(result => result.activityId));
  const publishedAt = new Map<string, number>();
  details.results.forEach(result => publishedAt.set(result.activityId, Math.max(publishedAt.get(result.activityId) ?? 0, result.teacherSubmittedAt)));
  const allActivities = details.activities.filter(activity => activityIds.has(activity.id));
  const subjects = useMemo(() => [...new Set(allActivities.map(activity => activity.subjectName).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [details.activities, details.results]);
  const dates = useMemo(() => [...new Set(allActivities.map(activity => localDateKey(publishedAt.get(activity.id) ?? 0)))].filter(value => value !== localDateKey(0)).sort((a, b) => b.localeCompare(a)), [details.activities, details.results]);
  const activities = allActivities.filter(activity => sortBy === "subject" ? !subject || activity.subjectName === subject : !date || localDateKey(publishedAt.get(activity.id) ?? 0) === date).sort((a, b) => {
    if (sortBy === "subject") return a.subjectName.localeCompare(b.subjectName) || a.title.localeCompare(b.title) || (publishedAt.get(b.id) ?? 0) - (publishedAt.get(a.id) ?? 0);
    return (publishedAt.get(b.id) ?? 0) - (publishedAt.get(a.id) ?? 0) || a.title.localeCompare(b.title);
  });
  const latest = new Map<string, SchoolClassDetails["results"][number]>();
  details.results.forEach(result => {
    const key = `${result.studentMembershipId}:${result.activityId}`;
    const current = latest.get(key);
    if (!current || result.submittedAt > current.submittedAt || result.attemptNumber > current.attemptNumber) latest.set(key, result);
  });
  const classification = sortBy === "subject" ? (subject || "All subjects") : (date ? new Date(`${date}T12:00:00`).toLocaleDateString() : "All dates");
  const cellText = (studentId: string, activityId: string) => {
    const result = latest.get(`${studentId}:${activityId}`);
    return result ? `${result.score}% · Attempt ${result.attemptNumber} · ${new Date(result.submittedAt).toLocaleDateString()}` : "—";
  };
  const html = () => `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#123f49}h1{margin-bottom:4px}.meta{color:#52677a;margin-bottom:18px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #9fb7bf;padding:7px;text-align:left;vertical-align:top}th{background:#e8f5f3}.student{font-weight:700;min-width:120px}</style></head><body><h1>${escapeHtml(details.classroom.className)} results</h1><div class="meta">Sorted by ${escapeHtml(sortBy)} · ${escapeHtml(classification)} · Printed ${escapeHtml(new Date().toLocaleString())}</div><table><thead><tr><th>Student</th>${activities.map(activity => `<th>${escapeHtml(activity.title)}<br><small>${escapeHtml(activity.subjectName)} · ${escapeHtml(new Date(publishedAt.get(activity.id) ?? 0).toLocaleDateString())}</small></th>`).join("")}</tr></thead><tbody>${students.map(student => `<tr><td class="student">${escapeHtml(student.name)}</td>${activities.map(activity => `<td>${escapeHtml(cellText(student.membershipId, activity.id))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  async function runAction(action: () => Promise<void>) {
    if (working) return;
    setWorking(true); setActionError("");
    try { await action(); } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Unable to prepare this results table."); }
    finally { setWorking(false); }
  }
  async function exportCsv() {
    const rows = [
      ["Student", ...activities.map(activity => activity.title)],
      ["Subject", ...activities.map(activity => activity.subjectName)],
      ["Teacher submission date", ...activities.map(activity => new Date(publishedAt.get(activity.id) ?? 0).toLocaleDateString())],
      ...students.map(student => [student.name, ...activities.map(activity => cellText(student.membershipId, activity.id))]),
    ];
    const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`;
    const filename = `${safeFilename(details.classroom.className)}-${sortBy}-${safeFilename(classification)}.csv`;
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
    const path = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Save class results table" });
  }
  if (!allActivities.length) return <Text>No activity results have been submitted by the class teacher yet.</Text>;
  return <View style={s.stack}>
    <View style={s.row}>
      <View style={s.resultControl}><Select label="Sort by" value={sortBy} options={[{ id: "subject", name: "Subject" }, { id: "date", name: "Date" }]} onChange={value => setSortBy(value as "subject" | "date")}/></View>
      {sortBy === "subject" ? <View style={s.resultControl}><Select label="Subject" value={subject} options={[{ id: "", name: "All subjects" }, ...subjects.map(name => ({ id: name, name }))]} onChange={setSubject}/></View> : <View style={s.resultControl}><Select label="Date" value={date} options={[{ id: "", name: "All dates" }, ...dates.map(id => ({ id, name: new Date(`${id}T12:00:00`).toLocaleDateString() }))]} onChange={setDate}/></View>}
    </View>
    <Text style={s.tableMeta}>{activities.length} activity column{activities.length === 1 ? "" : "s"} · {classification}</Text>
    <View style={s.row}><Button label="Print table" disabled={working || !activities.length} onPress={() => void runAction(() => Print.printAsync({ html: html() }).then(() => undefined))}/><Button label="Export CSV" disabled={working || !activities.length} onPress={() => void runAction(exportCsv)}/>{working ? <ActivityIndicator color={palette.navy}/> : null}</View>
    {actionError ? <Text accessibilityRole="alert" style={s.error}>{actionError}</Text> : null}
    {!activities.length ? <Text>No submitted results match this {sortBy} selection.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={s.table}>
      <View style={s.tableRow}>
        <View style={[s.tableCell, s.nameCell, s.tableHeader]}><Text style={s.label}>Student</Text></View>
        {activities.map(activity => <View key={activity.id} style={[s.tableCell, s.activityCell, s.tableHeader]}><Text style={s.label}>{activity.title}</Text><Text style={s.tableMeta}>{activity.subjectName}</Text><Text style={s.tableMeta}>Submitted {new Date(publishedAt.get(activity.id) ?? 0).toLocaleDateString()}</Text></View>)}
      </View>
      {students.map(student => <View key={student.membershipId} style={s.tableRow}>
        <View style={[s.tableCell, s.nameCell]}><Text style={s.label}>{student.name}</Text></View>
        {activities.map(activity => {
          const result = latest.get(`${student.membershipId}:${activity.id}`);
          return <View key={activity.id} style={[s.tableCell, s.activityCell]}>{result ? <><Text style={s.score}>{result.score}%</Text><Text style={s.tableMeta}>Attempt {result.attemptNumber}</Text><Text style={s.tableMeta}>{new Date(result.submittedAt).toLocaleDateString()}</Text></> : <Text style={s.tableMeta}>—</Text>}</View>;
        })}
      </View>)}
      </View>
    </ScrollView>}
  </View>;
}

export function SchoolClassesPanel({ schoolId, memberships, variants, classNaming, onResults, onSchoolUpdated }: { schoolId: string; memberships: SchoolMembership[]; variants: string[]; classNaming: SchoolClassNaming; onResults: () => void; onSchoolUpdated?: () => void }) {
  const [classes, setClasses] = useState<SchoolClassRecord[]>([]);
  const [name, setName] = useState(""); const [teacher, setTeacher] = useState("");
  const [variant, setVariant] = useState(variants[0] ?? "children");
  const [policy, setPolicy] = useState<"shared" | "teacher_generated">("shared");
  const [code, setCode] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<SchoolClassDetails | null>(null);
  const [namingMode, setNamingMode] = useState<SchoolClassNamingMode>(classNaming.mode === "unconfigured" ? "grade" : classNaming.mode);
  const [customNamingLabel, setCustomNamingLabel] = useState(classNaming.mode === "custom" ? classNaming.label : "Class level");
  const [customNames, setCustomNames] = useState(classNaming.mode === "custom" ? classNaming.names.join(", ") : "");
  const [tab, setTab] = useState("Students"); const [expanded, setExpanded] = useState<string | null>(null);
  async function load() { setClasses((await listSchoolClasses(schoolId)).classes); }
  async function run(task: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete the classroom request."); } finally { setBusy(false); }
  }
  useEffect(() => { void run(load); }, [schoolId]);
  async function view(id: string, initialTab = "Students") { setSelected(await getSchoolClassDetails(schoolId, id)); setTab(initialTab); setExpanded(null); }
  const teachers = memberships.filter(m => m.role === "teacher" && m.status === "active");
  return <View style={s.stack}>
    <View style={s.card}><Text style={s.heading}>School classrooms</Text><Text>School-linked teachers' classes appear here automatically. Register a teacher's class code to confirm its link. Records stay shared with Classroom.</Text><Button label="Refresh classes" disabled={busy} onPress={() => void run(async () => { await load(); if (selected) await view(selected.classroom.classId); })}/></View>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}{busy && <ActivityIndicator color={palette.navy}/>}
    <View style={s.card}><Text style={s.heading}>Activity grade terminology</Text><Text>Choose the academic-level options teachers will use when setting school tests, assignments and exams. Teachers may still give their classrooms any name. Practice and Competition keep Quiks' general grade names.</Text>
      <Select label="Naming system" value={namingMode} options={namingChoices} onChange={value => setNamingMode(value as SchoolClassNamingMode)}/>
      {namingMode === "custom" ? <><TextInput accessibilityLabel="Custom level terminology" placeholder="Field name, e.g. Form or Stage" value={customNamingLabel} onChangeText={setCustomNamingLabel} style={s.input}/><TextInput accessibilityLabel="Custom academic levels" multiline placeholder="Enter options separated by commas, e.g. Form 1, Form 2, Form 3" value={customNames} onChangeText={setCustomNames} style={s.input}/></> : null}
      <Button label="Save activity grade options" disabled={busy || (namingMode === "custom" && (!customNamingLabel.trim() || !customNames.trim()))} onPress={() => void run(async () => {
        const names = namingMode === "custom" ? customNames.split(/[\n,]/).map(value => value.trim()).filter(Boolean) : [];
        const updated = await updateSchoolClassNaming({ schoolId, classNaming: { mode: namingMode, label: namingMode === "custom" ? customNamingLabel.trim() : namingChoices.find(item => item.id === namingMode)?.name ?? "Grade", names } });
        setNamingMode(updated.classNaming.mode); setMessage("Activity grade options saved."); onSchoolUpdated?.();
      })}/>
    </View>
    <View style={s.card}><Text style={s.heading}>Create a school class</Text>
      <TextInput accessibilityLabel="Class name" placeholder="Class name, e.g. Science Champions or JSS 1A" value={name} onChangeText={setName} style={s.input}/>
      <Select label="App variant" value={variant} options={variants.map(id => ({ id, name: id === "uni" ? "Quiks Advance" : id === "teens" ? "Quiks Teens" : "Quiks Children" }))} onChange={setVariant}/>
      <Select label="Assigned teacher" value={teacher} options={teachers.map(m => ({ id: m.membershipId, name: `${m.displayName} (${m.email})` }))} onChange={setTeacher}/>
      {!teachers.length && <Text>Enrol and approve a teacher under Members & invitations first.</Text>}
      <Select label="Class codes" value={policy} options={[{ id: "shared", name: "Same code for assigned teacher and students" }, { id: "teacher_generated", name: "Teacher generates a separate student code" }]} onChange={v => setPolicy(v as typeof policy)}/>
      <Button label="Create class" disabled={busy || !name.trim() || !teacher} onPress={() => void run(async () => { const result = await createSchoolClass({ schoolId, className: name, teacherMembershipId: teacher, appVariant: variant, codePolicy: policy }); setName(""); await load(); await view(result.classroom.classId); setMessage("Class created. Share its teacher code with the assigned teacher."); })}/>
    </View>
    <View style={s.card}><Text style={s.heading}>Register a teacher-created class</Text><TextInput accessibilityLabel="Teacher's class code" placeholder="Class code from the teacher" value={code} onChangeText={setCode} autoCapitalize="characters" style={s.input}/><Button label="Link class to school" disabled={busy || !code.trim()} onPress={() => void run(async () => { await linkSchoolClass(schoolId, code); setCode(""); await load(); setMessage("Class linked. Its records are available in the school portal."); })}/></View>
    {!busy && !classes.length && <Text>No school classrooms yet.</Text>}
    {classes.map(c => <View key={c.classId} style={s.card}><Text style={s.heading}>{c.className}</Text><Text>{c.appVariant === "uni" ? "Quiks Advance" : c.appVariant === "teens" ? "Quiks Teens" : "Quiks Children"} · {c.teacherName} · {c.awaitingTeacher ? "Awaiting teacher" : "Open"}</Text><Text>{c.studentCount} students · {c.activityCount} activities · {c.noteCount} lesson notes</Text><View style={s.row}><Button label="View students" disabled={busy} onPress={() => void run(() => view(c.classId, "Students"))}/><Button label="View results" disabled={busy} onPress={() => void run(() => view(c.classId, "Results"))}/></View></View>)}
    {selected && <Modal visible animationType="slide" onRequestClose={() => setSelected(null)}><ScrollView contentContainerStyle={{ padding: 20 }}><View style={s.card}><Button label="Close records" onPress={() => setSelected(null)}/><Text style={s.heading}>{selected.classroom.className} — records</Text><Text>Teacher: {selected.classroom.teacherName}</Text>
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}{message ? <Text>{message}</Text> : null}
      {selected.classroom.teacherAccessCode && <View><Text selectable>Teacher code: {selected.classroom.teacherAccessCode}</Text><Button label="Copy teacher code" onPress={() => void run(async () => { await Clipboard.setStringAsync(selected.classroom.teacherAccessCode!); setMessage("Teacher code copied."); })}/></View>}
      <Text selectable>Student code: {selected.classroom.classCode ?? "Assigned teacher must generate it in Classroom"}</Text>
      {selected.classroom.classCode && <Button label="Copy student code" onPress={() => void run(async () => { await Clipboard.setStringAsync(selected.classroom.classCode!); setMessage("Student code copied."); })}/>}
      <View style={s.row}>{["Students", "Activities", "Notes", "Chat", "Results"].map(t => <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: tab === t }} style={[s.input, tab === t && s.active]} onPress={() => { setTab(t); setExpanded(null); }}><Text>{t}</Text></Pressable>)}</View>
      {tab === "Students" && <><Text style={s.heading}>Students in this class</Text><Text>{selected.members.filter(m => m.role === "student" && m.status === "active").length} active students</Text>{selected.members.filter(m => m.role === "student").map(m => <View key={m.membershipId} style={s.record}><Text style={s.label}>{m.name}</Text><Text>{m.status === "active" ? "Active" : m.status}</Text></View>)}</>}
      {tab === "Activities" && <><Text>{selected.activities.length} activities</Text>{selected.activities.map(a => <View key={a.id} style={s.record}><Text style={s.label}>{a.title}</Text><Text>{a.type} · {a.subjectName} · {a.questionCount} questions</Text><Button label={expanded === a.id ? "Hide questions" : "View questions"} onPress={() => setExpanded(expanded === a.id ? null : a.id)}/>{expanded === a.id && a.questions.map((q, i) => <View key={i} style={s.record}><MathText value={`${i + 1}. ${q.prompt}`}/>{q.options.map((option, j) => <MathText key={j} value={`${String.fromCharCode(65 + j)}. ${option}`}/>)}<MathText value={`Answer: ${q.answer}`}/><MathText value={q.explanation}/></View>)}</View>)}</>}
      {tab === "Notes" && <><Text>{selected.notes.length} lesson notes</Text>{selected.notes.map(n => <View key={n.noteId} style={s.record}><Text style={s.label}>{n.title || n.topic}</Text><Text>{n.subject} · {n.status}</Text><Button label={expanded === n.noteId ? "Close note" : "Read note"} onPress={() => setExpanded(expanded === n.noteId ? null : n.noteId)}/>{expanded === n.noteId && <><MathText value={cleanNoteText(n.content)}/>{(n.illustrations ?? []).map((ill, i) => <View key={i} style={[s.card, s.active]}><Text style={s.heading}>{ill.title}</Text>{ill.imageDataBase64 ? <Image source={{ uri: `data:${ill.imageMimeType || "image/png"};base64,${ill.imageDataBase64}` }} accessibilityLabel={ill.imageAltText || ill.title} resizeMode="contain" style={s.lessonImage}/> : null}{ill.points.map((point, j) => <View key={j} style={s.record}><Text>{j + 1}. {cleanNoteText(point)}</Text>{j < ill.points.length - 1 && <Text>↓</Text>}</View>)}<Text>{ill.caption}</Text></View>)}</>}</View>)}</>}
      {tab === "Chat" && <><Text>{selected.messages.length} messages</Text>{selected.messages.map(m => <View key={m.messageId} style={s.record}><Text style={s.label}>{m.senderName} · {new Date(m.createdAt).toLocaleString()}</Text><Text>{m.text}</Text></View>)}</>}
      {tab === "Results" && <><Text style={s.heading}>Teacher-submitted class results</Text><Text>Only activity results explicitly submitted by the class teacher appear here. Each activity has its own column.</Text><ClassResultsTable details={selected}/><Button label="Open results register & reports" onPress={() => { setSelected(null); onResults(); }}/></>}
      <Button label="Close records" onPress={() => setSelected(null)}/>
    </View></ScrollView></Modal>}
  </View>;
}
const s = StyleSheet.create({ stack: { gap: 16 }, card: { backgroundColor: "white", borderRadius: 20, padding: 20, gap: 12 }, heading: { fontSize: 22, fontWeight: "800", color: palette.navy }, label: { fontWeight: "700", color: palette.navy }, input: { padding: 14, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, backgroundColor: "#F8FAFC", marginTop: 6 }, button: { padding: 13, borderRadius: 12, backgroundColor: palette.navy, alignItems: "center", minWidth: 150 }, white: { color: "white", fontWeight: "700" }, overlay: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0008" }, row: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, active: { backgroundColor: "#CDECE8" }, record: { borderTopWidth: 1, borderColor: "#E2E8F0", paddingVertical: 12, gap: 8 }, lessonImage: { width: "100%", height: 360, borderRadius: 14, backgroundColor: "#FFFFFF" }, error: { color: "#B91C1C" }, resultControl: { flexGrow: 1, flexBasis: 220, minWidth: 180 }, table: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, overflow: "hidden" }, tableRow: { flexDirection: "row" }, tableCell: { borderRightWidth: 1, borderBottomWidth: 1, borderColor: "#CBD5E1", padding: 10, justifyContent: "center" }, nameCell: { width: 180 }, activityCell: { width: 190 }, tableHeader: { backgroundColor: "#E8F5F3" }, tableMeta: { color: "#52677A", fontSize: 12, marginTop: 3 }, score: { color: palette.navy, fontWeight: "900", fontSize: 18 } });
