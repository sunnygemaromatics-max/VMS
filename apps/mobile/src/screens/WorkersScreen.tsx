import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, SessionUser } from "../api";

interface Contractor {
  id: string;
  companyName: string;
}
interface Worker {
  id: string;
  fullName: string;
  phone: string;
  skillCategory: string;
  medicalExpiry: string;
  policeVerified: boolean;
  isActive: boolean;
  contractor?: { companyName: string };
}
interface Attendance {
  id: string;
  workerId: string;
  checkIn: string;
  checkOut: string | null;
}

export function WorkersScreen({ user }: { user: SessionUser }) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [openAttendance, setOpenAttendance] = useState<Record<string, string>>({}); // workerId -> attendanceId
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [c, w, a] = await Promise.all([
        api.listContractors(),
        api.listWorkers(),
        api.listAttendance(),
      ]);
      setContractors(c.map((x: any) => ({ id: x.id, companyName: x.companyName })));
      setWorkers(w);
      const open: Record<string, string> = {};
      for (const att of a as Attendance[]) {
        if (att.checkOut === null) open[att.workerId] = att.id;
      }
      setOpenAttendance(open);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (!workers) return null;
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.fullName.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.skillCategory.toLowerCase().includes(q) ||
        (w.contractor?.companyName.toLowerCase().includes(q) ?? false),
    );
  }, [workers, search]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggleAttendance(w: Worker) {
    setBusyId(w.id);
    try {
      if (openAttendance[w.id]) {
        const r = await api.workerCheckOut(w.id);
        Alert.alert("Checked out", `${r.workerName} marked as left`);
      } else {
        const r = await api.workerCheckIn(w.id, "mobile-gate-1");
        Alert.alert(
          r.alreadyInside ? "Already inside" : "Checked in",
          `${r.workerName ?? w.fullName} is now on site`,
        );
      }
      await load();
    } catch (e) {
      Alert.alert("Action failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94a3b8" />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Workers</Text>
            <Text style={styles.subtitle}>
              {user.role} · {Object.keys(openAttendance).length} on-site
            </Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name / phone / skill / contractor"
          placeholderTextColor="#64748b"
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {!workers && <ActivityIndicator color="#60a5fa" style={{ marginTop: 24 }} />}
        {filtered && filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {search ? "No workers match." : "No workers yet. Tap + Add."}
            </Text>
          </View>
        )}

        {filtered?.map((w) => {
          const isInside = !!openAttendance[w.id];
          const expired = new Date(w.medicalExpiry) < new Date();
          return (
            <View
              key={w.id}
              style={[styles.card, isInside && styles.cardInside]}
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{w.fullName}</Text>
                  <Text style={styles.cardSub}>
                    {w.skillCategory} · {w.contractor?.companyName ?? "—"}
                  </Text>
                  <Text style={styles.cardSub}>{w.phone}</Text>
                </View>
                <View style={styles.badges}>
                  <Badge ok={w.policeVerified} label={w.policeVerified ? "Police ✓" : "Police ✗"} />
                  <Badge ok={!expired} label={expired ? "Med expired" : "Med ✓"} />
                </View>
              </View>

              <Pressable
                onPress={() => toggleAttendance(w)}
                disabled={busyId === w.id}
                style={[
                  styles.actionBtn,
                  isInside ? styles.actionBtnOut : styles.actionBtnIn,
                  busyId === w.id && styles.disabled,
                ]}
              >
                <Text style={styles.actionText}>
                  {busyId === w.id
                    ? "…"
                    : isInside
                    ? "Mark checked out"
                    : "Mark on site"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAdd(false)}
      >
        <AddWorkerForm
          contractors={contractors}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      </Modal>
    </>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.badge, ok ? styles.badgeOk : styles.badgeBad]}>
      <Text style={ok ? styles.badgeOkText : styles.badgeBadText}>{label}</Text>
    </View>
  );
}

function AddWorkerForm({
  contractors,
  onClose,
  onCreated,
}: {
  contractors: Contractor[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    contractorId: contractors[0]?.id ?? "",
    fullName: "",
    phone: "",
    documentType: "AADHAAR",
    documentNumber: "",
    skillCategory: "",
    medicalExpiry: defaultMedicalExpiry(),
    policeVerified: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    setErr(null);
    if (!form.contractorId) return setErr("Pick a contractor");
    if (!form.fullName || !form.phone || !form.documentNumber || !form.skillCategory) {
      return setErr("All required fields must be filled");
    }
    setSubmitting(true);
    try {
      await api.createWorker(form);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f172a" }}
      contentContainerStyle={{ padding: 20, paddingTop: 56 }}
    >
      <View style={styles.modalHead}>
        <Text style={styles.title}>New worker</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Cancel</Text>
        </Pressable>
      </View>

      <Label text="Contractor *" />
      <ScrollView horizontal style={{ marginBottom: 12 }} showsHorizontalScrollIndicator={false}>
        {contractors.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => set("contractorId", c.id)}
            style={[
              styles.chip,
              form.contractorId === c.id && styles.chipActive,
            ]}
          >
            <Text style={form.contractorId === c.id ? styles.chipTextActive : styles.chipText}>
              {c.companyName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Field label="Full name *" value={form.fullName} onChange={(v) => set("fullName", v)} />
      <Field
        label="Phone *"
        value={form.phone}
        onChange={(v) => set("phone", v)}
        keyboardType="phone-pad"
      />
      <Field
        label="Skill category *"
        value={form.skillCategory}
        onChange={(v) => set("skillCategory", v)}
        placeholder="Electrician, Welder, Loader…"
      />

      <Label text="Document type" />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENSE"].map((t) => (
          <Pressable
            key={t}
            onPress={() => set("documentType", t)}
            style={[styles.chip, form.documentType === t && styles.chipActive]}
          >
            <Text style={form.documentType === t ? styles.chipTextActive : styles.chipText}>
              {t.replace("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="Document number *"
        value={form.documentNumber}
        onChange={(v) => set("documentNumber", v)}
      />
      <Field
        label="Medical expiry (YYYY-MM-DD)"
        value={form.medicalExpiry}
        onChange={(v) => set("medicalExpiry", v)}
      />

      <Pressable
        style={styles.checkRow}
        onPress={() => set("policeVerified", !form.policeVerified)}
      >
        <View style={[styles.checkbox, form.policeVerified && styles.checkboxOn]}>
          {form.policeVerified && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
        </View>
        <Text style={{ color: "#cbd5e1" }}>Police verified</Text>
      </Pressable>

      {err && <Text style={styles.error}>{err}</Text>}

      <Pressable
        style={[styles.submitBtn, submitting && styles.disabled]}
        onPress={submit}
        disabled={submitting}
      >
        <Text style={styles.submitText}>{submitting ? "Saving…" : "Add worker"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <>
      <Label text={label} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
      />
    </>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function defaultMedicalExpiry() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0f172a" },
  container: { padding: 16, paddingTop: 48, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  title: { color: "#f8fafc", fontSize: 26, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 12 },
  addBtn: { backgroundColor: "#3b82f6", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "600" },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 14,
  },
  error: { color: "#fca5a5", marginVertical: 12 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: "#64748b" },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardInside: {
    borderColor: "rgba(59,130,246,0.4)",
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  cardHead: { flexDirection: "row", marginBottom: 12 },
  cardTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "600" },
  cardSub: { color: "#94a3b8", fontSize: 12 },
  badges: { gap: 4, alignItems: "flex-end" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeOk: { backgroundColor: "rgba(34,197,94,0.15)" },
  badgeBad: { backgroundColor: "rgba(239,68,68,0.15)" },
  badgeOkText: { color: "#86efac", fontSize: 10, fontWeight: "600" },
  badgeBadText: { color: "#fca5a5", fontSize: 10, fontWeight: "600" },
  actionBtn: { paddingVertical: 11, borderRadius: 8, alignItems: "center" },
  actionBtnIn: { backgroundColor: "#16a34a" },
  actionBtnOut: { backgroundColor: "rgba(100,116,139,0.6)" },
  actionText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.5 },

  modalHead: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  closeBtn: { marginLeft: "auto", padding: 6 },
  closeText: { color: "#60a5fa" },
  label: { color: "#cbd5e1", fontSize: 12, marginBottom: 6, marginTop: 8, textTransform: "uppercase" },
  input: {
    backgroundColor: "#020617",
    color: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#cbd5e1", fontSize: 12 },
  chipTextActive: { color: "#fff", fontSize: 12, fontWeight: "600" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  submitBtn: {
    backgroundColor: "#3b82f6",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 18,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
