import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, setSession, SessionUser } from "../api";
import { useI18n } from "../i18n";

interface Props {
  onLoggedIn: (user: SessionUser) => void;
  onContinueAsGate: () => void;
}

export function LoginScreen({ onLoggedIn, onContinueAsGate }: Props) {
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.login(email.trim(), password, needTotp ? totp : undefined);
      if ("totpRequired" in r) {
        setNeedTotp(true);
      } else {
        await setSession(r.accessToken, r.user);
        onLoggedIn(r.user);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.langRow}>
          <Pressable onPress={() => setLang("en")} style={styles.langBtn}>
            <Text style={lang === "en" ? styles.langActive : styles.langInactive}>EN</Text>
          </Pressable>
          <Text style={{ color: "#475569" }}>·</Text>
          <Pressable onPress={() => setLang("hi")} style={styles.langBtn}>
            <Text style={lang === "hi" ? styles.langActive : styles.langInactive}>हि</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>VMS</Text>
        <Text style={styles.subtitle}>Gem Aromatics · {t("auth.signIn")}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("auth.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="host@demo.local"
            placeholderTextColor="#64748b"
            editable={!needTotp}
          />
          <Text style={styles.label}>{t("auth.password")}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••"
            placeholderTextColor="#64748b"
            editable={!needTotp}
          />
          {needTotp && (
            <>
              <Text style={styles.label}>{t("auth.totp")}</Text>
              <TextInput
                style={[styles.input, styles.totpInput]}
                value={totp}
                onChangeText={(v) => setTotp(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="numeric"
                placeholder="000000"
                placeholderTextColor="#64748b"
                maxLength={6}
                autoFocus
              />
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[
              styles.button,
              (loading || !email || !password || (needTotp && totp.length !== 6)) &&
                styles.disabled,
            ]}
            onPress={submit}
            disabled={
              loading || !email || !password || (needTotp && totp.length !== 6)
            }
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("auth.signIn")}</Text>
            )}
          </Pressable>
        </View>

        <Pressable onPress={onContinueAsGate} style={styles.gateBtn}>
          <Text style={styles.gateText}>{t("auth.gateMode")}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a071a" },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  langRow: {
    position: "absolute",
    top: 50,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  langActive: { color: "#a78bfa", fontWeight: "600" },
  langInactive: { color: "#475569" },
  title: { color: "#f8fafc", fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: "#94a3b8", fontSize: 13, marginBottom: 32 },
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  label: {
    color: "#cbd5e1",
    fontSize: 11,
    marginBottom: 6,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: "#070418",
    color: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  totpInput: {
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 6,
  },
  error: { color: "#fca5a5", marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  gateBtn: { marginTop: 24, padding: 12, alignItems: "center" },
  gateText: { color: "#a78bfa", fontSize: 13 },
});
