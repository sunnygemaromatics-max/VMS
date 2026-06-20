export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const TOKEN_KEY = "vms_auth_token";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined") {
    // Token rejected — purge and bounce to login.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("vms_user");
    if (!window.location.pathname.startsWith("/auth/")) {
      window.location.href = "/auth/login";
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let parsed: any = body;
    try {
      parsed = JSON.parse(body);
    } catch {}
    const msg =
      parsed?.message ||
      (typeof parsed === "string" && parsed) ||
      `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as any;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader() },
    cache: "no-store",
  });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPut<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { ...authHeader() },
  });
  return handle<T>(res);
}
