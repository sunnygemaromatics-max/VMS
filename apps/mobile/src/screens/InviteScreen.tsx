import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, SessionUser } from "../api";
import { useI18n } from "../i18n";

interface Branch { id: string; name: string; location: string }
interface Host { id: string; fullName: string; role: string; branchId: string }

export function InviteScreen({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { token: string; visitId: string }>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    company: "",
    documentNumber: "",
    purpose: "",
    branchId: user.branchId,
    hostId: user.id, // default: invite for myself
  });

  useEffect(() => {
    api.listBranches().then(setBranches).catch(() => {});
    api.listHosts().then(setHosts).catch(() => {});
  }, []);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (!form.fullName || !form.phone || !form.documentNumber || !form.purpose) {
      Alert.alert("Missing fields", "Name, phone, document number and purpose are required.");
      return;
    }
    setBusy(true);
    try {
      const visitor = await api.createVisitor({
        fullName: form.fullName,
        phone: form.phone,
        company: form.company || undefined,
        documentType: "AADHAAR",
        documentNumber: form.documentNumber,
      });
      const visit = await api.createVisit({
        visitorId: visitor.id,
        branchId: form.branchId,
        hostId: form.hostId,
        purpose: form.purpose,
        expectedEntry: new Date().toISOString(),
        status: "APPROVED", // host invites = auto-approved
      });
      setResult({ token: visit.qrCodeToken, visitId: visit.id });
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Visit invited ✓</Text>
        <View style={styles.successCard}>
          <Text style={styles.label}>QR token</Text>
          <Text selectable style={styles.token}>{result.token}</Text>
          <Text style={styles.hint}>
            Share this token with {form.fullName}. They can enter it at the kiosk or in this app.
          </Text>
        </View>
        <Pressable
          style={styles.secondary}
          onPress={() => {
            setResult(null);
            setForm({ ...form, fullName: "", phone: "", documentNumber: "", purpose: "" });
          }}
        >
          <Text style={styles.secondaryText}>Invite another</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{t("invite.title")}</Text>
      <Text style={styles.subtitle}>
        Visit is auto-approved since you're the host.
      </Text>

      <Field label="Full name *" value={form.fullName} onChange={(v) => set("fullName", v)} />
      <Field
        label="Phone *"
        value={form.phone}
        onChange={(v) => set("phone", v)}
        keyboardType="phone-pad"
      />
      <Field label="Company" value={form.company} onChange={(v) => set("company", v)} />
      <Field
        label="Document number *"
        value={form.documentNumber}
        onChange={(v) => set("documentNumber", v)}
      />
      <Field
        label="Purpose *"
        value={form.purpose}
        onChange={(v) => set("purpose", v)}
        multiline
      />

      <Text style={styles.label}>Branch</Text>
      <ScrollView horizontal style={{ marginBottom: 8 }} showsHorizontalScrollIndicator={false}>
        {branches.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => set("branchId", b.id)}
            style={[styles.chip, form.branchId === b.id && styles.chipActive]}
          >
            <Text style={form.branchId === b.id ? styles.chipActiveText : styles.chipText}>
              {b.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Host</Text>
      <ScrollView horizontal style={{ marginBottom: 12 }} showsHorizontalScrollIndicator={false}>
        {hosts.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => set("hostId", h.id)}
            style={[styles.chip, form.hostId === h.id && styles.chipActive]}
          >
            <Text style={form.hostId === h.id ? styles.chipActiveText : styles.chipText}>
              {h.fullName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.button, busy && styles.disabled]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t("invite.submit")}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { minHeight: 60, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a071a" },
  content: { padding: 18, paddingTop: 48, paddingBottom: 32 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginBottom: 18 },
  label: {
    color: "#cbd5e1",
    fontSize: 11,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: "#070418",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12,
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
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { color: "#cbd5e1", fontSize: 12 },
  chipActiveText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },

  successCard: {
    backgroundColor: "rgba(124,58,237,0.08)",
    borderColor: "rgba(124,58,237,0.3)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
  },
  token: { color: "#fff", fontFamily: "Menlo", fontSize: 13, marginBottom: 10 },
  hint: { color: "#94a3b8", fontSize: 12 },
  secondary: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
  },
  secondaryText: { color: "#cbd5e1" },
});
