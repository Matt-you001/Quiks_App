import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { palette, shadows } from "../lib/theme";

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateValue(value?: string) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function CalendarDateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder = "Select date",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  placeholder?: string;
}) {
  const minimum = parseDateValue(minimumDate) ?? new Date();
  minimum.setHours(0, 0, 0, 0);
  const [visible, setVisible] = useState(false);
  const [displayedMonth, setDisplayedMonth] = useState(() => monthStart(parseDateValue(value) ?? minimum));
  const minimumMonth = monthStart(minimum);
  const days = useMemo(() => {
    const firstGridDate = new Date(displayedMonth);
    firstGridDate.setDate(1 - displayedMonth.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstGridDate);
      date.setDate(firstGridDate.getDate() + index);
      date.setHours(0, 0, 0, 0);
      return { date, value: formatDateValue(date), inMonth: date.getMonth() === displayedMonth.getMonth() };
    });
  }, [displayedMonth]);

  const open = () => {
    const selected = parseDateValue(value);
    const base = selected && selected >= minimum ? selected : minimum;
    setDisplayedMonth(monthStart(base));
    setVisible(true);
  };

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`} onPress={open} style={styles.trigger}>
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{value || placeholder}</Text>
        <MaterialIcons name="calendar-month" size={23} color={palette.aqua} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={() => undefined}>
            <View style={styles.header}>
              <Pressable disabled={displayedMonth <= minimumMonth} onPress={() => setDisplayedMonth((current) => addMonths(current, -1))} style={styles.iconButton}>
                <MaterialIcons name="chevron-left" size={28} color={displayedMonth <= minimumMonth ? "#A7B5C6" : palette.navy} />
              </Pressable>
              <Text style={styles.month}>{displayedMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</Text>
              <Pressable onPress={() => setDisplayedMonth((current) => addMonths(current, 1))} style={styles.iconButton}>
                <MaterialIcons name="chevron-right" size={28} color={palette.navy} />
              </Pressable>
            </View>
            <View style={styles.week}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <Text key={day} style={styles.weekday}>{day}</Text>)}</View>
            <View style={styles.grid}>{days.map((entry) => {
              const disabled = !entry.inMonth || entry.date < minimum;
              const selected = entry.value === value;
              return <Pressable key={entry.value} disabled={disabled} onPress={() => { onChange(entry.value); setVisible(false); }} style={[styles.day, disabled && styles.disabled, selected && styles.selected]}>
                <Text style={[styles.dayText, disabled && styles.disabledText, selected && styles.selectedText]}>{entry.date.getDate()}</Text>
              </Pressable>;
            })}</View>
            <Pressable onPress={() => setVisible(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function getTodayDateValue() {
  return formatDateValue(new Date());
}

const styles = StyleSheet.create({
  label: { color: palette.navy, fontWeight: "800", marginTop: 8, marginBottom: 6 },
  trigger: { backgroundColor: "#F6F9FB", borderWidth: 1, borderColor: "#D4E0E7", borderRadius: 13, paddingHorizontal: 14, minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  triggerText: { color: palette.ink, fontSize: 16, fontWeight: "700" }, placeholder: { color: "#7E93A8", fontWeight: "500" },
  backdrop: { flex: 1, backgroundColor: "rgba(8,17,31,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 430, backgroundColor: palette.white, borderRadius: 22, padding: 18, ...shadows.card },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, iconButton: { padding: 7 }, month: { color: palette.navy, fontSize: 19, fontWeight: "900" },
  week: { flexDirection: "row" }, weekday: { width: "14.285%", textAlign: "center", color: palette.slate, fontSize: 12, fontWeight: "800", paddingVertical: 7 },
  grid: { flexDirection: "row", flexWrap: "wrap" }, day: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 999 }, dayText: { color: palette.navy, fontWeight: "800" }, disabled: { opacity: 0.23 }, disabledText: { color: "#8092A7" }, selected: { backgroundColor: palette.navy }, selectedText: { color: palette.white },
  cancel: { alignItems: "center", padding: 13, marginTop: 8 }, cancelText: { color: palette.navy, fontWeight: "900" },
});
