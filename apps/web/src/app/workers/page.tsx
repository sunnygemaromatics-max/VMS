'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { Plus, ShieldCheck, ShieldOff, HardHat, LogIn, LogOut, Upload, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGet, apiPost } from '@/lib/api';
import { FaceEnrollButton } from '@/components/face-enroll-button';
import { useI18n } from '@/lib/i18n';

export default function WorkersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading…</div>
        </div>
      }
    >
      <WorkersPageInner />
    </Suspense>
  );
}

interface Contractor {
  id: string;
  companyName: string;
}

interface Worker {
  id: string;
  fullName: string;
  phone: string;
  skillCategory: string;
  documentType: string;
  documentNumber: string;
  medicalExpiry: string;
  policeVerified: boolean;
  isActive: boolean;
  qrCodeToken: string | null;
  contractor?: { companyName: string };
}

function WorkersPageInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const contractorFilter = search.get('contractorId') || '';

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [openAttendance, setOpenAttendance] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [qrFor, setQrFor] = useState<Worker | null>(null);

  const [form, setForm] = useState({
    contractorId: contractorFilter,
    fullName: '',
    phone: '',
    documentType: 'AADHAAR',
    documentNumber: '',
    skillCategory: '',
    medicalExpiry: '',
    policeVerified: false,
    pfNumber: '',
    esicNumber: '',
    hourlyRate: '',
    enrollFace: true,
  });
  const [enrollForId, setEnrollForId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    apiGet<Contractor[]>('/admin/contractors').then((cs) =>
      setContractors(cs.map((c: any) => ({ id: c.id, companyName: c.companyName })))
    );
  }, [isAuthenticated]);

  async function loadWorkers() {
    try {
      const path = contractorFilter
        ? `/admin/workers?contractorId=${encodeURIComponent(contractorFilter)}`
        : '/admin/workers';
      const [ws, atts] = await Promise.all([
        apiGet<Worker[]>(path),
        apiGet<any[]>('/admin/attendance').catch(() => []),
      ]);
      setWorkers(ws);
      const open: Record<string, string> = {};
      for (const a of atts) {
        if (a.checkOut === null) open[a.workerId] = a.id;
      }
      setOpenAttendance(open);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workers');
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadWorkers();
  }, [isAuthenticated, contractorFilter]);

  async function toggleAttendance(w: Worker) {
    setBusyId(w.id);
    setError('');
    try {
      const path = openAttendance[w.id] ? '/gate/worker-check-out' : '/gate/worker-check-in';
      const body: any = { workerId: w.id };
      if (!openAttendance[w.id]) body.gateId = 'web-gate-1';
      await apiPost(path, body);
      await loadWorkers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) return;
    setImportBusy(true);
    setImportResult(null);
    setError('');
    try {
      const csv = await csvFile.text();
      const r = await apiPost<any>('/admin/workers/bulk-import', { csv });
      setImportResult(r);
      await loadWorkers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload: any = { ...form };
      delete payload.enrollFace;
      if (form.hourlyRate) payload.hourlyRate = parseFloat(form.hourlyRate);
      else delete payload.hourlyRate;
      const created = await apiPost<{ id: string }>('/admin/workers', payload);
      const wantEnroll = form.enrollFace;
      setForm({
        contractorId: contractorFilter,
        fullName: '',
        phone: '',
        documentType: 'AADHAAR',
        documentNumber: '',
        skillCategory: '',
        medicalExpiry: '',
        policeVerified: false,
        pfNumber: '',
        esicNumber: '',
        hourlyRate: '',
        enrollFace: true,
      });
      setShowForm(false);
      await loadWorkers();
      // One-step enroll: pop the camera for the worker we just created.
      if (wantEnroll && created?.id) setEnrollForId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading…</div>
      </div>
    );
  }

  const isMedicalExpired = (iso: string) => new Date(iso) < new Date();

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{t('workers.title')}</h2>
            <p className="text-zinc-400">
              {contractorFilter ? t('workers.subtitleFiltered') : t('workers.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
              title="Bulk import workers from CSV"
            >
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('workers.add')}
            </button>
          </div>
        </div>

        {showImport && (
          <form onSubmit={handleImport} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-6 space-y-3">
            <p className="text-sm text-zinc-300">
              Upload a CSV with header row. Required columns:{' '}
              <code className="text-blue-300">contractorId, fullName, phone, documentNumber, skillCategory, medicalExpiry</code>.{' '}
              Optional: <code className="text-blue-300">documentType, policeVerified, pfNumber, esicNumber, hourlyRate</code>.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-zinc-300 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:hover:bg-blue-700 file:cursor-pointer"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!csvFile || importBusy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {importBusy ? 'Importing…' : 'Import'}
              </button>
              <button type="button" onClick={() => { setShowImport(false); setImportResult(null); }} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">
                Cancel
              </button>
            </div>
            {importResult && (
              <div className="mt-3 p-3 rounded-lg bg-slate-900/60 border border-white/10 text-xs">
                <p className="text-white">
                  ✓ {importResult.created} created · ✗ {importResult.failed} failed (of {importResult.total})
                </p>
                {importResult.results.filter((r: any) => !r.ok).slice(0, 5).map((r: any) => (
                  <p key={r.row} className="text-red-300">Row {r.row}: {r.error}</p>
                ))}
              </div>
            )}
          </form>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <select
              value={form.contractorId}
              onChange={(e) => setForm({ ...form, contractorId: e.target.value })}
              required
              className="px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Contractor --</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Skill category (Electrician, Welder…)"
              value={form.skillCategory}
              onChange={(e) => setForm({ ...form, skillCategory: e.target.value })}
              required
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={form.documentType}
              onChange={(e) => setForm({ ...form, documentType: e.target.value })}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="AADHAAR">Aadhaar</option>
              <option value="PAN">PAN</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVING_LICENSE">Driving Licence</option>
            </select>
            <input
              type="text"
              placeholder="Document number"
              value={form.documentNumber}
              onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
              required
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Medical expiry</label>
              <input
                type="date"
                value={form.medicalExpiry}
                onChange={(e) => setForm({ ...form, medicalExpiry: e.target.value })}
                required
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={form.policeVerified}
                onChange={(e) => setForm({ ...form, policeVerified: e.target.checked })}
              />
              Police verified
            </label>
            <label className="flex items-center gap-2 text-white text-sm">
              <input
                type="checkbox"
                checked={form.enrollFace}
                onChange={(e) => setForm({ ...form, enrollFace: e.target.checked })}
              />
              Capture face now (for face-gate recognition)
            </label>

            <input
              type="text"
              placeholder="PF number (optional)"
              value={form.pfNumber}
              onChange={(e) => setForm({ ...form, pfNumber: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="ESIC number (optional)"
              value={form.esicNumber}
              onChange={(e) => setForm({ ...form, esicNumber: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Hourly rate (₹)"
              value={form.hourlyRate}
              onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save Worker'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError('');
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
          {!workers && <div className="p-6 text-zinc-500">Loading…</div>}
          {workers && workers.length === 0 && (
            <div className="p-8 text-center text-zinc-500 text-sm">No workers yet.</div>
          )}
          {workers && workers.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="text-left p-4">Worker</th>
                  <th className="text-left p-4">Contractor</th>
                  <th className="text-left p-4">Skill</th>
                  <th className="text-left p-4">Medical</th>
                  <th className="text-left p-4">Police</th>
                  <th className="text-left p-4">On site</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <HardHat className="w-4 h-4 text-orange-400" />
                        <div>
                          <p className="font-medium text-white">{w.fullName}</p>
                          <p className="text-xs text-zinc-500">{w.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-zinc-300">{w.contractor?.companyName ?? '—'}</td>
                    <td className="p-4 text-zinc-300">{w.skillCategory}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          isMedicalExpired(w.medicalExpiry)
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}
                      >
                        {isMedicalExpired(w.medicalExpiry) ? 'Expired' : 'Valid'} ·{' '}
                        {new Date(w.medicalExpiry).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      {w.policeVerified ? (
                        <ShieldCheck className="w-5 h-5 text-green-500" />
                      ) : (
                        <ShieldOff className="w-5 h-5 text-red-500" />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {openAttendance[w.id] ? (
                          <button
                            onClick={() => toggleAttendance(w)}
                            disabled={busyId === w.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-500/15 hover:bg-zinc-500/25 text-zinc-200 text-xs font-medium disabled:opacity-50"
                            title="Check out"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Check out
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleAttendance(w)}
                            disabled={busyId === w.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-600/80 hover:bg-green-600 text-white text-xs font-medium disabled:opacity-50"
                            title="Mark on site"
                          >
                            <LogIn className="w-3.5 h-3.5" /> On site
                          </button>
                        )}
                        <FaceEnrollButton kind="worker" id={w.id} label="Face" />
                        {w.qrCodeToken && (
                          <button
                            onClick={() => setQrFor(w)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-indigo-600/80 hover:bg-indigo-600 text-white"
                            title="Show worker QR badge"
                          >
                            <QrCode className="w-3.5 h-3.5" /> QR
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {qrFor && qrFor.qrCodeToken && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setQrFor(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">{qrFor.fullName}</h3>
            <p className="text-xs text-zinc-400 mb-4">
              {qrFor.skillCategory} · {qrFor.contractor?.companyName}
            </p>
            <div className="bg-white rounded-xl p-5 flex items-center justify-center">
              <QRCodeSVG value={qrFor.qrCodeToken} size={240} level="M" includeMargin />
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-3 text-center break-all">
              {qrFor.qrCodeToken}
            </p>
            <p className="text-xs text-zinc-500 mt-2 text-center">
              Print and stick on the worker's hard-hat. Scan at the gate to toggle in/out.
            </p>
            <button
              onClick={() => setQrFor(null)}
              className="mt-4 w-full px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* One-step enroll: opens the camera for a freshly-created worker */}
      {enrollForId && (
        <FaceEnrollButton
          kind="worker"
          id={enrollForId}
          autoStart
          onEnrolled={loadWorkers}
          onClose={() => setEnrollForId(null)}
        />
      )}
    </main>
  );
}
