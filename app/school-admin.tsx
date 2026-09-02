import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { SchoolResultsPanel } from "../components/SchoolResultsPanel";
import { SchoolClassesPanel } from "../components/SchoolClassesPanel";
import { palette, shadows } from "../lib/theme";
import { getSchoolAdminDetails, getSchoolMemberships, inviteSchoolMember, updateSchoolMembershipStatus, updateSchoolProfileFields } from "../services/ai";
import type { SchoolDetailsResponse, SchoolMemberRole, SchoolProfileFieldDefinition, SchoolProfileFieldType } from "../types/app";

export default function SchoolAdminScreen() {
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<"overview" | "members" | "enrolment" | "results" | "classes">("overview");
  const [menuOpen, setMenuOpen] = useState(true);
  const params = useLocalSearchParams<{ schoolId?: string | string[] }>();
  const routeSchoolId = Array.isArray(params.schoolId) ? params.schoolId[0] : params.schoolId;
  const [activeSchoolId, setActiveSchoolId] = useState(routeSchoolId?.trim() ?? "");
  const [details, setDetails] = useState<SchoolDetailsResponse | null>(null);
  const [fields, setFields] = useState<SchoolProfileFieldDefinition[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SchoolMemberRole>("student");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{
    email: string;
    role: SchoolMemberRole;
    code: string;
    expiresAt: number;
    emailStatus: "sent" | "not_configured" | "failed";
  } | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const storageKey = "quiks:last-school-admin-id";

  const resolveSchoolId = useCallback(async () => {
    const fromRoute = routeSchoolId?.trim();
    if (fromRoute) return fromRoute;

    const remembered = (await AsyncStorage.getItem(storageKey))?.trim();
    if (remembered) return remembered;

    const memberships = (await getSchoolMemberships()).memberships;
    return memberships.find((membership) => membership.role === "school_admin" && membership.status === "active")?.schoolId ?? "";
  }, [routeSchoolId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resolvedSchoolId = await resolveSchoolId();
      if (!resolvedSchoolId) {
        throw new Error("No active school administration account was found. Return to School Control and select the school again.");
      }
      const data = await getSchoolAdminDetails(resolvedSchoolId);
      setActiveSchoolId(resolvedSchoolId);
      setDetails(data);
      setFields(data.profileFields);
      await AsyncStorage.setItem(storageKey, resolvedSchoolId);
    } catch (caught) {
      setDetails(null);
      setFields([]);
      setError(caught instanceof Error ? caught.message : "Unable to load school administration details.");
    } finally {
      setLoading(false);
    }
  }, [resolveSchoolId]);

  useEffect(() => { void load(); }, [load]);
  async function saveFields() { if (!activeSchoolId) return; try { await updateSchoolProfileFields({ schoolId: activeSchoolId, fields }); await load(); Alert.alert("Saved", "The enrolment form has been updated."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save fields."); } }
  function patchField(id: string, patch: Partial<SchoolProfileFieldDefinition>) { setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field)); }
  function addCustomField() { const label = customLabel.trim(); if (!label) return; setFields((current) => [...current, { id: `custom_${Date.now()}`, label, type: "text", enabled: true, required: false, roles: ["student", "teacher"] }]); setCustomLabel(""); }
  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (inviteBusy) return;
    setError("");
    setGeneratedInvite(null);
    if (!email.includes("@")) {
      setError("Enter a valid email address before generating the invitation code.");
      return;
    }
    setInviteBusy(true);
    try {
      if (!activeSchoolId) throw new Error("Reload the school before creating an invitation.");
      const result = await inviteSchoolMember({ schoolId: activeSchoolId, email, role: inviteRole });
      if (!result.invitationCode) throw new Error("The server did not return an invitation code. Deploy the latest backend and try again.");
      setGeneratedInvite({
        email,
        role: inviteRole,
        code: result.invitationCode,
        expiresAt: result.expiresAt,
        emailStatus: result.emailDelivery?.status ?? "not_configured",
      });
      setInviteEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to invite member.");
    } finally {
      setInviteBusy(false);
    }
  }
  async function setStatus(membershipId: string, status: "active" | "suspended") { if (!activeSchoolId) return; try { await updateSchoolMembershipStatus({ schoolId: activeSchoolId, membershipId, status }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update member."); } }
  return <AppBackground webContentWidth="wide">
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>SCHOOL ADMINISTRATION</Text>
          <Text style={styles.title}>{details?.school.name ?? "Quiks School"}</Text>
          <Text style={styles.light}>{loading ? "Loading…" : details ? `${details.school.studentCount} students · ${details.school.teacherCount} teachers · ${details.school.pendingCount} pending` : "School details unavailable"}</Text>
        </View>
        {details?.viewer ? <View style={styles.viewer}><Text style={styles.viewerName}>{details.viewer.displayName}</Text><Text style={styles.viewerRole}>{details.viewer.role === "app_owner" ? "Quiks App Owner" : "School Administrator"}</Text></View> : null}
      </View>
    </View>
    {loading ? <View style={styles.loadingCard}><ActivityIndicator color={palette.navy}/><Text style={styles.loadingText}>Restoring school administration details…</Text></View> : null}
    {!loading && error ? <View style={styles.errorCard}><Text style={styles.error}>{error}</Text><View style={styles.row}><Pressable style={styles.primaryCompact} onPress={() => void load()}><Text style={styles.primaryText}>Try again</Text></Pressable><Pressable style={styles.secondary} onPress={() => router.replace("/school" as never)}><Text style={styles.secondaryText}>Back to School Control</Text></Pressable></View></View> : null}
    {!loading && details ? <View style={[portalStyles.layout, { flexDirection: width >= 900 ? "row" : "column" }]}>
      <View style={[portalStyles.sidebar, width >= 900 && { width: menuOpen ? 230 : 90 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Toggle school menu" accessibilityState={{ expanded: menuOpen }} style={portalStyles.menuButton} onPress={() => setMenuOpen(!menuOpen)}><Text style={styles.primaryText}>{menuOpen ? "☰  Collapse menu" : "☰ Menu"}</Text></Pressable>
        {menuOpen && ([{ id: "overview", label: "Overview" }, { id: "classes", label: "Classes & records" }, { id: "members", label: "Members & invitations" }, { id: "enrolment", label: "Enrolment form" }, { id: "results", label: "Results & reports" }] as const).map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: section === item.id }} style={[portalStyles.navItem, section === item.id && portalStyles.navSelected]} onPress={() => { setSection(item.id); if (width < 900) setMenuOpen(false); }}><Text style={section === item.id ? styles.primaryText : styles.secondaryText}>{item.label}</Text></Pressable>)}
      </View>
      <View style={portalStyles.content}>
      {section === "overview" && <View style={styles.card}><Text style={styles.heading}>School overview</Text><Text style={styles.copy}>{details.school.studentCount} students · {details.school.teacherCount} teachers · {details.school.adminCount} administrators</Text><Text style={styles.copy}>{details.school.pendingCount} enrolments awaiting approval</Text><Text style={styles.copy}>Licence: {details.school.status} · ends {new Date(details.school.licence.endAt).toLocaleDateString()}</Text><Text style={styles.copy}>Use the menu to manage enrolment, or review and collate results submitted in this school's classrooms.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={() => setSection("results")}><Text style={styles.primaryText}>Open results & reports</Text></Pressable></View>}
      {section === "results" && <SchoolResultsPanel key={activeSchoolId} schoolId={activeSchoolId} memberships={details.memberships}/>}
      {section === "classes" && <SchoolClassesPanel key={activeSchoolId} schoolId={activeSchoolId} memberships={details.memberships} variants={details.school.licence.allowedVariants} onResults={() => setSection("results")}/>}
      <View style={[styles.card, section !== "enrolment" && portalStyles.hidden]}><Text style={styles.heading}>Enrolment profile form</Text><Text style={styles.copy}>Open only the fields your school needs. Required fields must be completed before an enrolment can be submitted.</Text>
        {fields.map((field) => <View key={field.id} style={styles.fieldRow}><View style={styles.flex}><TextInput value={field.label} editable={!field.system} onChangeText={(label) => patchField(field.id, { label })} style={styles.compactInput}/><Text style={styles.meta}>{field.roles.join(" & ")} · {field.type}</Text></View><View style={styles.switchBlock}><Text style={styles.meta}>Open</Text><Switch value={field.enabled} onValueChange={(enabled) => patchField(field.id, { enabled, required: enabled ? field.required : false })}/></View><View style={styles.switchBlock}><Text style={styles.meta}>Required</Text><Switch disabled={!field.enabled} value={field.required} onValueChange={(required) => patchField(field.id, { required })}/></View></View>)}
        <View style={styles.row}><TextInput value={customLabel} onChangeText={setCustomLabel} placeholder="New custom field" style={[styles.input, styles.flex]}/><Pressable style={styles.secondary} onPress={addCustomField}><Text style={styles.secondaryText}>Add field</Text></Pressable></View><Pressable style={styles.primary} onPress={saveFields}><Text style={styles.primaryText}>Save profile form</Text></Pressable>
      </View>
      <View style={[styles.card, section !== "members" && portalStyles.hidden]}><Text style={styles.heading}>{details?.school.enrolmentMode === "individual_codes" ? "Generate an individual enrolment code" : "Invite staff or students"}</Text><Text style={styles.copy}>{details?.school.enrolmentMode === "individual_codes" ? "Enter one person's email and role. Each code is unique, can only be used by that email address, and enrols the person without a separate approval step." : "You may invite a person directly, or allow them to apply with the shared school code for your approval."}</Text><TextInput value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" style={styles.input}/><View style={styles.row}>{(["student", "teacher", "school_admin"] as SchoolMemberRole[]).map((role) => <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.role, inviteRole === role && styles.roleActive]}><Text style={inviteRole === role ? styles.primaryText : styles.secondaryText}>{role.replace("school_", "")}</Text></Pressable>)}</View><Pressable disabled={inviteBusy} style={[styles.primary, inviteBusy && styles.disabled]} onPress={sendInvite}><Text style={styles.primaryText}>{inviteBusy ? "Generating…" : details?.school.enrolmentMode === "individual_codes" ? "Generate unique code" : "Create invitation"}</Text></Pressable>
        {generatedInvite ? <View style={styles.inviteResult}>
          <Text style={styles.inviteResultTitle}>Invitation code created</Text>
          <Text style={styles.inviteCode}>{generatedInvite.code}</Text>
          <Text style={styles.inviteMeta}>{generatedInvite.email} · {generatedInvite.role.replace("school_", " ")} · expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}</Text>
          <Text style={styles.inviteDelivery}>{generatedInvite.emailStatus === "sent" ? "The code was also sent to the email address." : generatedInvite.emailStatus === "failed" ? "The code was created, but email delivery failed. Copy and share it manually." : "Automatic email is not configured yet. Copy and share the code manually."}</Text>
          <Pressable style={styles.copyButton} onPress={() => void Clipboard.setStringAsync(generatedInvite.code)}><Text style={styles.copyButtonText}>Copy code</Text></Pressable>
        </View> : null}
        <Text style={[styles.heading, { marginTop: 24 }]}>Members</Text>{details?.memberships.map((member) => <View key={member.membershipId} style={styles.member}><View style={styles.flex}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.meta}>{member.email} · {member.role.replace("_", " ")} · {member.status}</Text></View>{member.status === "pending" || member.status === "invited" ? <Pressable style={styles.small} onPress={() => setStatus(member.membershipId, "active")}><Text style={styles.primaryText}>Approve</Text></Pressable> : member.status === "active" && member.role !== "school_admin" ? <Pressable style={styles.danger} onPress={() => setStatus(member.membershipId, "suspended")}><Text style={styles.dangerText}>Suspend</Text></Pressable> : null}</View>)}</View>
      </View>
    </View> : null}
  </AppBackground>;
}
const portalStyles = StyleSheet.create({ layout: { gap: 16, alignItems: "stretch" }, sidebar: { backgroundColor: "white", padding: 12, borderRadius: 20, gap: 8, alignSelf: "flex-start" }, content: { flex: 1, minWidth: 0 }, menuButton: { backgroundColor: palette.navy, padding: 12, borderRadius: 12 }, navItem: { padding: 14, borderRadius: 12 }, navSelected: { backgroundColor: palette.navy }, hidden: { display: "none" } });
const styles = StyleSheet.create({ hero: { backgroundColor: palette.navy, borderRadius: 26, padding: 24, marginBottom: 16 }, heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }, viewer: { alignItems: "flex-end", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }, viewerName: { color: "white", fontWeight: "900", fontSize: 16 }, viewerRole: { color: "#70E2D8", fontWeight: "800", marginTop: 3 }, eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 1.5 }, title: { color: "white", fontSize: 30, fontWeight: "900", marginTop: 7 }, light: { color: "#D8E8EE", marginTop: 7, fontSize: 16 }, loadingCard: { backgroundColor: "white", borderRadius: 18, padding: 20, alignItems: "center", gap: 10, ...shadows.card }, loadingText: { color: "#587180", fontWeight: "700" }, errorCard: { backgroundColor: "#FFF0EE", borderRadius: 18, padding: 18, marginBottom: 12 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 }, card: { flexGrow: 1, flexBasis: 450, backgroundColor: "white", borderRadius: 24, padding: 20, ...shadows.card }, heading: { color: palette.navy, fontSize: 21, fontWeight: "900", marginBottom: 8 }, copy: { color: "#587180", lineHeight: 21, marginBottom: 10 }, fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomColor: "#E4ECF1", borderBottomWidth: 1 }, flex: { flex: 1 }, compactInput: { color: palette.navy, fontWeight: "800", paddingVertical: 4 }, meta: { color: "#667E8B", fontSize: 12, textTransform: "capitalize" }, switchBlock: { alignItems: "center" }, input: { borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 13, padding: 13, marginVertical: 8 }, row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }, primary: { backgroundColor: palette.navy, borderRadius: 14, padding: 14, alignItems: "center", marginTop: 10 }, primaryCompact: { backgroundColor: palette.navy, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 13 }, disabled: { opacity: 0.55 }, primaryText: { color: "white", fontWeight: "900", textTransform: "capitalize" }, secondary: { borderWidth: 1, borderColor: palette.navy, padding: 13, borderRadius: 13 }, secondaryText: { color: palette.navy, fontWeight: "800", textTransform: "capitalize" }, role: { flex: 1, minWidth: 90, backgroundColor: "#EDF3F6", borderRadius: 12, padding: 11, alignItems: "center" }, roleActive: { backgroundColor: palette.navy }, inviteResult: { marginTop: 12, borderRadius: 15, padding: 14, backgroundColor: "#E9F8F2", borderWidth: 1, borderColor: "#81C9AF" }, inviteResultTitle: { color: "#125C45", fontWeight: "900" }, inviteCode: { color: palette.navy, fontWeight: "900", fontSize: 25, letterSpacing: 2, marginTop: 8 }, inviteMeta: { color: "#41695D", marginTop: 7, lineHeight: 19 }, inviteDelivery: { color: "#41695D", marginTop: 7, lineHeight: 19, fontWeight: "700" }, copyButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#125C45", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, marginTop: 10 }, copyButtonText: { color: "#125C45", fontWeight: "900" }, member: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderTopColor: "#E4ECF1", borderTopWidth: 1 }, memberName: { color: palette.navy, fontWeight: "900" }, small: { backgroundColor: palette.navy, padding: 9, borderRadius: 10 }, danger: { backgroundColor: "#FFF0EE", padding: 9, borderRadius: 10 }, dangerText: { color: "#B42318", fontWeight: "800" }, error: { color: "#B42318", fontWeight: "700", marginBottom: 12 } });
