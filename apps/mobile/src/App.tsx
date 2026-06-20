import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LoginScreen } from "./screens/LoginScreen";
import { CheckInScreen } from "./screens/CheckInScreen";
import { ApprovalsScreen } from "./screens/ApprovalsScreen";
import { WorkersScreen } from "./screens/WorkersScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { InviteScreen } from "./screens/InviteScreen";
import { FaceVerifyScreen } from "./screens/FaceVerifyScreen";
import { NoticesScreen } from "./screens/NoticesScreen";
import { clearSession, getUser, SessionUser } from "./api";
import { I18nProvider, useI18n } from "./i18n";
import { registerForPushNotifications } from "./push";

const WORKER_ROLES = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "HR_MANAGER",
  "SECURITY_GUARD",
  "CONTRACTOR_SUPERVISOR",
]);

const HOST_ROLES = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "HR_MANAGER",
  "RECEPTIONIST",
  "EMPLOYEE",
]);

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "gate" }
  | { kind: "authed"; user: SessionUser };

type Tab = "dashboard" | "checkin" | "face" | "approvals" | "notices" | "workers" | "invite";

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const { t } = useI18n();
  const [auth, setAuth] = useState<AuthState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    getUser()
      .then((u) => {
        if (u) {
          setAuth({ kind: "authed", user: u });
          registerForPushNotifications().catch(() => {});
        } else {
          setAuth({ kind: "anonymous" });
        }
      })
      .catch(() => setAuth({ kind: "anonymous" }));
  }, []);

  if (auth.kind === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar style="light" />
        <Text style={{ color: "#64748b" }}>{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (auth.kind === "anonymous") {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen
          onLoggedIn={(user) => {
            setAuth({ kind: "authed", user });
            setTab("dashboard");
            registerForPushNotifications().catch(() => {});
          }}
          onContinueAsGate={() => {
            setAuth({ kind: "gate" });
            setTab("checkin");
          }}
        />
      </>
    );
  }

  if (auth.kind === "gate") {
    return (
      <>
        <StatusBar style="light" />
        <View style={styles.flex}>
          <CheckInScreen />
          <View style={styles.tabBar}>
            <TabButton label={t("tab.checkIn")} active onPress={() => {}} />
            <TabButton
              label={t("auth.signIn")}
              onPress={() => setAuth({ kind: "anonymous" })}
            />
          </View>
        </View>
      </>
    );
  }

  // authed
  const showWorkers = WORKER_ROLES.has(auth.user.role);
  const showInvite = HOST_ROLES.has(auth.user.role);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.flex}>
        <View style={styles.screenWrap}>
          {tab === "dashboard" && <DashboardScreen user={auth.user} />}
          {tab === "checkin" && <CheckInScreen />}
          {tab === "face" && <FaceVerifyScreen />}
          {tab === "notices" && <NoticesScreen />}
          {tab === "approvals" && <ApprovalsScreen user={auth.user} />}
          {tab === "workers" && showWorkers && <WorkersScreen user={auth.user} />}
          {tab === "invite" && showInvite && <InviteScreen user={auth.user} />}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBar}
        >
          <TabButton label={t("tab.dashboard")} active={tab === "dashboard"} onPress={() => setTab("dashboard")} />
          <TabButton label={t("tab.checkIn")} active={tab === "checkin"} onPress={() => setTab("checkin")} />
          <TabButton label={t("tab.face")} active={tab === "face"} onPress={() => setTab("face")} />
          <TabButton label={t("tab.notices")} active={tab === "notices"} onPress={() => setTab("notices")} />
          <TabButton label={t("tab.approvals")} active={tab === "approvals"} onPress={() => setTab("approvals")} />
          {showWorkers && (
            <TabButton label={t("tab.workers")} active={tab === "workers"} onPress={() => setTab("workers")} />
          )}
          {showInvite && (
            <TabButton label={t("tab.invite")} active={tab === "invite"} onPress={() => setTab("invite")} />
          )}
          <TabButton
            label={t("tab.signOut")}
            onPress={async () => {
              await clearSession();
              setAuth({ kind: "anonymous" });
            }}
          />
        </ScrollView>
      </View>
    </>
  );
}

function TabButton({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabBtn, active && styles.tabBtnActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#0a071a" },
  screenWrap: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a071a" },
  tabBarScroll: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10,7,26,0.95)",
    maxHeight: 56,
  },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingBottom: 14,
    paddingTop: 6,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    marginHorizontal: 2,
  },
  tabBtnActive: { backgroundColor: "rgba(124,58,237,0.15)" },
  tabText: { color: "#64748b", fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: "#a78bfa", fontWeight: "600" },
});
