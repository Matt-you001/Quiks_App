import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { palette } from "../lib/theme";
import { approveSchoolReport, createSchoolReport, editSchoolReport, exportSchoolReport, getSchoolReports, getSchoolReportTemplate, getSchoolResults, regenerateSchoolReportComment, sendSchoolReport, updateSchoolReportTemplate } from "../services/ai";
import type { SchoolMembership } from "../types/app";
import type { SchoolReport, SchoolReportTemplate, SchoolResultFilters, SchoolResultsResponse } from "../types/school-results";

const defaultReportTemplate: SchoolReportTemplate = {
  templateId: "classic", name: "Classic",
  heading: "Student Academic Report", accentColor: "#0E5C63",
  footerNote: "Please contact the school if you have questions about this report.",
  showClass: true, showStudentClass: true, showAdmissionNumber: true, showActivityType: false, showSubmittedDate: false,
  showCalculation: true, showTeacherComment: true, showSignatures: true, showAverage: true,
  orientation: "portrait", customFields: [], ratingSections: [],
};

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

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function resolveReportTemplateField(report: SchoolReport, field: SchoolReportTemplate["customFields"][number]) {
  if (field.source === "average") return `${report.average}%`;
  if (field.source === "studentName") return report.studentName;
  if (field.source === "class") return report.studentClassName ?? "";
  if (field.source === "admissionNumber") return report.studentAdmissionNumber ?? "";
  if (field.source === "reportTitle") return report.title;
  return report.customFieldValues?.[field.fieldId] ?? field.defaultValue;
}

