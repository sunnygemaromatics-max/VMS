import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

type Lang = "en" | "hi";

const EN: Record<string, string> = {
  "tab.dashboard": "Dashboard",
  "tab.checkIn": "Check-in",
  "tab.approvals": "Approvals",
  "tab.workers": "Workers",
  "tab.invite": "Invite",
  "tab.face": "Verify",
  "tab.notices": "Notices",
  "tab.signOut": "Sign out",
  "auth.signIn": "Sign in",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.totp": "Two-factor code",
  "auth.gateMode": "Skip — use as gate kiosk (check-in only)",
  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "checkin.title": "Gate check-in",
  "checkin.scan": "Scan QR",
  "checkin.paste": "Paste token",
  "checkin.placeholder": "Paste token",
  "checkin.checkIn": "Check in",
  "checkin.face": "Identify by face",
  "approvals.title": "Pending approvals",
  "approvals.empty": "You're all caught up.",
  "approvals.approve": "Approve",
  "approvals.reject": "Reject",
  "workers.title": "Workers",
  "workers.add": "+ Add",
  "workers.onSite": "Mark on site",
  "workers.checkOut": "Mark checked out",
  "invite.title": "Invite a visitor",
  "invite.submit": "Generate pass",
  "dash.totalInside": "Total inside",
  "dash.pendingApprovals": "Pending",
  "common.clear": "Clear",
  "face.title": "Face verify",
  "face.hint": "Capture a face, then match it visually against everyone currently on-site.",
  "face.capture": "Capture",
  "face.retake": "Retake",
  "face.enableCamera": "Enable camera",
  "face.searchPlaceholder": "Search by name, phone, company",
  "face.onSite": "On-site now",
  "face.noneOnSite": "No one is currently inside.",
  "face.host": "Host",
  "notices.title": "Notice board",
  "notices.subtitle": "Branch and org-wide announcements.",
  "notices.empty": "No active notices.",
};

const HI: Record<string, string> = {
  "tab.dashboard": "डैशबोर्ड",
  "tab.checkIn": "चेक-इन",
  "tab.approvals": "अनुमोदन",
  "tab.workers": "कर्मचारी",
  "tab.invite": "आमंत्रित",
  "tab.face": "सत्यापन",
  "tab.notices": "सूचनाएँ",
  "tab.signOut": "साइन आउट",
  "auth.signIn": "साइन इन",
  "auth.email": "ईमेल",
  "auth.password": "पासवर्ड",
  "auth.totp": "2FA कोड",
  "auth.gateMode": "छोड़ें — केवल चेक-इन कियोस्क",
  "common.loading": "लोड हो रहा है…",
  "common.cancel": "रद्द",
  "common.save": "सहेजें",
  "common.close": "बंद",
  "checkin.title": "गेट चेक-इन",
  "checkin.scan": "QR स्कैन",
  "checkin.paste": "टोकन डालें",
  "checkin.placeholder": "टोकन पेस्ट करें",
  "checkin.checkIn": "चेक-इन",
  "checkin.face": "चेहरे से पहचान",
  "approvals.title": "लंबित अनुमोदन",
  "approvals.empty": "कोई लंबित नहीं।",
  "approvals.approve": "स्वीकृत",
  "approvals.reject": "अस्वीकार",
  "workers.title": "कर्मचारी",
  "workers.add": "+ जोड़ें",
  "workers.onSite": "साइट पर",
  "workers.checkOut": "चेक-आउट",
  "invite.title": "आगंतुक आमंत्रित करें",
  "invite.submit": "पास बनाएँ",
  "dash.totalInside": "अंदर कुल",
  "dash.pendingApprovals": "लंबित",
  "common.clear": "साफ़",
  "face.title": "चेहरा सत्यापन",
  "face.hint": "एक तस्वीर लें, फिर परिसर में मौजूद सभी से नज़र से मिलान करें।",
  "face.capture": "तस्वीर लें",
  "face.retake": "फिर लें",
  "face.enableCamera": "कैमरा सक्षम करें",
  "face.searchPlaceholder": "नाम, फ़ोन, कंपनी खोजें",
  "face.onSite": "अभी अंदर",
  "face.noneOnSite": "अभी कोई अंदर नहीं है।",
  "face.host": "होस्ट",
  "notices.title": "सूचना बोर्ड",
  "notices.subtitle": "शाखा और संगठन-व्यापी घोषणाएँ।",
  "notices.empty": "अभी कोई सक्रिय सूचना नहीं।",
};

const DICT: Record<Lang, Record<string, string>> = { en: EN, hi: HI };
const KEY = "vms_lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
}

const I18nCtx = createContext<Ctx | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => {
      if (v === "en" || v === "hi") setLangState(v);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    SecureStore.setItemAsync(KEY, l);
  }

  function t(k: string) {
    return DICT[lang][k] ?? DICT.en[k] ?? k;
  }

  return (
    <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
