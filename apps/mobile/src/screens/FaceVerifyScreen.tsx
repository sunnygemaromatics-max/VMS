import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "../api";
import { useI18n } from "../i18n";

interface Person {
  kind: "visitor" | "worker";
  id: string;
  name: string;
  phone: string;
  company?: string;
  branch?: string;
  host?: string;
  entryAt: string;
  photo: string | null;
}

export function FaceVerifyScreen() {
  const { t } = useI18n();
  const [perm, requestPerm] = useCameraPermissions();
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.activeOnSite();
      const all: Person[] = [
        ...data.visitors.map((v) => ({
          kind: v.kind,
          id: v.id,
          name: v.name,
          phone: v.phone,
          company: v.company,
          branch: v.branch,
          host: v.host,
          entryAt: v.entryAt,
          photo: v.photo,
        })),
        ...data.workers.map((w) => ({
          kind: w.kind,
          id: w.id,
          name: w.name,
          phone: w.phone,
          company: w.company,
          branch: w.branch,
          entryAt: w.entryAt,
          photo: w.photo,
        })),
      ];
      setPeople(all);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function capture() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
        skipProcessing: true,
      });
      setShot(photo?.uri ?? null);
      await load();
    } catch (e) {
      Alert.alert("Capture failed", e instanceof Error ? e.message : "Unknown");
    } finally {
      setBusy(false);
    }
  }

  if (!perm) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>{t("face.title")}</Text>
        <Text style={styles.muted}>
          Camera access is required to verify faces against on-site visitors.
        </Text>
        <Pressable
          style={styles.button}
          onPress={async () => {
            const r = await requestPerm();
            if (!r.granted) {
              Alert.alert("Permission needed", "Enable Camera for VMS in Settings.", [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]);
            }
          }}
        >
          <Text style={styles.buttonText}>{t("face.enableCamera")}</Text>
        </Pressable>
      </View>
    );
  }

  const filtered = people.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.phone.includes(filter) ||
      (p.company ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("face.title")}</Text>
      <Text style={styles.muted}>{t("face.hint")}</Text>

      <View style={styles.cameraBox}>
        {shot ? (
          <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        )}
        <View style={styles.frame} pointerEvents="none" />
      </View>

      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex]} onPress={capture} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{shot ? t("face.retake") : t("face.capture")}</Text>}
        </Pressable>
        {shot && (
          <Pressable style={[styles.button, styles.secondary]} onPress={() => setShot(null)}>
            <Text style={styles.buttonText}>{t("common.clear")}</Text>
          </Pressable>
        )}
      </View>

      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder={t("face.searchPlaceholder")}
        placeholderTextColor="#64748b"
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.section}>
        {t("face.onSite")} · {filtered.length}/{people.length}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(p) => `${p.kind}-${p.id}`}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.personRow}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{item.name.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.personName}>{item.name}</Text>
              <Text style={styles.personMeta}>
                {item.kind === "worker" ? "👷" : "👤"} {item.company ?? ""}
                {item.host ? `  ·  ${t("face.host")}: ${item.host}` : ""}
              </Text>
              <Text style={styles.personPhone}>{item.phone}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.muted}>{t("face.noneOnSite")}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a071a", padding: 16, paddingTop: 48 },
  center: { justifyContent: "center", alignItems: "center", gap: 14 },
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "700" },
  muted: { color: "#94a3b8", fontSize: 12, marginTop: 4, marginBottom: 10 },
  error: { color: "#fca5a5", fontSize: 12, marginTop: 4 },
  section: { color: "#cbd5e1", fontSize: 12, textTransform: "uppercase", marginTop: 14, marginBottom: 6 },
  cameraBox: {
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
    marginBottom: 10,
  },
  frame: {
    position: "absolute",
    top: 20,
    left: 60,
    right: 60,
    bottom: 20,
    borderColor: "#a78bfa",
    borderWidth: 2,
    borderRadius: 100,
  },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: "rgba(255,255,255,0.08)" },
  buttonText: { color: "#fff", fontWeight: "600" },
  input: {
    marginTop: 10,
    backgroundColor: "#070418",
    color: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  personRow: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#1e1b32" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#a78bfa", fontWeight: "700", fontSize: 22 },
  personName: { color: "#f8fafc", fontWeight: "600", fontSize: 15 },
  personMeta: { color: "#94a3b8", fontSize: 12 },
  personPhone: { color: "#64748b", fontSize: 11 },
});
