import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDateField } from "./CalendarDateField";
import { getSchoolAcademicPackages, updateSchoolAcademicPackages } from "../services/ai";
import { palette } from "../lib/theme";
import type { SchoolAcademicGrant, SchoolAcademicPackageCode, SchoolSummary } from "../types/app";

export function SchoolAcademicPackageEditor({ school }: { school: SchoolSummary }) {
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<Array<{ code: SchoolAcademicPackageCode; name: string; description: string }>>([]);
  const [grants, setGrants] = useState<SchoolAcademicGrant[]>([]);
  const [selected, setSelected] = useState<SchoolAcademicPackageCode[]>([]);
  const [startsAt, setStartsAt] = useState(new Date(school.licence.startAt).toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState(new Date(school.licence.endAt).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const response = await getSchoolAcademicPackages(school.schoolId);
        setPackages(response.packages);
        setGrants(response.grants);
        if (!response.grants.length) {
          setSelected(response.packages.map((entry) => entry.code));
          return;
        }
        const now = Date.now();
        const active = response.grants.filter((grant) => grant.status === "active" && new Date(grant.startsAt).getTime() <= now && (!grant.endsAt || new Date(grant.endsAt).getTime() > now));
        const hasLegacyCore = response.grants.some((grant) => (grant.featureCode as string) === "academic.core" && grant.status === "active");
        setSelected(hasLegacyCore ? response.packages.map((entry) => entry.code) : active.map((grant) => grant.featureCode));
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load academic packages."); }
    })();
  }, [open, school.schoolId]);

  function toggle(code: SchoolAcademicPackageCode) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function save() {
    if (!startsAt || !endsAt) { setError("Choose the academic package start and expiry dates."); return; }
    setBusy(true); setError("");
    try {
      const response = await updateSchoolAcademicPackages({ schoolId: school.schoolId, packages: selected, startsAt: `${startsAt}T00:00:00.000Z`, endsAt: `${endsAt}T23:59:59.999Z` });
      setGrants(response.grants);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update academic packages."); }
    finally { setBusy(false); }
  }

  return <View style={styles.wrap}>
    <Pressable style={styles.trigger} onPress={() => setOpen((value) => !value)}><Text style={styles.triggerText}>Academic packages</Text><Text style={styles.triggerText}>{open ? "▲" : "▼"}</Text></Pressable>
    {open ? <View style={styles.panel}>
      <Text style={styles.copy}>Select either package or both. Administration modules remain independently selectable.</Text>
      {packages.map((entry) => <Pressable key={entry.code} style={[styles.package, selected.includes(entry.code) && styles.packageActive]} onPress={() => toggle(entry.code)}>
        <Text style={selected.includes(entry.code) ? styles.packageActiveText : styles.packageText}>{selected.includes(entry.code) ? "✓ " : ""}{entry.name}</Text>
        <Text style={selected.includes(entry.code) ? styles.descriptionActive : styles.description}>{entry.description}</Text>
      </Pressable>)}
      <CalendarDateField label="Academic access starts" value={startsAt} onChange={setStartsAt}/>
      <CalendarDateField label="Academic access expires" value={endsAt} onChange={setEndsAt} minimumDate={startsAt}/>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy} style={styles.save} onPress={() => void save()}><Text style={styles.saveText}>{busy ? "Saving…" : "Save academic packages"}</Text></Pressable>
      {grants.length ? <Text style={styles.meta}>{selected.length} package(s) selected</Text> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 }, trigger: { borderWidth: 1, borderColor: palette.navy, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }, triggerText: { color: palette.navy, fontWeight: "900" }, panel: { backgroundColor: "#F5F9FB", padding: 12, borderRadius: 12, marginTop: 7 }, copy: { color: "#587180", lineHeight: 20, marginBottom: 8 }, package: { padding: 11, borderRadius: 10, backgroundColor: "white", marginBottom: 6 }, packageActive: { backgroundColor: palette.navy }, packageText: { color: palette.navy, fontWeight: "900" }, packageActiveText: { color: "white", fontWeight: "900" }, description: { color: "#587180", marginTop: 3 }, descriptionActive: { color: "#DCEEF2", marginTop: 3 }, save: { backgroundColor: palette.navy, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 8 }, saveText: { color: "white", fontWeight: "900" }, error: { color: "#B42318", fontWeight: "800", marginVertical: 7 }, meta: { color: "#667E8B", marginTop: 8 },
});
