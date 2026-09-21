import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarDateField } from "./CalendarDateField";
import { getSchoolAdministrationModules, updateSchoolAdministrationModules } from "../services/ai";
import { palette } from "../lib/theme";
import type { SchoolAdministrationModuleCode, SchoolAdministrationGrant } from "../types/app";

export function SchoolAdministrationLicenceEditor({ schoolId }: { schoolId: string }) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<Array<{ code: SchoolAdministrationModuleCode; name: string }>>([]);
  const [grants, setGrants] = useState<SchoolAdministrationGrant[]>([]);
  const [selected, setSelected] = useState<SchoolAdministrationModuleCode[]>([]);
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const response = await getSchoolAdministrationModules(schoolId);
        setModules(response.modules);
        setGrants(response.grants);
        const now = Date.now();
        const activeGrants = response.grants.filter((grant) => grant.status === "active" && new Date(grant.startsAt).getTime() <= now && (!grant.endsAt || new Date(grant.endsAt).getTime() > now));
        setSelected(activeGrants.map((grant) => grant.featureCode));
        if (activeGrants[0]) {
          setStartsAt(activeGrants[0].startsAt.slice(0, 10));
          setEndsAt(activeGrants[0].endsAt?.slice(0, 10) ?? "");
        }
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load administration modules."); }
    })();
  }, [open, schoolId]);

  function toggle(code: SchoolAdministrationModuleCode) {
    setSelected((current) => {
      if (code === "operations.foundation" && current.includes(code)) return [];
      if (current.includes(code)) return current.filter((item) => item !== code);
      return [...new Set(["operations.foundation" as const, ...current, code])];
    });
  }

  async function save() {
    if (!endsAt) { setError("Choose the administration licence expiry date."); return; }
    setBusy(true); setError("");
    try {
      const response = await updateSchoolAdministrationModules({ schoolId, modules: selected, startsAt: `${startsAt}T00:00:00.000Z`, endsAt: `${endsAt}T23:59:59.999Z` });
      setGrants(response.grants);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update administration modules."); }
    finally { setBusy(false); }
  }

  return <View style={styles.wrap}>
    <Pressable style={styles.trigger} onPress={() => setOpen((value) => !value)}><Text style={styles.triggerText}>Administration modules</Text><Text style={styles.triggerText}>{open ? "▲" : "▼"}</Text></Pressable>
    {open ? <View style={styles.panel}>
      <Text style={styles.copy}>This licence is separate from the academic package. Operations Foundation is automatically selected when any add-on is enabled.</Text>
      {modules.map((module) => <Pressable key={module.code} style={[styles.module, selected.includes(module.code) && styles.moduleActive]} onPress={() => toggle(module.code)}><Text style={selected.includes(module.code) ? styles.moduleActiveText : styles.moduleText}>{selected.includes(module.code) ? "✓ " : ""}{module.name}</Text></Pressable>)}
      <CalendarDateField label="Administration starts" value={startsAt} onChange={setStartsAt}/><CalendarDateField label="Administration expires" value={endsAt} onChange={setEndsAt} minimumDate={startsAt}/>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={busy} style={styles.save} onPress={() => void save()}><Text style={styles.saveText}>{busy ? "Saving…" : "Save administration licence"}</Text></Pressable>
      {grants.length ? <Text style={styles.meta}>{grants.filter((grant) => grant.status === "active").length} active grant record(s)</Text> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 }, trigger: { borderWidth: 1, borderColor: palette.navy, borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" }, triggerText: { color: palette.navy, fontWeight: "900" }, panel: { backgroundColor: "#F5F9FB", padding: 12, borderRadius: 12, marginTop: 7 }, copy: { color: "#587180", lineHeight: 20, marginBottom: 8 }, module: { padding: 11, borderRadius: 10, backgroundColor: "white", marginBottom: 6 }, moduleActive: { backgroundColor: palette.navy }, moduleText: { color: palette.navy, fontWeight: "800" }, moduleActiveText: { color: "white", fontWeight: "900" }, save: { backgroundColor: palette.navy, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 8 }, saveText: { color: "white", fontWeight: "900" }, error: { color: "#B42318", fontWeight: "800", marginVertical: 7 }, meta: { color: "#667E8B", marginTop: 8 },
});
