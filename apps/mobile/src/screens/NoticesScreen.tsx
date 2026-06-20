import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Notice {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "urgent";
  authorName: string;
  createdAt: string;
  expiresAt: string | null;
}

export function NoticesScreen() {
  const { t } = useI18n();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.listNotices();
      setNotices(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("notices.title")}</Text>
      <Text style={styles.muted}>{t("notices.subtitle")}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {!notices ? (
        <View style={styles.center}>
          <ActivityIndicator color="#a78bfa" />
        </View>
      ) : notices.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("notices.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(n) => n.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
          }
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => <NoticeCard n={item} />}
        />
      )}
    </View>
  );
}

function NoticeCard({ n }: { n: Notice }) {
  const tone =
    n.level === "urgent"
      ? styles.tonalUrgent
      : n.level === "warning"
      ? styles.tonalWarning
      : styles.tonalInfo;
  const accent =
    n.level === "urgent" ? "#fca5a5" : n.level === "warning" ? "#fcd34d" : "#a78bfa";
  return (
    <View style={[styles.card, tone]}>
      <Text style={[styles.icon, { color: accent }]}>
        {n.level === "urgent" ? "⚠️" : n.level === "warning" ? "⚠" : "ℹ"}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{n.title}</Text>
        <Text style={styles.cardBody}>{n.body}</Text>
        <Text style={styles.cardMeta}>
          {n.authorName} · {new Date(n.createdAt).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a071a", padding: 16, paddingTop: 48 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  muted: { color: "#94a3b8", fontSize: 12, marginTop: 4, marginBottom: 12 },
  error: { color: "#fca5a5", fontSize: 12, marginVertical: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  tonalInfo: { backgroundColor: "rgba(124,58,237,0.07)", borderColor: "rgba(124,58,237,0.25)" },
  tonalWarning: { backgroundColor: "rgba(251,191,36,0.07)", borderColor: "rgba(251,191,36,0.30)" },
  tonalUrgent: { backgroundColor: "rgba(220,38,38,0.07)", borderColor: "rgba(220,38,38,0.35)" },
  icon: { fontSize: 18, paddingTop: 2 },
  cardTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  cardBody: { color: "#cbd5e1", fontSize: 13, marginTop: 4 },
  cardMeta: { color: "#64748b", fontSize: 10, marginTop: 6, fontFamily: "monospace" },
});
