'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { DashboardHeader } from '@/components/dashboard-header';
import { CheckCircle, AlertCircle, Copy, Camera, Download, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiGet, apiPost } from '@/lib/api';
import { WebcamCapture } from '@/components/webcam-capture';
import { downloadBadgePDF } from '@/lib/badge';
import { describeFace } from '@/lib/face-api-loader';
import { useI18n } from '@/lib/i18n';

interface Branch { id: string; name: string; location: string }
interface Host { id: string; fullName: string; email: string; role: string; branchId: string }
interface Visitor { id: string; fullName: string; phone: string }
interface Contractor { id: string; companyName: string }

const IN_HOUSE = '__inhouse__';

interface VisitResponse {
  id: string;
  qrCodeToken: string;
  status: string;
}

interface VisitorResponse {
  id: string;
}

export default function CheckInPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [type, setType] = useState<'VISITOR' | 'WORKER'>('VISITOR');

  const [form, setForm] = useState({
    // shared
    visitorName: '',
    visitorPhone: '',
    visitorEmail: '',
    visitorCompany: '',
    documentType: 'AADHAAR',
    documentNumber: '',
    purpose: '',
    branchId: '',
    hostId: '',
    vehicleNumber: '',
    expectedEntry: '',
    groupSize: '1',
    passKind: 'SINGLE',
    validUntil: '',
    maxEntries: '',
    // worker-only
    contractorId: '',
    skillCategory: '',
    medicalExpiry: '',
    policeVerified: false,
  });
  const [workerResult, setWorkerResult] = useState<{
    name: string;
    skill: string;
    contractor: string;
    action: string;
  } | null>(null);
  const [photo, setPhoto] = useState<string>('');

  const [qrToken, setQrToken] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [createdSnapshot, setCreatedSnapshot] = useState<null | {
    visitorName: string;
    visitorCompany: string;
    hostName: string;
    branchName: string;
    branchLocation: string;
    purpose: string;
    expectedEntry: string;
    vehicleNumber: string;
  }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      apiGet<Branch[]>('/admin/branches'),
      apiGet<Host[]>('/admin/hosts'),
      apiGet<Contractor[]>('/admin/contractors').catch(() => [] as Contractor[]),
    ])
      .then(([bs, hs, cs]) => {
        setBranches(bs);
        setHosts(hs);
        setContractors(cs.map((c) => ({ id: c.id, companyName: c.companyName })));
        if (bs.length === 1) setForm((f) => ({ ...f, branchId: bs[0].id }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load form data'));
  }, [isAuthenticated]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function ensureInHouseContractor(): Promise<string> {
    const inhouse = contractors.find((c) => /in.?house|internal|own/i.test(c.companyName));
    if (inhouse) return inhouse.id;
    // Create an in-house contractor on the fly so live occupancy can group it.
    const created = await apiPost<{ id: string; companyName: string }>('/admin/contractors', {
      companyName: 'In-house',
      gstNumber: `INHOUSE-${Date.now()}`,
    });
    setContractors((cs) => [...cs, { id: created.id, companyName: created.companyName }]);
    return created.id;
  }

  async function handleWorkerSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setWorkerResult(null);
    try {
      const contractorId =
        form.contractorId === IN_HOUSE
          ? await ensureInHouseContractor()
          : form.contractorId;
      if (!contractorId) throw new Error('Pick a contractor or choose In-house');
      const medExp = form.medicalExpiry
        ? new Date(form.medicalExpiry).toISOString()
        : new Date(Date.now() + 365 * 86_400_000).toISOString();
      const worker = await apiPost<{ id: string; fullName: string }>('/admin/workers', {
        contractorId,
        fullName: form.visitorName,
        phone: form.visitorPhone,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        skillCategory: form.skillCategory || 'General',
        medicalExpiry: medExp,
        policeVerified: form.policeVerified,
      });
      // Best-effort face enrol from captured photo
      if (photo) {
        (async () => {
          try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('image load failed'));
              img.src = photo;
            });
            const embedding = await describeFace(img);
            if (embedding) {
              await apiPost(`/face/enroll/worker/${worker.id}`, { embedding });
            }
          } catch {/* silent */}
        })();
      }
      // Immediate check-in for the walk-in flow
      let action = 'registered';
      try {
        const ci = await apiPost<{ action?: string }>('/gate/worker-check-in', {
          workerId: worker.id,
          gateId: 'web-gate-1',
          branchId: form.branchId || undefined,
        });
        action = ci?.action ?? 'checked-in';
      } catch (e) {
        // compliance gate may block (no police verify etc) — surface it but keep registration
        action = e instanceof Error ? `registered (gate: ${e.message})` : 'registered';
      }
      const contractor =
        contractors.find((c) => c.id === contractorId)?.companyName ?? 'In-house';
      setWorkerResult({
        name: worker.fullName,
        skill: form.skillCategory || 'General',
        contractor,
        action,
      });
      setForm((f) => ({
        ...f,
        visitorName: '', visitorPhone: '', documentNumber: '',
        skillCategory: '', medicalExpiry: '', policeVerified: false,
      }));
      setPhoto('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register worker');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    if (type === 'WORKER') return handleWorkerSubmit(e);
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setQrToken(null);
    try {
      const visitor = await apiPost<VisitorResponse>('/visitors', {
        fullName: form.visitorName,
        phone: form.visitorPhone,
        email: form.visitorEmail || undefined,
        company: form.visitorCompany || undefined,
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        photoBase64: photo || undefined,
      });

      // Best-effort: if a photo was captured, also compute face embedding
      // and enroll it for recognition. Never block visit creation on this.
      if (photo) {
        (async () => {
          try {
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('image load failed'));
              img.src = photo;
            });
            const embedding = await describeFace(img);
            if (embedding) {
              await apiPost(`/face/enroll/visitor/${visitor.id}`, { embedding });
            }
          } catch {
            /* face-api unavailable or no face detected — silent */
          }
        })();
      }

      const visit = await apiPost<VisitResponse>('/visitors/visit', {
        visitorId: visitor.id,
        branchId: form.branchId,
        hostId: form.hostId,
        purpose: form.purpose,
        expectedEntry: form.expectedEntry || new Date().toISOString(),
        vehicleNumber: form.vehicleNumber || undefined,
        groupSize: Math.max(1, Math.min(20, parseInt(form.groupSize || '1', 10) || 1)),
        passKind: form.passKind,
        validUntil: form.passKind !== 'SINGLE' && form.validUntil ? form.validUntil : undefined,
        maxEntries:
          form.passKind === 'MULTI_ENTRY' && form.maxEntries
            ? Math.max(1, parseInt(form.maxEntries, 10) || 1)
            : undefined,
      });

      setQrToken(visit.qrCodeToken);
      setVisitId(visit.id);
      const branch = branches.find((b) => b.id === form.branchId);
      const host = hosts.find((h) => h.id === form.hostId);
      setCreatedSnapshot({
        visitorName: form.visitorName,
        visitorCompany: form.visitorCompany,
        hostName: host?.fullName ?? '—',
        branchName: branch?.name ?? '—',
        branchLocation: branch?.location ?? '',
        purpose: form.purpose,
        expectedEntry: form.expectedEntry || new Date().toISOString(),
        vehicleNumber: form.vehicleNumber,
      });
      setForm({
        ...form,
        visitorName: '',
        visitorPhone: '',
        visitorEmail: '',
        visitorCompany: '',
        documentNumber: '',
        purpose: '',
        vehicleNumber: '',
        expectedEntry: '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create visit');
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

  return (
    <main className="min-h-screen">
      <DashboardHeader />

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">{t('checkin.title')}</h2>
          <p className="text-zinc-400">{t('checkin.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-4"
          >
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Who is arriving?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('VISITOR')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === 'VISITOR'
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Visitor
                </button>
                <button
                  type="button"
                  onClick={() => setType('WORKER')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === 'WORKER'
                      ? 'bg-brand-600 text-white border-brand-500'
                      : 'bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Contract Worker
                </button>
              </div>
              {type === 'WORKER' && (
                <p className="text-xs text-zinc-500 mt-1.5">
                  Worker is registered &amp; checked-in immediately. Photo enrols their face for future
                  scan-in at the gate.
                </p>
              )}
            </div>

            {type === 'WORKER' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-zinc-400 mb-1">Contractor / Company *</label>
                  <select
                    required
                    value={form.contractorId}
                    onChange={(e) => set('contractorId', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    <option value={IN_HOUSE}>🏠 Our own / In-house</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Skill / Role *</label>
                  <input
                    type="text"
                    required
                    value={form.skillCategory}
                    onChange={(e) => set('skillCategory', e.target.value)}
                    placeholder="Electrician, Welder, Cleaner…"
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Medical expiry</label>
                  <input
                    type="date"
                    value={form.medicalExpiry}
                    onChange={(e) => set('medicalExpiry', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="col-span-2 inline-flex items-center gap-2 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={form.policeVerified}
                    onChange={(e) => set('policeVerified', e.target.checked)}
                  />
                  Police verified (required for gate entry)
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {type === 'WORKER' ? 'Worker name *' : 'Visitor name *'}
              </label>
              <input
                type="text"
                required
                value={form.visitorName}
                onChange={(e) => set('visitorName', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={form.visitorPhone}
                  onChange={(e) => set('visitorPhone', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {type === 'VISITOR' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.visitorEmail}
                    onChange={(e) => set('visitorEmail', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            {type === 'VISITOR' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Company</label>
                <input
                  type="text"
                  value={form.visitorCompany}
                  onChange={(e) => set('visitorCompany', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Vehicle number</label>
                <input
                  type="text"
                  value={form.vehicleNumber}
                  onChange={(e) => set('vehicleNumber', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            )}
            {type === 'VISITOR' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {t('checkin.groupSize')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.groupSize}
                  onChange={(e) => set('groupSize', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-zinc-500 mt-1">{t('checkin.groupSizeHint')}</p>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('checkin.passKind')}</label>
                <select
                  value={form.passKind}
                  onChange={(e) => set('passKind', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SINGLE">{t('checkin.passSingle')}</option>
                  <option value="MULTI_ENTRY">{t('checkin.passMultiEntry')}</option>
                  <option value="MULTI_DAY">{t('checkin.passMultiDay')}</option>
                  <option value="RECURRING">{t('checkin.passRecurring')}</option>
                </select>
              </div>
            </div>
            )}
            {type === 'VISITOR' && form.passKind !== 'SINGLE' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('checkin.validUntil')}</label>
                  <input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => set('validUntil', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {form.passKind === 'MULTI_ENTRY' && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">{t('checkin.maxEntries')}</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="∞"
                      value={form.maxEntries}
                      onChange={(e) => set('maxEntries', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Document type</label>
                <select
                  value={form.documentType}
                  onChange={(e) => set('documentType', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AADHAAR">Aadhaar</option>
                  <option value="PAN">PAN</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving Licence</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Document number *</label>
                <input
                  type="text"
                  required
                  value={form.documentNumber}
                  onChange={(e) => set('documentNumber', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {type === 'VISITOR' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Purpose *</label>
                <textarea
                  required
                  rows={2}
                  value={form.purpose}
                  onChange={(e) => set('purpose', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Branch *</label>
                <select
                  required
                  value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Branch --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.location}
                    </option>
                  ))}
                </select>
              </div>
              {type === 'VISITOR' && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Host *</label>
                  <select
                    required
                    value={form.hostId}
                    onChange={(e) => set('hostId', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Host --</option>
                    {hosts.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.fullName} ({h.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {type === 'VISITOR' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Expected entry</label>
                <input
                  type="datetime-local"
                  value={form.expectedEntry}
                  onChange={(e) => set('expectedEntry', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
            >
              {submitting
                ? type === 'WORKER' ? 'Registering worker…' : 'Creating visit…'
                : type === 'WORKER' ? 'Register + Check-in Worker' : 'Create Visit + Generate QR'}
            </button>
          </form>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" /> Visitor photo (optional)
              </h3>
              <WebcamCapture onCapture={setPhoto} />
            </div>

            {workerResult ? (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                  <h3 className="text-xl font-bold text-white">Worker {workerResult.action}</h3>
                </div>
                <p className="text-2xl font-semibold text-white">{workerResult.name}</p>
                <p className="text-sm text-zinc-300 mt-1">
                  {workerResult.skill} · <span className="text-brand-300">{workerResult.contractor}</span>
                </p>
                <p className="text-xs text-zinc-400 mt-4">
                  Their face (if captured) is now enrolled for instant recognition at the gate.
                </p>
                <button
                  type="button"
                  onClick={() => setWorkerResult(null)}
                  className="mt-4 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
                >
                  Register another
                </button>
              </div>
            ) : qrToken ? (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                  <h3 className="text-xl font-bold text-white">Visit created</h3>
                </div>
                <div className="bg-white rounded-lg p-4 flex items-center justify-center mb-4">
                  <QRCodeSVG value={qrToken} size={220} level="M" includeMargin />
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-mono text-blue-100 break-all">{qrToken}</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(qrToken)}
                    className="p-2 rounded hover:bg-blue-500/20 text-blue-300 shrink-0"
                    title="Copy token"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {visitId && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/pass/${visitId}`;
                        navigator.clipboard.writeText(url);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                      title="Copy public pass link to clipboard"
                    >
                      <Share2 className="w-4 h-4" /> Copy pass link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!createdSnapshot || !qrToken) return;
                        downloadBadgePDF({
                          visitorName: createdSnapshot.visitorName,
                          visitorCompany: createdSnapshot.visitorCompany || null,
                          hostName: createdSnapshot.hostName,
                          branchName: createdSnapshot.branchName,
                          branchLocation: createdSnapshot.branchLocation,
                          purpose: createdSnapshot.purpose,
                          expectedEntry: createdSnapshot.expectedEntry,
                          vehicleNumber: createdSnapshot.vehicleNumber || null,
                          qrCodeToken: qrToken,
                        });
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                    >
                      <Download className="w-4 h-4" /> Badge PDF
                    </button>
                  </div>
                )}
                <p className="text-xs text-zinc-400 mt-3">
                  Pass link works on any phone (no login). Scan with the kiosk or paste token into the mobile app.
                  <br />
                  Visit ID: <span className="font-mono">{visitId}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl text-center">
                <AlertCircle className="w-10 h-10 text-zinc-400 mb-3 mx-auto" />
                <p className="text-sm text-zinc-400">
                  Submit the form to create the visit and generate a scannable QR.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
