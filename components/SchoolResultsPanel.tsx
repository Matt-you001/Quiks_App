import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { palette } from "../lib/theme";
import { approveSchoolReport, createSchoolReport, editSchoolReport, exportSchoolReport, getSchoolReports, getSchoolResults, sendSchoolReport } from "../services/ai";
import type { SchoolMembership } from "../types/app";
import type { SchoolReport, SchoolResultFilters, SchoolResultsResponse } from "../types/school-results";

function Choose({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; name: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <View style={styles.filter}><Text style={styles.label}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.input} onPress={() => setOpen(true)}><Text>{options.find((option) => option.id === value)?.name ?? "All"} ▾</Text></Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.heading}>{label}</Text><ScrollView style={{ maxHeight: 380 }}>{options.map((option) => <Pressable key={option.id} accessibilityRole="button" style={styles.option} onPress={() => { onChange(option.id); setOpen(false); }}><Text style={value === option.id ? styles.label : styles.copy}>{option.name}</Text></Pressable>)}</ScrollView><Button label="Close" onPress={() => setOpen(false)}/></View></View></Modal>
  </View>;
}
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: .45 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const statusLabel = (report: SchoolReport) => report.status === "sent" ? "Accepted by email provider" : report.status === "delivery_unknown" ? "Delivery uncertain — contact support before retrying" : report.status;

