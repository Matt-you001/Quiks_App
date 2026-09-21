import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  amendSchoolAttendance,
  archiveSchoolAdministrationPerson,
  createSchoolAdministrationPerson,
  createSchoolLessonPlan,
  createSchoolStaffReport,
  createSchoolTimetable,
  createSchoolTimetableEntry,
  createSchoolTransportRoute,
  createSchoolTransportAssignment,
  createSchoolVehicle,
  exportSchoolAdministrationData,
  getSchoolAttendanceDetails,
  getSchoolAdministrationSummary,
  submitSchoolAttendance,
  updateSchoolAdministrationSettings,
} from "../services/ai";
import { palette, shadows } from "../lib/theme";
import type { SchoolAdministrationModuleCode, SchoolAdministrationSettings, SchoolAdministrationSummary, SchoolMembership } from "../types/app";

type Tab = "settings" | "registry" | "attendance" | "planning" | "staff" | "transport" | "audit";
const collectionLabels: Record<keyof SchoolAdministrationSettings["collectionSettings"], string> = {
  studentPhotograph: "Student photographs",
  staffPhotograph: "Staff photographs",
  birthCertificate: "Birth certificates",
  identityDocument: "Identity documents",
  medicalDocument: "Medical documents",
};

export function SchoolAdministrationPanel({ schoolId, memberships }: { schoolId: string; memberships: SchoolMembership[] }) {
  const [data, setData] = useState<SchoolAdministrationSummary | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<SchoolAdministrationSettings | null>(null);
  const [routePrices, setRoutePrices] = useState<Record<string, string>>({});
  const [personType, setPersonType] = useState<"student" | "staff" | "guardian">("student");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [routeName, setRouteName] = useState("");
  const [routePrice, setRoutePrice] = useState("");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [assignmentRouteId, setAssignmentRouteId] = useState("");
  const [assignmentVehicleId, setAssignmentVehicleId] = useState("");
  const [assignmentPersonId, setAssignmentPersonId] = useState("");
  const [assignmentStartsOn, setAssignmentStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent" | "late" | "excused">>({});
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState<Array<{ personId: string; givenName: string; familyName: string; status: "present" | "absent" | "late" | "excused"; note: string | null }>>([]);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planSubject, setPlanSubject] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [timetableName, setTimetableName] = useState("");
  const [timetableType, setTimetableType] = useState<"lesson" | "exam">("lesson");
  const [timetableId, setTimetableId] = useState("");
  const [entryTitle, setEntryTitle] = useState("");
  const [entrySubject, setEntrySubject] = useState("");
  const [entryStartsAt, setEntryStartsAt] = useState("");
  const [entryEndsAt, setEntryEndsAt] = useState("");
  const [staffPersonId, setStaffPersonId] = useState("");
  const [reportType, setReportType] = useState("General report");
  const [reportNotes, setReportNotes] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await getSchoolAdministrationSummary(schoolId);
      setData(next);
      setSettings(next.settings);
      setRoutePrices(Object.fromEntries(next.routes.map((route) => [route.id, route.priceMinor === null ? "" : String(route.priceMinor / 100)])));
      setAttendance((current) => Object.fromEntries(next.people.filter((person) => person.personType === "student" && person.status === "active").map((person) => [person.id, current[person.id] ?? "present"])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load school administration.");
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);
  const active = useMemo(() => new Set(data?.activeModules ?? []), [data]);
  const foundationActive = active.has("operations.foundation");
  const schoolAdminMembership = memberships.find((membership) => membership.role === "school_admin" && membership.status === "active");
  const teacherMembership = memberships.find((membership) => membership.role === "teacher" && membership.status === "active") ?? schoolAdminMembership;

  async function perform(operation: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { await operation(); await load(); Alert.alert("Saved", success); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save this school record."); }
    finally { setBusy(false); }
  }

  async function saveSettings() {
    if (!settings) return;
    const uniformMinor = settings.uniformRoutePriceMinor;
    const prices = Object.fromEntries(Object.entries(routePrices).map(([id, value]) => [id, Math.round(Number(value) * 100)]));
    await perform(() => updateSchoolAdministrationSettings({ ...settings, schoolId, uniformRoutePriceMinor: uniformMinor, routePrices: prices }), "School information and transport settings were updated.");
  }

  async function downloadSchoolExport() {
    const exported = await exportSchoolAdministrationData(schoolId);
    if (typeof document !== "undefined") {
      const url = URL.createObjectURL(new Blob([exported.content], { type: "application/json;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = exported.filename; anchor.click(); URL.revokeObjectURL(url);
      return;
    }
    if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
    const path = `${FileSystem.cacheDirectory}${exported.filename}`;
    await FileSystem.writeAsStringAsync(path, exported.content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Save school data export" });
  }

  async function openAttendanceSession(sessionId: string) {
    setBusy(true); setError("");
    try {
      const result = await getSchoolAttendanceDetails({ schoolId, sessionId });
      setAttendanceSessionId(sessionId);
      setAttendanceHistory(result.records);
      setAmendmentReason("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load attendance records."); }
    finally { setBusy(false); }
  }

  const tabs: Array<{ id: Tab; label: string; module?: SchoolAdministrationModuleCode }> = [
    { id: "settings", label: "Set-up" }, { id: "registry", label: "Registry" },
    { id: "attendance", label: "Attendance", module: "operations.attendance" },
    { id: "planning", label: "Planning", module: "operations.planning" },
    { id: "staff", label: "Staff", module: "operations.staff" },
    { id: "transport", label: "Transport", module: "operations.transport" },
    { id: "audit", label: "Audit" },
  ];

  if (!data && !error) return <View style={styles.card}><Text style={styles.copy}>Loading administration modules…</Text></View>;
  return <View style={styles.wrap}>
    <View style={styles.card}>
      <Text style={styles.heading}>Quiks School Administration</Text>
      <Text style={styles.copy}>A separate modular licence controls these operational tools. Academic features and their licence remain independent.</Text>
      <View style={styles.moduleRow}>{data?.modules.map((module) => <View key={module.code} style={[styles.badge, active.has(module.code) ? styles.badgeActive : styles.badgeLocked]}><Text style={active.has(module.code) ? styles.badgeActiveText : styles.badgeLockedText}>{module.name}: {active.has(module.code) ? "Active" : "Not included"}</Text></View>)}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!foundationActive ? <Text style={styles.locked}>Operations Foundation is not active for this school. The Quiks App Owner must issue an administration module licence.</Text> : null}
    </View>
    {foundationActive ? <>
      <View style={styles.tabRow}>{tabs.map((item) => <Pressable key={item.id} disabled={Boolean(item.module && !active.has(item.module))} style={[styles.tab, tab === item.id && styles.tabActive, item.module && !active.has(item.module) && styles.disabled]} onPress={() => setTab(item.id)}><Text style={tab === item.id ? styles.tabActiveText : styles.tabText}>{item.label}</Text></Pressable>)}</View>

      {tab === "settings" && settings ? <View style={styles.card}>
        <Text style={styles.heading}>Information and documents</Text><Text style={styles.copy}>The school decides which optional records it collects. Enabling a category does not make it compulsory; required fields are still controlled through the enrolment form.</Text>
        {(Object.keys(collectionLabels) as Array<keyof typeof collectionLabels>).map((key) => <View key={key} style={styles.settingRow}><Text style={styles.label}>{collectionLabels[key]}</Text><Switch value={settings.collectionSettings[key]} onValueChange={(value) => setSettings({ ...settings, collectionSettings: { ...settings.collectionSettings, [key]: value } })}/></View>)}
        <Pressable disabled={busy} style={styles.primary} onPress={() => void saveSettings()}><Text style={styles.primaryText}>Save collection settings</Text></Pressable>
        {data?.viewer.role === "school_admin" ? <Pressable disabled={busy} style={styles.secondary} onPress={() => void perform(downloadSchoolExport, "The school data export is ready.")}><Text style={styles.choiceText}>Export all school data</Text></Pressable> : null}
      </View> : null}

      {tab === "registry" ? <View style={styles.card}>
        <Text style={styles.heading}>Student, staff and guardian registry</Text>
        <View style={styles.row}>{(["student", "staff", "guardian"] as const).map((type) => <Pressable key={type} style={[styles.choice, personType === type && styles.choiceActive]} onPress={() => setPersonType(type)}><Text style={personType === type ? styles.primaryText : styles.choiceText}>{type}</Text></Pressable>)}</View>
        <View style={styles.row}><TextInput style={[styles.input, styles.flex]} value={givenName} onChangeText={setGivenName} placeholder="Given name"/><TextInput style={[styles.input, styles.flex]} value={familyName} onChangeText={setFamilyName} placeholder="Family name"/></View>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email address (optional)" autoCapitalize="none"/>
        {personType !== "guardian" ? <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier} placeholder={personType === "student" ? "Admission number" : "Employee number"}/> : null}
        <Pressable disabled={busy} style={styles.primary} onPress={() => void perform(async () => { await createSchoolAdministrationPerson({ schoolId, personType, givenName, familyName, email, identifier }); setGivenName(""); setFamilyName(""); setEmail(""); setIdentifier(""); }, "The record was added to the school registry.")}><Text style={styles.primaryText}>Register {personType}</Text></Pressable>
        <Text style={styles.subheading}>Registered people</Text>{data?.people.filter((person) => person.status !== "archived").map((person) => <View key={person.id} style={styles.listRow}><View style={styles.flex}><Text style={styles.label}>{person.givenName} {person.familyName}</Text><Text style={styles.meta}>{person.personType} · {person.email || "No email"}</Text></View>{data.viewer.role === "school_owner" ? <Pressable style={styles.danger} onPress={() => Alert.alert("Archive record?", "The record will remain available for audit and recovery.", [{ text: "Cancel" }, { text: "Archive", style: "destructive", onPress: () => void perform(() => archiveSchoolAdministrationPerson({ schoolId, personId: person.id }), "The record was archived.") }])}><Text style={styles.dangerText}>Archive</Text></Pressable> : null}</View>)}</View> : null}

      {tab === "attendance" ? <View style={styles.card}>
        <Text style={styles.heading}>Attendance</Text><TextInput style={styles.input} value={attendanceDate} onChangeText={setAttendanceDate} placeholder="YYYY-MM-DD"/>
        {data?.people.filter((person) => person.personType === "student" && person.status === "active").map((person) => <View key={person.id} style={styles.listRow}><Text style={[styles.label, styles.flex]}>{person.givenName} {person.familyName}</Text><View style={styles.statusRow}>{(["present", "absent", "late", "excused"] as const).map((status) => <Pressable key={status} style={[styles.status, attendance[person.id] === status && styles.statusActive]} onPress={() => setAttendance({ ...attendance, [person.id]: status })}><Text style={attendance[person.id] === status ? styles.primaryText : styles.meta}>{status[0].toUpperCase()}</Text></Pressable>)}</View></View>)}
        <Pressable disabled={busy || !Object.keys(attendance).length} style={styles.primary} onPress={() => void perform(() => submitSchoolAttendance({ schoolId, date: attendanceDate, records: Object.entries(attendance).map(([personId, status]) => ({ personId, status })) }), "Attendance was submitted and added to the audit trail.")}><Text style={styles.primaryText}>Submit attendance</Text></Pressable>
        <Text style={styles.subheading}>Submitted attendance</Text>
        {data?.attendanceSessions.map((session) => <Pressable key={session.id} style={[styles.choice, attendanceSessionId === session.id && styles.choiceActive]} onPress={() => void openAttendanceSession(session.id)}><Text style={attendanceSessionId === session.id ? styles.primaryText : styles.choiceText}>{session.attendanceDate} · {session.sessionLabel} · {session.recordCount} records</Text></Pressable>)}
        {attendanceHistory.length ? <><TextInput style={[styles.input, styles.multiline]} multiline value={amendmentReason} onChangeText={setAmendmentReason} placeholder="Reason for changing submitted attendance"/>{attendanceHistory.map((record) => <View key={record.personId} style={styles.listRow}><Text style={[styles.label, styles.flex]}>{record.givenName} {record.familyName}</Text><View style={styles.statusRow}>{(["present", "absent", "late", "excused"] as const).map((status) => <Pressable key={status} disabled={busy || status === record.status || amendmentReason.trim().length < 3} style={[styles.status, status === record.status && styles.statusActive]} onPress={() => void perform(async () => { await amendSchoolAttendance({ schoolId, sessionId: attendanceSessionId, personId: record.personId, status, reason: amendmentReason }); await openAttendanceSession(attendanceSessionId); }, "Attendance was amended and the change was audited.")}><Text style={status === record.status ? styles.primaryText : styles.meta}>{status[0].toUpperCase()}</Text></Pressable>)}</View></View>)}</> : null}
      </View> : null}

      {tab === "planning" ? <View style={styles.card}><Text style={styles.heading}>Lesson planner</Text><TextInput style={styles.input} value={planSubject} onChangeText={setPlanSubject} placeholder="Subject"/><TextInput style={styles.input} value={planTitle} onChangeText={setPlanTitle} placeholder="Lesson title"/><TextInput style={[styles.input, styles.multiline]} multiline value={planNotes} onChangeText={setPlanNotes} placeholder="Objectives, resources and lesson sequence"/><Pressable disabled={busy || !teacherMembership} style={styles.primary} onPress={() => void perform(async () => { await createSchoolLessonPlan({ schoolId, teacherMembershipId: teacherMembership!.membershipId, subject: planSubject, title: planTitle, notes: planNotes }); setPlanSubject(""); setPlanTitle(""); setPlanNotes(""); }, "The lesson plan was saved as a draft.")}><Text style={styles.primaryText}>Save lesson plan</Text></Pressable>{data?.lessonPlans.map((plan) => <View key={plan.id} style={styles.listRow}><Text style={styles.label}>{plan.subject}: {plan.title}</Text><Text style={styles.meta}>{plan.status}</Text></View>)}
        <Text style={styles.subheading}>Lesson and exam timetables</Text><View style={styles.row}>{(["lesson", "exam"] as const).map((type) => <Pressable key={type} style={[styles.choice, timetableType === type && styles.choiceActive]} onPress={() => setTimetableType(type)}><Text style={timetableType === type ? styles.primaryText : styles.choiceText}>{type}</Text></Pressable>)}</View><TextInput style={styles.input} value={timetableName} onChangeText={setTimetableName} placeholder="Timetable name"/><Pressable disabled={busy || !timetableName.trim()} style={styles.primary} onPress={() => void perform(async () => { await createSchoolTimetable({ schoolId, name: timetableName, timetableType }); setTimetableName(""); }, "The timetable was created.")}><Text style={styles.primaryText}>Create timetable</Text></Pressable>
        {data?.timetables.map((item) => <Pressable key={item.id} style={[styles.choice, timetableId === item.id && styles.choiceActive]} onPress={() => setTimetableId(item.id)}><Text style={timetableId === item.id ? styles.primaryText : styles.choiceText}>{item.name} · {item.timetableType}</Text></Pressable>)}
        {timetableId ? <><Text style={styles.subheading}>Add timetable entry</Text><TextInput style={styles.input} value={entryTitle} onChangeText={setEntryTitle} placeholder="Lesson or exam title"/><TextInput style={styles.input} value={entrySubject} onChangeText={setEntrySubject} placeholder="Subject (optional)"/><TextInput style={styles.input} value={entryStartsAt} onChangeText={setEntryStartsAt} placeholder="Starts, e.g. 2026-09-22T09:00:00+01:00"/><TextInput style={styles.input} value={entryEndsAt} onChangeText={setEntryEndsAt} placeholder="Ends, e.g. 2026-09-22T10:00:00+01:00"/><Pressable disabled={busy} style={styles.primary} onPress={() => void perform(async () => { await createSchoolTimetableEntry({ schoolId, timetableId, title: entryTitle, subject: entrySubject, startsAt: entryStartsAt, endsAt: entryEndsAt }); setEntryTitle(""); setEntrySubject(""); setEntryStartsAt(""); setEntryEndsAt(""); }, "The timetable entry was added.")}><Text style={styles.primaryText}>Add timetable entry</Text></Pressable>{data?.timetableEntries.filter((entry) => entry.timetableId === timetableId).map((entry) => <View key={entry.id} style={styles.listRow}><View><Text style={styles.label}>{entry.title}</Text><Text style={styles.meta}>{entry.subject || "General"} · {new Date(entry.startsAt).toLocaleString()}</Text></View></View>)}</> : null}
      </View> : null}

      {tab === "staff" ? <View style={styles.card}><Text style={styles.heading}>Staff reporting</Text><Text style={styles.copy}>Choose a registered staff member and create an access-restricted report.</Text>{data?.people.filter((person) => person.personType === "staff" && person.status === "active").map((person) => <Pressable key={person.id} style={[styles.choice, staffPersonId === person.id && styles.choiceActive]} onPress={() => setStaffPersonId(person.id)}><Text style={staffPersonId === person.id ? styles.primaryText : styles.choiceText}>{person.givenName} {person.familyName}</Text></Pressable>)}<TextInput style={styles.input} value={reportType} onChangeText={setReportType} placeholder="Report type"/><TextInput style={[styles.input, styles.multiline]} multiline value={reportNotes} onChangeText={setReportNotes} placeholder="Report details"/><Pressable disabled={busy || !staffPersonId || !schoolAdminMembership} style={styles.primary} onPress={() => void perform(async () => { await createSchoolStaffReport({ schoolId, staffPersonId, authorMembershipId: schoolAdminMembership!.membershipId, reportType, notes: reportNotes }); setReportNotes(""); }, "The restricted staff report was saved.")}><Text style={styles.primaryText}>Save staff report</Text></Pressable><Text style={styles.subheading}>Restricted reports</Text>{data?.staffReports.map((report) => <View key={report.id} style={styles.listRow}><Text style={styles.label}>{report.reportType}</Text><Text style={styles.meta}>{new Date(report.createdAt).toLocaleDateString()}</Text></View>)}</View> : null}

      {tab === "transport" && settings ? <View style={styles.card}><Text style={styles.heading}>School transport</Text><Text style={styles.copy}>Choose one price for every route or require an individual price for each route.</Text><View style={styles.row}>{(["uniform", "varying"] as const).map((mode) => <Pressable key={mode} style={[styles.choice, settings.transportPricingMode === mode && styles.choiceActive]} onPress={() => setSettings({ ...settings, transportPricingMode: mode })}><Text style={settings.transportPricingMode === mode ? styles.primaryText : styles.choiceText}>{mode} price</Text></Pressable>)}</View><TextInput style={styles.input} value={settings.currency} onChangeText={(currency) => setSettings({ ...settings, currency: currency.toUpperCase().slice(0, 3) })} placeholder="Currency e.g. NGN"/>
        {settings.transportPricingMode === "uniform" ? <TextInput style={styles.input} keyboardType="decimal-pad" value={settings.uniformRoutePriceMinor === null ? "" : String(settings.uniformRoutePriceMinor / 100)} onChangeText={(value) => setSettings({ ...settings, uniformRoutePriceMinor: value === "" ? null : Math.round(Number(value) * 100) })} placeholder="Uniform price for every route"/> : data?.routes.map((route) => <View key={route.id} style={styles.row}><Text style={[styles.label, styles.flex]}>{route.name}</Text><TextInput style={styles.priceInput} keyboardType="decimal-pad" value={routePrices[route.id] ?? ""} onChangeText={(value) => setRoutePrices({ ...routePrices, [route.id]: value })} placeholder="Price"/></View>)}
        <Pressable disabled={busy} style={styles.secondary} onPress={() => void saveSettings()}><Text style={styles.choiceText}>Save pricing policy</Text></Pressable><Text style={styles.subheading}>Create route</Text><TextInput style={styles.input} value={routeName} onChangeText={setRouteName} placeholder="Route name"/>{settings.transportPricingMode === "varying" ? <TextInput style={styles.input} keyboardType="decimal-pad" value={routePrice} onChangeText={setRoutePrice} placeholder={`Route price (${settings.currency})`}/> : null}<Pressable disabled={busy} style={styles.primary} onPress={() => void perform(async () => { await createSchoolTransportRoute({ schoolId, name: routeName, priceMinor: settings.transportPricingMode === "varying" ? Math.round(Number(routePrice) * 100) : undefined }); setRouteName(""); setRoutePrice(""); }, "The transport route was created.")}><Text style={styles.primaryText}>Create route</Text></Pressable>{data?.routes.map((route) => <View key={route.id} style={styles.listRow}><Text style={styles.label}>{route.name}</Text><Text style={styles.meta}>{route.currency} {route.priceMinor === null ? "—" : (route.priceMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></View>)}
        <Text style={styles.subheading}>Vehicles</Text><TextInput style={styles.input} value={vehicleRegistration} onChangeText={setVehicleRegistration} placeholder="Vehicle registration number"/><TextInput style={styles.input} keyboardType="number-pad" value={vehicleCapacity} onChangeText={setVehicleCapacity} placeholder="Passenger capacity"/><Pressable disabled={busy} style={styles.primary} onPress={() => void perform(async () => { await createSchoolVehicle({ schoolId, registrationNumber: vehicleRegistration, capacity: Number(vehicleCapacity) }); setVehicleRegistration(""); setVehicleCapacity(""); }, "The vehicle was registered.")}><Text style={styles.primaryText}>Register vehicle</Text></Pressable>{data?.vehicles.map((vehicle) => <View key={vehicle.id} style={styles.listRow}><Text style={styles.label}>{vehicle.registrationNumber}</Text><Text style={styles.meta}>Capacity {vehicle.capacity ?? "—"}</Text></View>)}
        <Text style={styles.subheading}>Passenger assignment</Text><Text style={styles.copy}>Select a route, optional vehicle and registered student or staff member.</Text>{data?.routes.map((route) => <Pressable key={route.id} style={[styles.choice, assignmentRouteId === route.id && styles.choiceActive]} onPress={() => setAssignmentRouteId(route.id)}><Text style={assignmentRouteId === route.id ? styles.primaryText : styles.choiceText}>{route.name}</Text></Pressable>)}{data?.vehicles.map((vehicle) => <Pressable key={vehicle.id} style={[styles.choice, assignmentVehicleId === vehicle.id && styles.choiceActive]} onPress={() => setAssignmentVehicleId(vehicle.id)}><Text style={assignmentVehicleId === vehicle.id ? styles.primaryText : styles.choiceText}>{vehicle.registrationNumber}</Text></Pressable>)}{data?.people.filter((person) => person.status === "active" && person.personType !== "guardian").map((person) => <Pressable key={person.id} style={[styles.choice, assignmentPersonId === person.id && styles.choiceActive]} onPress={() => setAssignmentPersonId(person.id)}><Text style={assignmentPersonId === person.id ? styles.primaryText : styles.choiceText}>{person.givenName} {person.familyName}</Text></Pressable>)}<TextInput style={styles.input} value={assignmentStartsOn} onChangeText={setAssignmentStartsOn} placeholder="Starts YYYY-MM-DD"/><Pressable disabled={busy || !assignmentRouteId || !assignmentPersonId} style={styles.primary} onPress={() => void perform(() => createSchoolTransportAssignment({ schoolId, routeId: assignmentRouteId, vehicleId: assignmentVehicleId || undefined, personId: assignmentPersonId, startsOn: assignmentStartsOn }), "The passenger was assigned to the route.")}><Text style={styles.primaryText}>Assign passenger</Text></Pressable>{data?.transportAssignments.map((assignment) => { const person = data.people.find((item) => item.id === assignment.personId); return <View key={assignment.id} style={styles.listRow}><Text style={styles.label}>{person ? `${person.givenName} ${person.familyName}` : "Passenger"}</Text><Text style={styles.meta}>{assignment.routeName} · {assignment.registrationNumber || "No vehicle"}</Text></View>; })}
      </View> : null}

      {tab === "audit" ? <View style={styles.card}><Text style={styles.heading}>Recent administrator activity</Text>{data?.recentAudit.map((event) => <View key={event.id} style={styles.listRow}><View><Text style={styles.label}>{event.action.replaceAll(".", " ")}</Text><Text style={styles.meta}>{new Date(event.occurredAt).toLocaleString()} · {event.entityType}</Text></View></View>)}</View> : null}
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 }, card: { backgroundColor: "white", borderRadius: 22, padding: 20, ...shadows.card },
  heading: { color: palette.navy, fontWeight: "900", fontSize: 21, marginBottom: 8 }, subheading: { color: palette.navy, fontWeight: "900", fontSize: 17, marginTop: 20, marginBottom: 6 },
  copy: { color: "#587180", lineHeight: 21, marginBottom: 10 }, error: { color: "#B42318", fontWeight: "800", marginTop: 10 }, locked: { color: "#8A4B08", backgroundColor: "#FFF5E5", padding: 13, borderRadius: 12, fontWeight: "800", marginTop: 10 },
  moduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, badge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 }, badgeActive: { backgroundColor: "#DDF5EB" }, badgeLocked: { backgroundColor: "#EDF1F4" }, badgeActiveText: { color: "#116149", fontWeight: "800", fontSize: 12 }, badgeLockedText: { color: "#667E8B", fontWeight: "800", fontSize: 12 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, tab: { backgroundColor: "white", borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 }, tabActive: { backgroundColor: palette.navy }, tabText: { color: palette.navy, fontWeight: "800" }, tabActiveText: { color: "white", fontWeight: "900" }, disabled: { opacity: 0.4 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#E5EDF1" }, label: { color: palette.navy, fontWeight: "800" }, meta: { color: "#667E8B", fontSize: 12, textTransform: "capitalize" },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }, flex: { flex: 1, minWidth: 130 }, input: { borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 13, padding: 13, marginVertical: 6, color: palette.navy }, multiline: { minHeight: 100, textAlignVertical: "top" }, priceInput: { width: 150, borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 12, padding: 11 },
  choice: { backgroundColor: "#EDF3F6", borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, marginVertical: 4 }, choiceActive: { backgroundColor: palette.navy }, choiceText: { color: palette.navy, fontWeight: "800", textTransform: "capitalize" },
  primary: { backgroundColor: palette.navy, borderRadius: 13, padding: 14, alignItems: "center", marginTop: 10 }, primaryText: { color: "white", fontWeight: "900", textTransform: "capitalize" }, secondary: { borderWidth: 1, borderColor: palette.navy, borderRadius: 13, padding: 13, alignItems: "center", marginTop: 10 },
  listRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "#E5EDF1", paddingVertical: 11 }, danger: { backgroundColor: "#FFF0EE", padding: 9, borderRadius: 9 }, dangerText: { color: "#B42318", fontWeight: "800" }, statusRow: { flexDirection: "row", gap: 4 }, status: { width: 33, height: 33, borderRadius: 9, backgroundColor: "#EDF3F6", alignItems: "center", justifyContent: "center" }, statusActive: { backgroundColor: palette.navy },
});
