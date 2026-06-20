import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api, API_URL } from "../api";
import { useI18n } from "../i18n";

type Mode = "scan" | "paste";

export function CheckInScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("scan");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannedLock, setScannedLock] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();

  async function submit(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      const data = await api.checkIn(value.trim());
      Alert.alert("✓", `Welcome ${data.visitorName ?? "Visitor"}`);
      setToken("");
    } catch (e) {
      Alert.alert(
        "Check-in failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setBusy(false);
      // Allow next scan after a short cooldown
      setTimeout(() => setScannedLock(false), 1500);
    }
  }

  const cameraReady = perm?.granted;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("checkin.title")}</Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setMode("scan")}
          style={[styles.tab, mode === "scan" && styles.tabActive]}
        >
          <Text style={mode === "scan" ? styles.tabActiveText : styles.tabText}>
            {t("checkin.scan")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("paste")}
          style={[styles.tab, mode === "paste" && styles.tabActive]}
        >
          <Text style={mode === "paste" ? styles.tabActiveText : styles.tabText}>
            {t("checkin.paste")}
          </Text>
        </Pressable>
      </View>

      {mode === "scan" ? (
        <View style={styles.scanWrap}>
          {!perm ? (
            <Text style={styles.muted}>Loading camera…</Text>
          ) : !perm.granted ? (
            <View style={styles.permWrap}>
              <Text style={styles.permText}>
                Camera access is required to scan QR codes.
              </Text>
              <Pressable
                style={styles.button}
                onPress={async () => {
                  const r = await requestPerm();
                  if (!r.granted) {
                    Alert.alert(
                      "Permission needed",
                      "Open Settings to enable Camera for VMS.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open Settings", onPress: () => Linking.openSettings() },
                      ],
                    );
                  }
                }}
              >
                <Text style={styles.buttonText}>Enable camera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={
                  scannedLock || busy
                    ? undefined
                    : (e) => {
                        setScannedLock(true);
                        submit(e.data);
                      }
                }
              />
              <View style={styles.scanFrame} />
              {busy && (
                <View style={styles.scanOverlay}>
                  <ActivityIndicator color="#a78bfa" />
                  <Text style={styles.muted}>Checking in…</Text>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.pasteWrap}>
          <Text style={styles.label}>QR token</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder={t("checkin.placeholder")}
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.button, (!token.trim() || busy) && styles.disabled]}
            disabled={!token.trim() || busy}
            onPress={() => submit(token)}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("checkin.checkIn")}</Text>
            )}
          </Pressable>
        </View>
      )}

      <Text style={styles.footer}>API: {API_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a071a", padding: 18, paddingTop: 48 },
  title: { color: "#f8fafc", fontSize: 26, fontWeight: "700", marginBottom: 16 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#7c3aed" },
  tabText: { color: "#94a3b8", fontWeight: "500" },
  tabActiveText: { color: "#fff", fontWeight: "600" },
  scanWrap: { flex: 1, justifyContent: "center" },
  cameraBox: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000",
    position: "relative",
  },
  scanFrame: {
    position: "absolute",
    top: "20%",
    left: "20%",
    right: "20%",
    bottom: "20%",
    borderColor: "#a78bfa",
    borderWidth: 2,
    borderRadius: 12,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  permWrap: { alignItems: "center", gap: 14, padding: 20 },
  permText: { color: "#cbd5e1", textAlign: "center" },
  pasteWrap: { gap: 12 },
  label: { color: "#cbd5e1", fontSize: 12, textTransform: "uppercase" },
  input: {
    backgroundColor: "#070418",
    color: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  muted: { color: "#64748b", textAlign: "center" },
  footer: { color: "#334155", fontSize: 10, textAlign: "center", marginTop: 16 },
});