export function SchoolResultsPanel({ schoolId, memberships }: { schoolId: string; memberships: SchoolMembership[] }) {
  const [data, setData] = useState<SchoolResultsResponse | null>(null);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [filters, setFilters] = useState<SchoolResultFilters>({ attempts: "latest" });
  const [applied, setApplied] = useState<SchoolResultFilters>({ attempts: "latest" });
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<SchoolReport | null>(null);
  const [comment, setComment] = useState("");
  const [marks, setMarks] = useState<Record<string, { score: string; reason: string }>>({});
  const [dirty, setDirty] = useState(false); const [reviewed, setReviewed] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const students = memberships.filter((member) => member.role === "student");
  const chooseReport = (report: SchoolReport) => {
    setSelected(report); setComment(report.comment); setDirty(false); setReviewed(false);
    setMarks(Object.fromEntries(report.rows.map((row) => [row.resultId, { score: row.adjustedScore == null ? "" : String(row.adjustedScore), reason: row.adjustmentReason ?? "" }])));
  };
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to process school results."); }
    finally { setBusy(false); }
  }
  async function load(next = applied, page = 1) {
    const [register, saved] = await Promise.all([getSchoolResults(schoolId, next, page), getSchoolReports(schoolId)]);
    setData(register); setReports(saved.reports); setApplied(next);
  }
  useEffect(() => { void run(() => load({ attempts: "latest" })); }, [schoolId]); // The parent keys this component by school.
  function buildFilters() {
    const result: SchoolResultFilters = { ...filters };
    for (const [key, value] of [["from", from], ["to", to]] as const) {
      if (!value.trim()) continue;
      const date = new Date(`${value.trim()}T${key === "from" ? "00:00:00" : "23:59:59.999"}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim()) || !Number.isFinite(date.getTime())) throw new Error("Enter dates as YYYY-MM-DD.");
      result[key] = date.getTime();
    }
    if (result.from && result.to && result.from > result.to) throw new Error("The start date must not be after the end date.");
    return result;
  }
  async function acceptUpdate(action: () => Promise<{ report: SchoolReport }>) {
    const result = await action(); chooseReport(result.report);
    setReports((current) => [result.report, ...current.filter((report) => report.reportId !== result.report.reportId)]);
  }
  async function download(report: SchoolReport) {
    const exported = await exportSchoolReport(schoolId, report.reportId);
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob(["\uFEFF", exported.csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = exported.filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
      const path = `${FileSystem.cacheDirectory}${exported.filename}`;
      await FileSystem.writeAsStringAsync(path, exported.csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "Save school report" });
    }
  }
  const editable = Boolean(selected && ["draft", "approved"].includes(selected.status));
  return <View style={styles.card}>
    <Text style={styles.heading}>School results register</Text><Text style={styles.copy}>School-linked test and assignment submissions are collated here. Latest attempt means the latest submitted attempt for each student and activity within the selected dates.</Text>
    <Text style={styles.warning}>Scores currently originate from the classroom client. Review them before issuing reports; this is not yet a high-stakes CBT grading system.</Text>
    <View style={styles.row}>
      <Choose label="Student" value={filters.studentMembershipId ?? ""} options={[{ id: "", name: "All students" }, ...students.map((member) => ({ id: member.membershipId, name: member.displayName }))]} onChange={(value) => setFilters({ ...filters, studentMembershipId: value })}/>
      <Choose label="Class" value={filters.classId ?? ""} options={[{ id: "", name: "All classes" }, ...data?.classes ?? []]} onChange={(value) => setFilters({ ...filters, classId: value })}/>
      <Choose label="Subject" value={filters.subject ?? ""} options={[{ id: "", name: "All subjects" }, ...(data?.subjects ?? []).map((name) => ({ id: name, name }))]} onChange={(value) => setFilters({ ...filters, subject: value })}/>
      <Choose label="Activity" value={filters.type ?? ""} options={[{ id: "", name: "Tests and assignments" }, { id: "test", name: "Tests / CBT" }, { id: "assignment", name: "Assignments" }]} onChange={(value) => setFilters({ ...filters, type: value })}/>
      <Choose label="Variant" value={filters.appVariant ?? ""} options={[{ id: "", name: "All variants" }, ...["children", "teens", "uni"].map((id) => ({ id, name: id }))]} onChange={(value) => setFilters({ ...filters, appVariant: value })}/>
      <Choose label="Attempts" value={filters.attempts ?? "latest"} options={[{ id: "latest", name: "Latest per activity" }, { id: "all", name: "Every attempt" }]} onChange={(value) => setFilters({ ...filters, attempts: value as "latest" | "all" })}/>
      <View style={styles.filter}><Text style={styles.label}>From (optional)</Text><TextInput accessibilityLabel="Results from date" style={styles.input} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD"/></View>
      <View style={styles.filter}><Text style={styles.label}>To (optional)</Text><TextInput accessibilityLabel="Results to date" style={styles.input} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD"/></View>
    </View>
    <Button label="Apply filters / Refresh" disabled={busy} onPress={() => void run(() => load(buildFilters()))}/>
    {busy ? <ActivityIndicator accessibilityLabel="Loading school results" color={palette.navy}/> : null}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {data ? <><Text style={styles.label}>{data.total} matching submissions</Text>
      {data.students.map((student) => <Text key={student.studentMembershipId} style={styles.copy}>{student.studentName}: {student.count} activities/attempts · unweighted average {student.average}%</Text>)}
      {!data.rows.length ? <Text style={styles.copy}>No school-linked submissions match these filters yet.</Text> : data.rows.map((row) => <View key={row.resultId} style={styles.result}><Text style={styles.label}>{row.studentName} · {row.score}%</Text><Text style={styles.copy}>{row.className} · {row.subject} · {row.title} · {row.type}</Text><Text style={styles.small}>Attempt {row.attemptNumber} · {new Date(row.submittedAt).toLocaleString()} · {row.appVariant}</Text></View>)}
      <View style={styles.row}><Button label="Previous" disabled={busy || data.page <= 1} onPress={() => void run(() => load(applied, data.page - 1))}/><Text>Page {data.page}</Text><Button label="Next" disabled={busy || data.page * 50 >= data.total} onPress={() => void run(() => load(applied, data.page + 1))}/></View>
    </> : null}
    <Text style={styles.heading}>Prepare a student report</Text><Text style={styles.copy}>Select a student above and apply filters. Reports use the latest attempt per activity, even when the register shows every attempt. Creating a draft freezes its included results.</Text>
    <TextInput accessibilityLabel="Report title" style={styles.input} value={title} onChangeText={setTitle} placeholder="Report title — e.g. First Term 2026"/>
    <Button label="Create draft report" disabled={busy || !applied.studentMembershipId || !title.trim()} onPress={() => void run(() => acceptUpdate(() => createSchoolReport(schoolId, applied.studentMembershipId!, title, applied)))}/>
    <Text style={styles.heading}>Saved reports</Text>
    {!reports.length && <Text style={styles.copy}>No saved reports yet.</Text>}
    {reports.map((report) => <Pressable key={report.reportId} accessibilityRole="button" style={styles.result} onPress={() => { if (!busy && !dirty) chooseReport(report); }}><Text style={styles.label}>{report.studentName} — {report.title}</Text><Text style={styles.copy}>{statusLabel(report)} · {report.average}% · View report</Text></Pressable>)}
    {selected ? <View style={styles.preview}>
      <Text style={styles.heading}>{selected.title}</Text><Text style={styles.label}>{selected.studentName}</Text><Text style={styles.copy}>Recipient: {selected.email}</Text><Text style={styles.copy}>Status: {statusLabel(selected)}</Text>
      <Text style={styles.copy}>{selected.calculation}</Text>
      {selected.rows.map((row) => <View key={row.resultId} style={styles.result}><Text style={styles.label}>{row.subject} · {row.title}</Text><Text style={styles.copy}>Original: {row.score}% · Report mark: {row.adjustedScore ?? row.score}%</Text>
        {editable ? <><TextInput accessibilityLabel={`Adjusted mark for ${row.title}`} keyboardType="decimal-pad" style={styles.input} value={marks[row.resultId]?.score ?? ""} placeholder="Optional corrected percentage" onChangeText={(score) => { setMarks({ ...marks, [row.resultId]: { ...marks[row.resultId], score } }); setDirty(true); }}/><TextInput accessibilityLabel={`Adjustment reason for ${row.title}`} style={styles.input} value={marks[row.resultId]?.reason ?? ""} placeholder="Reason for correction (required if adjusted)" onChangeText={(reason) => { setMarks({ ...marks, [row.resultId]: { ...marks[row.resultId], reason } }); setDirty(true); }}/></> : row.adjustmentReason ? <Text style={styles.copy}>Correction reason: {row.adjustmentReason}</Text> : null}
      </View>)}
      <Text style={styles.label}>Unweighted average: {selected.average}%</Text>
      <TextInput accessibilityLabel="Administrator report comment" multiline editable={editable && !busy} value={comment} onChangeText={(value) => { setComment(value); setDirty(true); }} placeholder="Administrator's comment" style={[styles.input, { minHeight: 80 }]}/>
      {dirty && <Text style={styles.warning}>Unsaved changes: save the draft before approving, exporting or selecting another report.</Text>}
      {editable && <Button label="Save draft changes" disabled={busy} onPress={() => void run(() => acceptUpdate(() => editSchoolReport(schoolId, { reportId: selected.reportId, revision: selected.revision, comment, adjustments: Object.entries(marks).filter(([, mark]) => mark.score.trim() !== "").map(([resultId, mark]) => ({ resultId, score: Number(mark.score), reason: mark.reason })) })))}/>}
      {selected.status === "draft" && <><View style={styles.row}><Switch accessibilityLabel="I have reviewed this report" value={reviewed} onValueChange={setReviewed}/><Text style={styles.copy}>I have reviewed the marks, corrections and recipient.</Text></View><Button label="Approve reviewed report" disabled={busy || dirty || !reviewed} onPress={() => void run(() => acceptUpdate(() => approveSchoolReport(schoolId, selected)))}/></>}
      <View style={styles.row}><Button label="Export CSV" disabled={busy || dirty} onPress={() => void run(() => download(selected))}/><Button label="Send report by email" disabled={busy || dirty || selected.status !== "approved"} onPress={() => setConfirmSend(true)}/></View>
      {selected.delivery && <Text style={styles.copy}>Email: {selected.delivery.status === "sent" ? "Accepted by the email provider; inbox delivery is not confirmed." : selected.delivery.status === "not_configured" ? "Configure RESEND_API_KEY and QUIKS_SCHOOL_EMAIL_FROM on the backend." : selected.delivery.status === "unknown" || selected.delivery.status === "sending" ? "Contact support to check the provider log before sending another copy." : "Provider rejected the message. Check email settings, then retry."}</Text>}
      <Text style={styles.label}>Audit history</Text>{selected.audit.map((event, index) => <Text style={styles.small} key={index}>{event.action} · {event.name} · {new Date(event.at).toLocaleString()}</Text>)}
    </View> : null}
    <Modal transparent visible={confirmSend} animationType="fade" onRequestClose={() => setConfirmSend(false)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.heading}>Send this student's report?</Text><Text style={styles.copy}>{selected?.title} for {selected?.studentName} will be sent to {selected?.email}. Only this student's included results will be shared.</Text><Button label="Confirm and send" disabled={busy} onPress={() => { setConfirmSend(false); if (selected) void run(() => acceptUpdate(() => sendSchoolReport(schoolId, selected))); }}/><Button label="Cancel" onPress={() => setConfirmSend(false)}/></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", padding: 20, borderRadius: 24, gap: 12, minWidth: 0 },
  heading: { color: palette.navy, fontSize: 22, fontWeight: "900", marginTop: 12 }, label: { color: palette.navy, fontWeight: "800" },
  copy: { color: "#46616F", lineHeight: 21, flexShrink: 1 }, small: { color: "#587180", fontSize: 12, lineHeight: 18 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 }, filter: { flexGrow: 1, flexBasis: 190, minWidth: 140 },
  input: { borderWidth: 1, borderColor: "#CDDDE4", borderRadius: 12, padding: 12, marginTop: 6, color: palette.navy },
  button: { backgroundColor: palette.navy, borderRadius: 12, padding: 13, alignSelf: "flex-start" }, buttonText: { color: "white", fontWeight: "800" },
  result: { borderWidth: 1, borderColor: "#DFE9ED", borderRadius: 12, padding: 12, gap: 4 }, preview: { backgroundColor: "#F3F9FB", borderRadius: 18, padding: 16, gap: 12 },
  error: { color: "#B42318", fontWeight: "700" }, warning: { backgroundColor: "#FFF5DF", color: "#694F10", padding: 12, borderRadius: 10, lineHeight: 20 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", padding: 20 }, modal: { width: "100%", maxWidth: 540, backgroundColor: "white", borderRadius: 20, padding: 20, gap: 14 },
  option: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#DFE9ED" },
});
