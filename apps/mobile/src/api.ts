import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

const TOKEN_KEY = "vms_token";
const USER_KEY = "vms_user";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  branchId: string;
  orgId?: string | null;
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<SessionUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setSession(token: string, user: SessionUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text || `${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return text ? (JSON.parse(text) as T) : (undefined as any);
}

export const api = {
  login: (email: string, password: string, totp?: string) =>
    request<
      | { accessToken: string; user: SessionUser }
      | { totpRequired: true }
    >("/auth/login", {
      method: "POST",
      body: { email, password, totp },
      auth: false,
    }),
  checkIn: (qrCodeToken: string) =>
    request<{ visitorName?: string }>("/gate/check-in", {
      method: "POST",
      body: { qrCodeToken },
      auth: false,
    }),
  pendingVisits: () => request<any[]>("/visitors/pending"),
  decide: (visitId: string, status: "APPROVED" | "REJECTED") =>
    request<any>(`/visitors/visit/${visitId}/status`, {
      method: "PUT",
      body: { status },
    }),

  // Workers (security guard / contractor supervisor)
  listContractors: () => request<any[]>("/admin/contractors"),
  listWorkers: (contractorId?: string) =>
    request<any[]>(
      contractorId
        ? `/admin/workers?contractorId=${encodeURIComponent(contractorId)}`
        : "/admin/workers",
    ),
  listAttendance: () => request<any[]>("/admin/attendance"),
  createWorker: (data: any) =>
    request<any>("/admin/workers", { method: "POST", body: data }),
  workerCheckIn: (workerId: string, gateId: string) =>
    request<any>("/gate/worker-check-in", {
      method: "POST",
      body: { workerId, gateId },
    }),
  workerCheckOut: (workerId: string) =>
    request<any>("/gate/worker-check-out", {
      method: "POST",
      body: { workerId },
    }),

  // Pre-approve / invite (host)
  listBranches: () => request<any[]>("/admin/branches"),
  listHosts: () => request<any[]>("/admin/hosts"),
  createVisitor: (data: any) =>
    request<{ id: string }>("/visitors", { method: "POST", body: data }),
  createVisit: (data: any) =>
    request<{ id: string; qrCodeToken: string }>("/visitors/visit", {
      method: "POST",
      body: data,
    }),

  // Dashboard counts
  headcount: () =>
    request<{ total: number; visitors: number; workers: number; employees: number }>(
      "/visitors/headcount",
    ),

  // Face match
  faceIdentify: (embedding: number[]) =>
    request<any>("/face/identify", {
      method: "POST",
      body: { embedding },
      auth: false,
    }),

  // SOS — broadcasts to every connected dashboard
  sosTrigger: (message?: string) =>
    request<{ ok: boolean }>("/sos/trigger", { method: "POST", body: { message } }),

  // Active visitors+workers on-site (with photos, for face verify gallery)
  activeOnSite: () =>
    request<{
      visitors: Array<{
        kind: "visitor";
        visitId: string;
        id: string;
        name: string;
        phone: string;
        company?: string;
        host?: string;
        branch?: string;
        entryAt: string;
        photo: string | null;
      }>;
      workers: Array<{
        kind: "worker";
        attendanceId: string;
        id: string;
        name: string;
        phone: string;
        company?: string;
        branch?: string;
        entryAt: string;
        photo: string | null;
      }>;
    }>("/visitors/active"),

  // Push notification token
  registerPushToken: (token: string, platform: string) =>
    request<{ ok: boolean }>("/notifications/register", {
      method: "POST",
      body: { token, platform },
    }),
  unregisterPushToken: (token: string) =>
    request<{ ok: boolean }>("/notifications/unregister", {
      method: "POST",
      body: { token },
    }),

  // Notices / announcements
  listNotices: () =>
    request<
      Array<{
        id: string;
        title: string;
        body: string;
        level: "info" | "warning" | "urgent";
        authorName: string;
        createdAt: string;
        expiresAt: string | null;
      }>
    >("/notices"),
};