function reportSheetHtml(report: SchoolReport) {
  const template = { ...defaultReportTemplate, ...report.template };
  const headers = ["Subject", "Activity", ...(template.showClass ? ["Class"] : []), ...(template.showActivityType ? ["Type"] : []), ...(template.showSubmittedDate ? ["Date"] : []), "Report mark"];
  const rows = report.rows.map((row) => `<tr><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.title)}</td>${template.showClass ? `<td>${escapeHtml(row.className)}</td>` : ""}${template.showActivityType ? `<td>${escapeHtml(row.type)}</td>` : ""}${template.showSubmittedDate ? `<td>${escapeHtml(new Date(row.submittedAt).toLocaleDateString())}</td>` : ""}<td>${escapeHtml(row.adjustedScore ?? row.score)}%</td></tr>`).join("");
  const customFields = template.customFields.length ? `<div class="additional-fields">${template.customFields.map((field) => `<div><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(resolveReportTemplateField(report, field) ?? "")}</div>`).join("")}</div>` : "";
  const ratingSections = template.ratingSections.map((section) => `<section class="ratings"><h3>${escapeHtml(section.title)}</h3><table><thead><tr><th>Rating</th><th>Assessment</th></tr></thead><tbody>${section.items.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(report.ratingValues?.[`${section.sectionId}:${item.itemId}`] ?? "Not rated")}</td></tr>`).join("")}</tbody></table></section>`).join("");
  const signature = (name: string | undefined, label: string) => `<div class="signature"><div class="line">${escapeHtml(name || "")}</div><strong>${escapeHtml(label)}</strong><div>Date: __________________</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>
    @page{size:A4 ${escapeHtml(template.orientation)};margin:18mm}:root{--accent:${escapeHtml(template.accentColor)}}body{font-family:Arial,sans-serif;color:#183c48;font-size:12px;border-top:7px solid var(--accent);padding-top:16px}h1,h2{text-align:center;margin:4px}h1{color:var(--accent)}.report-heading{text-transform:uppercase;letter-spacing:1px}.meta{text-align:center;margin:12px 0 22px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #8aa1aa;padding:8px;text-align:left}th{background:#eaf4f6;color:var(--accent)}.average{font-size:16px;font-weight:bold;color:var(--accent)}.additional-fields{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 28px;border:1px solid #8aa1aa;padding:12px;margin:16px 0}.ratings{break-inside:avoid}.ratings h3{color:var(--accent);margin-bottom:0}.ratings table{margin-top:8px}.comment{border:1px solid #8aa1aa;min-height:60px;padding:10px;line-height:1.5}.signatures{display:flex;gap:50px;margin-top:60px}.signature{flex:1;text-align:center}.line{border-bottom:1px solid #183c48;min-height:24px;margin-bottom:7px}.footer{margin-top:40px;text-align:center;color:#587180;font-size:10px}@media print{button{display:none}}
  </style></head><body><h1>${escapeHtml(report.schoolName)}</h1><h2 class="report-heading">${escapeHtml(template.heading)}</h2><h2>${escapeHtml(report.title)}</h2><div class="meta"><strong>Student:</strong> ${escapeHtml(report.studentName)}${template.showStudentClass && report.studentClassName ? ` &nbsp; <strong>Class:</strong> ${escapeHtml(report.studentClassName)}` : ""}${template.showAdmissionNumber && report.studentAdmissionNumber ? ` &nbsp; <strong>Admission No:</strong> ${escapeHtml(report.studentAdmissionNumber)}` : ""}</div>
  <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
  ${template.showAverage ? `<p class="average">Average: ${escapeHtml(report.average)}%</p>` : ""}${template.showCalculation ? `<p>${escapeHtml(report.calculation)}</p>` : ""}${customFields}${ratingSections}${template.showTeacherComment ? `<h3>Teacher's comment</h3><div class="comment">${escapeHtml(report.comment || "No additional comment.")}</div>` : ""}
  ${template.showSignatures ? `<div class="signatures">${signature(report.teacherName, "Class Teacher's signature")}${signature(report.principalName, "Principal / Head Teacher's signature")}</div>` : ""}${template.footerNote ? `<div class="footer">${escapeHtml(template.footerNote)}</div>` : ""}</body></html>`;
}

function TemplateToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.toggle}><Switch value={value} onValueChange={onChange}/><Text style={styles.copy}>{label}</Text></View>;
}

export function SchoolResultsPanel({ schoolId, memberships }: { schoolId: string; memberships: SchoolMembership[] }) {
  const [data, setData] = useState<SchoolResultsResponse | null>(null);
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [template, setTemplate] = useState<SchoolReportTemplate>(defaultReportTemplate);
  const [templates, setTemplates] = useState<SchoolReportTemplate[]>([defaultReportTemplate]);
  const [activeTemplateId, setActiveTemplateId] = useState(defaultReportTemplate.templateId);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const [filters, setFilters] = useState<SchoolResultFilters>({ attempts: "latest" });
  const [applied, setApplied] = useState<SchoolResultFilters>({ attempts: "latest" });
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<SchoolReport | null>(null);
  const [comment, setComment] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [recipientType, setRecipientType] = useState<"student" | "guardian">("student");
  const [marks, setMarks] = useState<Record<string, { score: string; reason: string }>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [ratingValues, setRatingValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false); const [reviewed, setReviewed] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const students = memberships.filter((member) => member.role === "student");
  const chooseReport = (report: SchoolReport) => {
    setSelected(report); setComment(report.comment); setTeacherName(report.teacherName ?? ""); setPrincipalName(report.principalName ?? "");
    setRecipientType(report.recipientType === "guardian" ? "guardian" : "student"); setDirty(false); setReviewed(false);
    setMarks(Object.fromEntries(report.rows.map((row) => [row.resultId, { score: row.adjustedScore == null ? "" : String(row.adjustedScore), reason: row.adjustmentReason ?? "" }])));
    setCustomFieldValues(report.customFieldValues ?? {}); setRatingValues(report.ratingValues ?? {});
  };
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to process school results."); }
    finally { setBusy(false); }
  }
  async function load(next = applied, page = 1) {
    const [register, saved, design] = await Promise.all([getSchoolResults(schoolId, next, page), getSchoolReports(schoolId), getSchoolReportTemplate(schoolId)]);
    const activeTemplate = design.templates.find((entry) => entry.templateId === design.activeTemplateId) ?? design.templates[0] ?? defaultReportTemplate;
    setData(register); setReports(saved.reports); setTemplates(design.templates); setActiveTemplateId(activeTemplate.templateId); setTemplate(activeTemplate); setApplied(next);
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
  async function printReport(report: SchoolReport) {
    await Print.printAsync({ html: reportSheetHtml(report) });
  }
  const editable = Boolean(selected && ["draft", "approved"].includes(selected.status));
  return <View style={styles.card}>
    <Text style={styles.heading}>School results register</Text><Text style={styles.copy}>Results appear here only after the class teacher submits an activity to the school portal. Latest attempt means the latest teacher-submitted attempt for each student and activity within the selected dates.</Text>
    <Text style={styles.warning}>Objective marks are calculated by the backend and written marks are supplied by the class teacher. Review them before issuing reports.</Text>
    <View style={styles.row}>
      <Choose label="Student" value={filters.studentMembershipId ?? ""} options={[{ id: "", name: "All students" }, ...students.map((member) => ({ id: member.membershipId, name: member.displayName }))]} onChange={(value) => setFilters({ ...filters, studentMembershipId: value })}/>
      <Choose label="Class" value={filters.classId ?? ""} options={[{ id: "", name: "All classes" }, ...data?.classes ?? []]} onChange={(value) => setFilters({ ...filters, classId: value })}/>
      <Choose label="Subject" value={filters.subject ?? ""} options={[{ id: "", name: "All subjects" }, ...(data?.subjects ?? []).map((name) => ({ id: name, name }))]} onChange={(value) => setFilters({ ...filters, subject: value })}/>
      <Choose label="Activity" value={filters.type ?? ""} options={[{ id: "", name: "Tests, assignments and exams" }, { id: "test", name: "Tests / CBT" }, { id: "assignment", name: "Assignments" }, { id: "exam", name: "Exams" }]} onChange={(value) => setFilters({ ...filters, type: value })}/>
      <Choose label="Variant" value={filters.appVariant ?? ""} options={[{ id: "", name: "All variants" }, { id: "children", name: "Quiks Children" }, { id: "teens", name: "Quiks Teens" }, { id: "uni", name: "Quiks Advance" }]} onChange={(value) => setFilters({ ...filters, appVariant: value })}/>
      <Choose label="Attempts" value={filters.attempts ?? "latest"} options={[{ id: "latest", name: "Latest per activity" }, { id: "all", name: "Every attempt" }]} onChange={(value) => setFilters({ ...filters, attempts: value as "latest" | "all" })}/>
      <View style={styles.filter}><Text style={styles.label}>From (optional)</Text><TextInput accessibilityLabel="Results from date" style={styles.input} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD"/></View>
      <View style={styles.filter}><Text style={styles.label}>To (optional)</Text><TextInput accessibilityLabel="Results to date" style={styles.input} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD"/></View>
    </View>
    <Button label="Apply filters / Refresh" disabled={busy} onPress={() => void run(() => load(buildFilters()))}/>
    {busy ? <ActivityIndicator accessibilityLabel="Loading school results" color={palette.navy}/> : null}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {data ? <><Text style={styles.label}>{data.total} matching submissions</Text>
      {data.students.map((student) => <Text key={student.studentMembershipId} style={styles.copy}>{student.studentName}: {student.count} activities/attempts · unweighted average {student.average}%</Text>)}
      {!data.rows.length ? <Text style={styles.copy}>No school-linked submissions match these filters yet.</Text> : data.rows.map((row) => <View key={row.resultId} style={styles.result}><Text style={styles.label}>{row.studentName} · {row.gradingStatus === "awaiting_marking" ? `${row.provisionalScore ?? row.score}% provisional` : `${row.score}%`}</Text><Text style={styles.copy}>{row.className} · {row.subject} · {row.title} · {row.type}</Text><Text style={styles.small}>{row.gradingStatus === "awaiting_marking" ? "Awaiting teacher marking · excluded from reports" : `Attempt ${row.attemptNumber}`} · {new Date(row.submittedAt).toLocaleString()} · {row.appVariant === "uni" ? "Quiks Advance" : row.appVariant === "teens" ? "Quiks Teens" : "Quiks Children"}</Text></View>)}
      <View style={styles.row}><Button label="Previous" disabled={busy || data.page <= 1} onPress={() => void run(() => load(applied, data.page - 1))}/><Text>Page {data.page}</Text><Button label="Next" disabled={busy || data.page * 50 >= data.total} onPress={() => void run(() => load(applied, data.page + 1))}/></View>
    </> : null}
    <Text style={styles.heading}>Prepare a student report</Text><Text style={styles.copy}>Select a student above and apply filters. Reports use the latest attempt per activity, even when the register shows every attempt. Creating a draft freezes its included results.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: templateOpen }} style={styles.designHeader} onPress={() => setTemplateOpen((current) => !current)}><Text style={styles.heading}>Report sheet design</Text><Text style={styles.heading}>{templateOpen ? "−" : "+"}</Text></Pressable>
    {templateOpen ? <View style={styles.designCard}>
      <Text style={styles.copy}>Choose a starting template, edit it to match your school, and save it as the active design. Each report keeps the design that was active when its draft was created.</Text>
      <Text style={styles.label}>Choose a template</Text>
      <View style={styles.templateGallery}>{templates.map((entry) => <Pressable key={entry.templateId} accessibilityRole="button" onPress={() => { setTemplate(entry); setTemplateMessage(""); }} style={[styles.templateChoice, template.templateId === entry.templateId && styles.templateChoiceActive, { borderTopColor: entry.accentColor }]}><Text style={styles.label}>{entry.name}</Text><Text style={styles.small}>{entry.heading}</Text>{activeTemplateId === entry.templateId ? <Text style={styles.activeTemplate}>Active</Text> : null}</Pressable>)}</View>
      <Text style={styles.label}>Template name</Text><TextInput style={styles.input} value={template.name} onChangeText={(name) => setTemplate({ ...template, name })} placeholder="Template name"/>
      <Text style={styles.label}>Report heading</Text><TextInput style={styles.input} value={template.heading} onChangeText={(heading) => setTemplate({ ...template, heading })} placeholder="Student Academic Report"/>
      <Text style={styles.label}>Accent colour</Text><TextInput style={styles.input} value={template.accentColor} onChangeText={(accentColor) => setTemplate({ ...template, accentColor })} autoCapitalize="characters" placeholder="#0E5C63"/>
      <Text style={styles.label}>Footer note</Text><TextInput style={[styles.input, { minHeight: 70 }]} multiline value={template.footerNote} onChangeText={(footerNote) => setTemplate({ ...template, footerNote })} placeholder="Optional message printed at the bottom"/>
      <Text style={styles.label}>Page orientation</Text><View style={styles.row}><Button label={template.orientation === "portrait" ? "✓ Portrait" : "Portrait"} onPress={() => setTemplate({ ...template, orientation: "portrait" })}/><Button label={template.orientation === "landscape" ? "✓ Landscape" : "Landscape"} onPress={() => setTemplate({ ...template, orientation: "landscape" })}/></View>
      <View style={styles.row}>
        <TemplateToggle label="Show class column" value={template.showClass} onChange={(showClass) => setTemplate({ ...template, showClass })}/>
        <TemplateToggle label="Show student's class" value={template.showStudentClass} onChange={(showStudentClass) => setTemplate({ ...template, showStudentClass })}/>
        <TemplateToggle label="Show admission number" value={template.showAdmissionNumber} onChange={(showAdmissionNumber) => setTemplate({ ...template, showAdmissionNumber })}/>
        <TemplateToggle label="Show activity type" value={template.showActivityType} onChange={(showActivityType) => setTemplate({ ...template, showActivityType })}/>
        <TemplateToggle label="Show submitted date" value={template.showSubmittedDate} onChange={(showSubmittedDate) => setTemplate({ ...template, showSubmittedDate })}/>
        <TemplateToggle label="Show calculation note" value={template.showCalculation} onChange={(showCalculation) => setTemplate({ ...template, showCalculation })}/>
        <TemplateToggle label="Show teacher's comment" value={template.showTeacherComment} onChange={(showTeacherComment) => setTemplate({ ...template, showTeacherComment })}/>
        <TemplateToggle label="Show signature fields" value={template.showSignatures} onChange={(showSignatures) => setTemplate({ ...template, showSignatures })}/>
        <TemplateToggle label="Show overall average" value={template.showAverage} onChange={(showAverage) => setTemplate({ ...template, showAverage })}/>
      </View>
      <Text style={styles.label}>Additional fields</Text><Text style={styles.small}>Automatic fields use information already in the report. Custom fields are completed separately for each student.</Text>
      {template.customFields.map((field, index) => <View key={field.fieldId} style={styles.configCard}>
        <TextInput style={styles.input} value={field.label} onChangeText={(label) => setTemplate({ ...template, customFields: template.customFields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, label } : entry) })} placeholder="Field label"/>
        <Choose label="Field value" value={field.source} options={[{ id: "custom", name: "Entered for each report" }, { id: "average", name: "Overall average" }, { id: "studentName", name: "Student name" }, { id: "class", name: "Class" }, { id: "admissionNumber", name: "Admission number" }, { id: "reportTitle", name: "Report title" }]} onChange={(source) => setTemplate({ ...template, customFields: template.customFields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, source: source as SchoolReportTemplate["customFields"][number]["source"] } : entry) })}/>
        {field.source === "custom" ? <TextInput style={styles.input} value={field.defaultValue} onChangeText={(defaultValue) => setTemplate({ ...template, customFields: template.customFields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, defaultValue } : entry) })} placeholder="Optional default value"/> : null}
        <Button label="Remove field" onPress={() => setTemplate({ ...template, customFields: template.customFields.filter((_, fieldIndex) => fieldIndex !== index) })}/>
      </View>)}
      <Button label="Add field" onPress={() => setTemplate({ ...template, customFields: [...template.customFields, { fieldId: `field-${Date.now()}`, label: "New field", source: "custom", defaultValue: "" }] })}/>
      <Text style={styles.label}>Rating sections</Text><Text style={styles.small}>Add sections such as attendance, punctuality and character ratings. Separate criteria and scale choices with commas.</Text>
      {template.ratingSections.map((section, index) => <View key={section.sectionId} style={styles.configCard}>
        <TextInput style={styles.input} value={section.title} onChangeText={(title) => setTemplate({ ...template, ratingSections: template.ratingSections.map((entry, sectionIndex) => sectionIndex === index ? { ...entry, title } : entry) })} placeholder="Section title"/>
        <TextInput style={styles.input} value={section.items.map((item) => item.label).join(", ")} onChangeText={(value) => { const labels = value.split(",").map((label) => label.trim()).filter(Boolean); setTemplate({ ...template, ratingSections: template.ratingSections.map((entry, sectionIndex) => sectionIndex === index ? { ...entry, items: labels.map((label, itemIndex) => ({ itemId: entry.items[itemIndex]?.itemId ?? `item-${Date.now()}-${itemIndex}`, label })) } : entry) }); }} placeholder="Attendance, Punctuality, Character"/>
        <TextInput style={styles.input} value={section.scale.join(", ")} onChangeText={(value) => setTemplate({ ...template, ratingSections: template.ratingSections.map((entry, sectionIndex) => sectionIndex === index ? { ...entry, scale: value.split(",").map((label) => label.trim()).filter(Boolean) } : entry) })} placeholder="Excellent, Very Good, Good, Fair, Needs Improvement"/>
        <Button label="Remove section" onPress={() => setTemplate({ ...template, ratingSections: template.ratingSections.filter((_, sectionIndex) => sectionIndex !== index) })}/>
      </View>)}
      <Button label="Add rating section" onPress={() => setTemplate({ ...template, ratingSections: [...template.ratingSections, { sectionId: `section-${Date.now()}`, title: "Student ratings", items: [{ itemId: `attendance-${Date.now()}`, label: "Attendance" }, { itemId: `punctuality-${Date.now()}`, label: "Punctuality" }, { itemId: `character-${Date.now()}`, label: "Character" }], scale: ["Excellent", "Very Good", "Good", "Fair", "Needs Improvement"] }] })}/>
      {!!templateMessage && <Text style={styles.success}>{templateMessage}</Text>}
      <Button label="Save and use this template" disabled={busy} onPress={() => void run(async () => { const saved = await updateSchoolReportTemplate(schoolId, template); const active = saved.templates.find((entry) => entry.templateId === saved.activeTemplateId) ?? saved.templates[0]; setTemplates(saved.templates); setActiveTemplateId(saved.activeTemplateId); if (active) setTemplate(active); setTemplateMessage("Template saved and selected for new reports."); })}/>
    </View> : null}
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
      {(selected.template?.customFields ?? []).length ? <View style={styles.configCard}><Text style={styles.heading}>Additional report fields</Text>{(selected.template?.customFields ?? []).map((field) => field.source === "custom" ? <View key={field.fieldId}><Text style={styles.label}>{field.label}</Text><TextInput accessibilityLabel={field.label} editable={editable && !busy} style={styles.input} value={customFieldValues[field.fieldId] ?? field.defaultValue} onChangeText={(value) => { setCustomFieldValues({ ...customFieldValues, [field.fieldId]: value }); setDirty(true); }} placeholder={`Enter ${field.label.toLowerCase()}`}/></View> : <Text key={field.fieldId} style={styles.copy}><Text style={styles.label}>{field.label}: </Text>{resolveReportTemplateField(selected, field)}</Text>)}</View> : null}
      {(selected.template?.ratingSections ?? []).map((section) => <View key={section.sectionId} style={styles.configCard}><Text style={styles.heading}>{section.title}</Text>{section.items.map((item) => { const ratingId = `${section.sectionId}:${item.itemId}`; const rating = ratingValues[ratingId] ?? ""; return editable ? <Choose key={item.itemId} label={item.label} value={rating} options={[{ id: "", name: "Select rating" }, ...section.scale.map((name) => ({ id: name, name }))]} onChange={(value) => { setRatingValues({ ...ratingValues, [ratingId]: value }); setDirty(true); }}/> : <Text key={item.itemId} style={styles.copy}><Text style={styles.label}>{item.label}: </Text>{rating || "Not rated"}</Text>; })}</View>)}
      <Text style={styles.label}>Teacher&apos;s comment</Text><Text style={styles.small}>Quiks drafts this comment from the included results. Review and edit it before approval.</Text>
      <TextInput accessibilityLabel="Teacher's comment" multiline editable={editable && !busy} value={comment} onChangeText={(value) => { setComment(value); setDirty(true); }} placeholder="Teacher's comment" style={[styles.input, { minHeight: 100 }]}/>
      {editable ? <Button label="Redraft comment with AI" disabled={busy} onPress={() => void run(async () => { const draft = await regenerateSchoolReportComment(schoolId, selected.reportId); setComment(draft.comment); setDirty(true); })}/> : null}
      <View style={styles.row}><View style={styles.filter}><Text style={styles.label}>Class Teacher</Text><TextInput accessibilityLabel="Class Teacher name" editable={editable && !busy} value={teacherName} onChangeText={(value) => { setTeacherName(value); setDirty(true); }} placeholder="Name printed above signature line" style={styles.input}/></View><View style={styles.filter}><Text style={styles.label}>Principal / Head Teacher</Text><TextInput accessibilityLabel="Principal or Head Teacher name" editable={editable && !busy} value={principalName} onChangeText={(value) => { setPrincipalName(value); setDirty(true); }} placeholder="Name printed above signature line" style={styles.input}/></View></View>
      {editable ? <Choose label="Email report to" value={recipientType} options={[{ id: "student", name: `Student — ${selected.studentEmail || selected.email}` }, ...((selected.guardianEmail || memberships.find((member) => member.membershipId === selected.studentMembershipId)?.profileData?.parentEmail) ? [{ id: "guardian", name: `Parent / guardian — ${selected.guardianEmail || memberships.find((member) => member.membershipId === selected.studentMembershipId)?.profileData?.parentEmail}` }] : [])]} onChange={(value) => { setRecipientType(value === "guardian" ? "guardian" : "student"); setDirty(true); }}/> : <Text style={styles.copy}>Shared with: {selected.recipientType === "guardian" ? "Parent / guardian" : "Student"} — {selected.email}</Text>}
      {dirty && <Text style={styles.warning}>Unsaved changes: save the draft before approving, exporting or selecting another report.</Text>}
      {editable && (
        <Button
          label="Save draft changes"
          disabled={busy}
          onPress={() => void run(() => acceptUpdate(() => editSchoolReport(schoolId, {
            reportId: selected.reportId,
            revision: selected.revision,
            comment,
            teacherName,
            principalName,
            recipientType,
            customFieldValues,
            ratingValues,
            adjustments: Object.entries(marks)
              .filter(([, mark]) => mark.score.trim() !== "")
              .map(([resultId, mark]) => ({ resultId, score: Number(mark.score), reason: mark.reason })),
          })))}
        />
      )}
      {selected.status === "draft" && <><View style={styles.row}><Switch accessibilityLabel="I have reviewed this report" value={reviewed} onValueChange={setReviewed}/><Text style={styles.copy}>I have reviewed the marks, corrections and recipient.</Text></View><Button label="Approve reviewed report" disabled={busy || dirty || !reviewed} onPress={() => void run(() => acceptUpdate(() => approveSchoolReport(schoolId, selected)))}/></>}
      <View style={styles.row}><Button label="Print / Save report sheet" disabled={busy || dirty} onPress={() => void run(() => printReport(selected))}/><Button label="Export CSV" disabled={busy || dirty} onPress={() => void run(() => download(selected))}/><Button label="Send report by email" disabled={busy || dirty || selected.status !== "approved"} onPress={() => setConfirmSend(true)}/></View>
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
  error: { color: "#B42318", fontWeight: "700" }, success: { color: "#067647", fontWeight: "700" }, warning: { backgroundColor: "#FFF5DF", color: "#694F10", padding: 12, borderRadius: 10, lineHeight: 20 },
  designHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  designCard: { borderWidth: 1, borderColor: "#B8D2D9", backgroundColor: "#F7FCFD", borderRadius: 16, padding: 14, gap: 10 },
  templateGallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  templateChoice: { flexGrow: 1, flexBasis: 160, minWidth: 140, borderWidth: 1, borderTopWidth: 6, borderColor: "#CDDDE4", borderRadius: 12, padding: 12, gap: 4, backgroundColor: "white" },
  templateChoiceActive: { backgroundColor: "#EAF6F8", borderColor: palette.navy },
  activeTemplate: { color: "#067647", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 210, flexGrow: 1, flexBasis: 210 },
  configCard: { borderWidth: 1, borderColor: "#D6E4E8", backgroundColor: "white", borderRadius: 14, padding: 12, gap: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", padding: 20 }, modal: { width: "100%", maxWidth: 540, backgroundColor: "white", borderRadius: 20, padding: 20, gap: 14 },
  option: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#DFE9ED" },
});
