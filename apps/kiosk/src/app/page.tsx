"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrScanner } from "../components/QrScanner";
import { FaceIdentify } from "../components/FaceIdentify";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Tab = "token" | "walk-in" | "face";

interface Branch { id: string; name: string; location: string }
interface Host { id: string; fullName: string; branchId: string }

interface SuccessState {
  visitorName: string;
  hostName?: string;
  qrCodeToken?: string;
  visitId?: string;
  isWalkIn: boolean;
}

export default function KioskPage() {
  const [tab, setTab] = useState<Tab>("token");
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset success/error when switching tabs
  useEffect(() => {
    setSuccess(null);
    setError(null);
  }, [tab]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold mb-2">Gate Kiosk</h1>
          <p className="text-sm text-slate-400">
            Check in with a QR token, or walk in and register.
          </p>
        </header>

        <div className="flex gap-2 mb-4">
          <TabButton active={tab === "token"} onClick={() => setTab("token")}>
            Token
          </TabButton>
          <TabButton active={tab === "walk-in"} onClick={() => setTab("walk-in")}>
            Walk-in
          </TabButton>
          <TabButton active={tab === "face"} onClick={() => setTab("face")}>
            Face
          </TabButton>
        </div>

        {success ? (
          <SuccessPanel state={success} onReset={() => setSuccess(null)} />
        ) : tab === "token" ? (
          <TokenForm onSuccess={setSuccess} setError={setError} />
        ) : tab === "walk-in" ? (
          <WalkInForm onSuccess={setSuccess} setError={setError} />
        ) : (
          <FaceIdentify />
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            ✗ {error}
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function TokenForm({
  onSuccess,
  setError,
}: {
  onSuccess: (s: SuccessState) => void;
  setError: (s: string | null) => void;
}) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function submitToken(value: string) {
    if (!value.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/gate/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeToken: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.text();
        let parsed: any = body;
        try { parsed = JSON.parse(body); } catch {}
        setError(parsed?.message || `Check-in failed (${res.status})`);
        return;
      }
      const data = await res.json();
      onSuccess({
        visitorName: data.visitorName ?? "Visitor",
        isWalkIn: false,
      });
      setToken("");
      setScanning(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScanning(false)}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
            !scanning ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300"
          }`}
        >
          Paste token
        </button>
        <button
          type="button"
          onClick={() => setScanning(true)}
          className={`flex-1 px-3 py-2 rounded text-sm font-medium ${
            scanning ? "bg-blue-600 text-white" : "bg-white/5 text-slate-300"
          }`}
        >
          Scan QR
        </button>
      </div>

      {scanning ? (
        <>
          <p className="text-xs text-slate-400">
            Point the camera at the visitor's QR. Browser may ask for camera permission.
          </p>
          <QrScanner active={scanning} onScan={(text) => submitToken(text)} />
          {loading && (
            <p className="text-center text-blue-300 text-sm">Checking in…</p>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitToken(token);
          }}
          className="space-y-3"
        >
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="QR token"
            autoFocus
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-lg outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Checking in…" : "Check In"}
          </button>
        </form>
      )}
    </div>
  );
}

function WalkInForm({
  onSuccess,
  setError,
}: {
  onSuccess: (s: SuccessState) => void;
  setError: (s: string | null) => void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    company: "",
    documentType: "AADHAAR",
    documentNumber: "",
    purpose: "",
    branchId: "",
    hostId: "",
    vehicleNumber: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/public/branches`).then((r) => r.json()),
      fetch(`${API_URL}/public/hosts`).then((r) => r.json()),
    ])
      .then(([bs, hs]) => {
        setBranches(bs);
        setHosts(hs);
        if (bs.length === 1) setForm((f) => ({ ...f, branchId: bs[0].id }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load form"));
  }, []);

  const visibleHosts = form.branchId
    ? hosts.filter((h) => h.branchId === form.branchId)
    : hosts;

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/walk-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.text();
        let parsed: any = body;
        try { parsed = JSON.parse(body); } catch {}
        setError(parsed?.message || `Registration failed (${res.status})`);
        return;
      }
      const data = await res.json();
      onSuccess({
        visitorName: data.visitorName,
        hostName: data.hostName,
        qrCodeToken: data.qrCodeToken,
        visitId: data.visitId,
        isWalkIn: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-blue-400";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur space-y-3 max-h-[70vh] overflow-y-auto"
    >
      <p className="text-xs text-slate-400">
        Fill in your details. Your host will get notified to approve.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder="Full name *"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          className={inputClass}
        />
        <input
          required
          type="tel"
          placeholder="Phone *"
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputClass}
        />
        <input
          placeholder="Company"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          className={inputClass}
        />
        <select
          value={form.documentType}
          onChange={(e) => set("documentType", e.target.value)}
          className={inputClass + " bg-slate-900"}
        >
          <option value="AADHAAR">Aadhaar</option>
          <option value="PAN">PAN</option>
          <option value="PASSPORT">Passport</option>
          <option value="DRIVING_LICENSE">Driving Licence</option>
        </select>
        <input
          required
          placeholder="Doc number *"
          value={form.documentNumber}
          onChange={(e) => set("documentNumber", e.target.value)}
          className={inputClass}
        />
      </div>
      <textarea
        required
        rows={2}
        placeholder="Purpose of visit *"
        value={form.purpose}
        onChange={(e) => set("purpose", e.target.value)}
        className={inputClass + " resize-none"}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          required
          value={form.branchId}
          onChange={(e) => set("branchId", e.target.value)}
          className={inputClass + " bg-slate-900"}
        >
          <option value="">-- Branch * --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.location}
            </option>
          ))}
        </select>
        <select
          required
          value={form.hostId}
          onChange={(e) => set("hostId", e.target.value)}
          className={inputClass + " bg-slate-900"}
        >
          <option value="">-- Host * --</option>
          {visibleHosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.fullName}
            </option>
          ))}
        </select>
      </div>
      <input
        placeholder="Vehicle number"
        value={form.vehicleNumber}
        onChange={(e) => set("vehicleNumber", e.target.value)}
        className={inputClass}
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Register & request approval"}
      </button>
    </form>
  );
}

function SuccessPanel({
  state,
  onReset,
}: {
  state: SuccessState;
  onReset: () => void;
}) {
  if (state.isWalkIn) {
    return (
      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6 text-center space-y-4">
        <h2 className="text-2xl font-bold">Hi {state.visitorName} 👋</h2>
        <p className="text-sm text-slate-300">
          Your host{state.hostName ? ` (${state.hostName})` : ""} has been
          notified. Show this QR at the gate once approved.
        </p>
        {state.qrCodeToken && (
          <div className="bg-white rounded-lg p-4 inline-block">
            <QRCodeSVG value={state.qrCodeToken} size={200} level="M" includeMargin />
          </div>
        )}
        <p className="text-xs font-mono text-slate-400 break-all">
          {state.qrCodeToken}
        </p>
        <button
          onClick={onReset}
          className="w-full rounded-lg bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center space-y-4">
      <h2 className="text-3xl font-bold">✓ Welcome, {state.visitorName}</h2>
      <p className="text-sm text-slate-300">You are checked in.</p>
      <button
        onClick={onReset}
        className="w-full rounded-lg bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-medium"
      >
        Next visitor
      </button>
    </div>
  );
}
