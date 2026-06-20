'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

interface Schedule {
  id: string;
  name: string;
  report: string;
  groupBy: string | null;
  rangePreset: string;
  frequency: string;
  hourUtc: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  recipients: string;
  isActive: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  nextRunAt: string | null;
}

const REPORT_OPTS = [
  'visits',
  'workforce',
  'contractors',
  'branches',
  'users',
  'materials',
  'incidents',
  'audit',
  'vehicles',
  'gate-activity',
];
const PRESET_OPTS = [
  { v: 'thisMonth', l: 'This month' },
  { v: 'lastMonth', l: 'Last month' },
  { v: 'last7d', l: 'Last 7 days' },
  { v: 'last30d', l: 'Last 30 days' },
  { v: 'last90d', l: 'Last 90 days' },
  { v: 'ytd', l: 'This year' },
];
const FREQ_OPTS = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = {
  name: '',
  report: 'workforce',
  rangePreset: 'lastMonth',
  frequency: 'monthly',
  hourUtc: 6,
  dayOfWeek: 1,
  dayOfMonth: 1,
  recipients: '',
};

export function SchedulesPanel() {
  const [items, setItems] = useState<Schedule[] | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    apiGet<Schedule[]>('/reports/schedules/list').then(setItems).catch(() => setItems([]));
  }
  useEffect(load, []);

  async function create() {
    setError(null);
    setBusy('create');
    try {
      await apiPost('/reports/schedules', form);
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create schedule');
    } finally {
      setBusy(null);
    }
  }

  async function toggle(s: Schedule) {
    setBusy(s.id);
    try {
      await apiPut(`/reports/schedules/${s.id}`, { ...s, isActive: !s.isActive });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(null);
    }
  }

  async function runNow(s: Schedule) {
    setBusy(s.id);
    setNotice(null);
    setError(null);
    try {
      const res = await apiPost<{ status: string }>(`/reports/schedules/${s.id}/run`, {});
      setNotice(`"${s.name}": ${res.status}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run');
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: Schedule) {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;
    setBusy(s.id);
    try {
      await apiDelete(`/reports/schedules/${s.id}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(null);
    }
  }

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-white">Scheduled email reports</h3>
            <p className="text-sm text-zinc-400">Auto-deliver any report as a CSV attachment on a recurring cadence.</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New schedule
        </button>
      </div>

      {(error || notice) && (
        <div className={`px-5 py-3 text-sm border-b ${error ? 'text-red-200 bg-red-500/10 border-red-500/20' : 'text-emerald-200 bg-emerald-500/10 border-emerald-500/20'}`}>
          {error || notice}
        </div>
      )}

      {showForm && (
        <div className="p-5 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Name">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Monthly contractor hours"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </Field>
          <Field label="Report">
            <select value={form.report} onChange={(e) => set('report', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              {REPORT_OPTS.map((r) => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
            </select>
          </Field>
          <Field label="Date range">
            <select value={form.rangePreset} onChange={(e) => set('rangePreset', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              {PRESET_OPTS.map((p) => <option key={p.v} value={p.v} className="bg-slate-900">{p.l}</option>)}
            </select>
          </Field>
          <Field label="Frequency">
            <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              {FREQ_OPTS.map((f) => <option key={f} value={f} className="bg-slate-900">{f}</option>)}
            </select>
          </Field>
          {form.frequency === 'weekly' && (
            <Field label="Day of week">
              <select value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', +e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                {DOW.map((d, i) => <option key={d} value={i} className="bg-slate-900">{d}</option>)}
              </select>
            </Field>
          )}
          {(form.frequency === 'monthly' || form.frequency === 'quarterly' || form.frequency === 'annually') && (
            <Field label="Day of month (1–28)">
              <input type="number" min={1} max={28} value={form.dayOfMonth} onChange={(e) => set('dayOfMonth', +e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            </Field>
          )}
          <Field label="Hour (UTC)">
            <input type="number" min={0} max={23} value={form.hourUtc} onChange={(e) => set('hourUtc', +e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </Field>
          <Field label="Recipients (comma-separated)" wide>
            <input value={form.recipients} onChange={(e) => set('recipients', e.target.value)} placeholder="ops@acme.com, hr@acme.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </Field>
          <div className="flex items-end">
            <button onClick={create} disabled={busy === 'create'}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
              {busy === 'create' ? 'Saving…' : 'Create schedule'}
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="p-8 text-center text-zinc-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 text-sm">No schedules yet. Create one to auto-email a report.</div>
      ) : (
        <div className="divide-y divide-white/5">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-5 py-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{s.name}</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">{s.report}</span>
                  {!s.isActive && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">paused</span>}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {s.frequency}
                  {s.frequency === 'weekly' && ` · ${DOW[s.dayOfWeek ?? 1]}`}
                  {(s.frequency === 'monthly' || s.frequency === 'quarterly' || s.frequency === 'annually') && ` · day ${s.dayOfMonth ?? 1}`}
                  {` · ${String(s.hourUtc).padStart(2, '0')}:00 UTC · ${s.rangePreset} → ${s.recipients}`}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">
                  {s.nextRunAt ? `Next: ${new Date(s.nextRunAt).toLocaleString()}` : 'Next: —'}
                  {s.lastStatus ? ` · Last: ${s.lastStatus}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => runNow(s)} disabled={busy === s.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs disabled:opacity-50">
                  {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send now
                </button>
                <button onClick={() => toggle(s)} disabled={busy === s.id}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs disabled:opacity-50">
                  {s.isActive ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => remove(s)} disabled={busy === s.id}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-red-600/40 text-red-300 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
