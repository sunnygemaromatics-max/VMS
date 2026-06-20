import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, SessionUser } from "../api";

interface PendingVisit {
  id: string;
  purpose: string;
  expectedEntry: string;
  vehicleNumber: string | null;
  visitor: { fullName: string; phone: string; company: string | null };
  host: { fullName: string };
  branch: { name: string; location: string };
}

export function ApprovalsScreen({ user }: { user: SessionUser }) {
  const [items, setItems] = useState<PendingVisit[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.pendingVisits();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api.decide(id, status);
      await load();
    } catch (e) {
      Alert.alert("Action failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94a3b8" />}
    >
      <Text style={styles.title}>Pending approvals</Text>
      <Text style={styles.subtitle}>
        Signed in as {user.fullName} · {user.role}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {!items && <ActivityIndicator color="#60a5fa" style={{ marginTop: 24 }} />}

      {items && items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>You're all caught up — no pending visits.</Text>
        </View>
      )}

      {items?.map((v) => (
        <View key={v.id} style={styles.card}>
          <Text style={styles.cardTitle}>{v.visitor.fullName}</Text>
          {v.visitor.company && <Text style={styles.cardSub}>{v.visitor.company}</Text>}
          <Text style={styles.cardSub}>{v.visitor.phone}</Text>

          <View style={styles.divider} />

          <Field label="Purpose" value={v.purpose} />
          <Field label="Expected" value={new Date(v.expectedEntry).toLocaleString()} />
          <Field label="Host" value={v.host.fullName} />
          <Field label="Branch" value={`${v.branch.name} · ${v.branch.location}`} />
          {v.vehicleNumber && <Field label="Vehicle" value={v.vehicleNumber} />}

          <View style={styles.actions}>
            <Pressable
              style={[styles.approveBtn, busyId === v.id && styles.disabled]}
              onPress={() => decide(v.id, "APPROVED")}
              disabled={busyId === v.id}
            >
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.rejectBtn, busyId === v.id && styles.disabled]}
              onPress={() => decide(v.id, "REJECTED")}
              disabled={busyId === v.id}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0f172a" },
  container: { padding: 20, paddingTop: 48, paddingBottom: 32 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 24 },
  error: { color: "#fca5a5", marginBottom: 12 },
  empty: { padding: 24, alignItems: "center" },
  emptyText: { color: "#64748b" },
  card: {
    backgroundColor: "rgba(234,179,8,0.07)",
    borderColor: "rgba(234,179,8,0.25)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: "#f8fafc", fontSize: 17, fontWeight: "600" },
  cardSub: { color: "#94a3b8", fontSize: 12 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 12 },
  field: { marginBottom: 8 },
  fieldLabel: { color: "#64748b", fontSize: 10, textTransform: "uppercase" },
  fieldValue: { color: "#e2e8f0", fontSize: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  approveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  approveText: { color: "#fff", fontWeight: "600" },
  rejectBtn: {
    flex: 1,
    backgroundColor: "rgba(239,68,68,0.85)",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  rejectText: { color: "#fff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
