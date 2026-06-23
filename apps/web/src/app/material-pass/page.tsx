'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Camera,
  CarFront,
  CheckCircle2,
  ClipboardList,
  Crosshair,
  Download,
  FileSpreadsheet,
  FileText,
  HardHat,
  Package,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Video,
  VideoOff,
  Truck,
  UserSquare2,
} from 'lucide-react';
import { DashboardHeader } from '@/components/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { downloadCSV } from '@/lib/csv';
import { downloadPDF } from '@/lib/pdf';
import { downloadXLSX } from '@/lib/xlsx';

type Branch = { id: string; name: string; location: string };
type Status =
  | 'PENDING'
  | 'SECURITY_IN'
  | 'WEIGHMENT'
  | 'STORE_ACCEPTED'
  | 'REJECTED'
  | 'GATE_OUT'
  | 'SECURITY_VERIFIED'
  | 'LOADED';
type EntryType = 'RECEIPT' | 'DISPATCH';

type Driver = {
  id: string;
  fullName: string;
  mobile: string;
  licenseNumber: string;
  licenseExpiry?: string | null;
  transporterName?: string | null;
  listStatus: 'NORMAL' | 'WHITELISTED' | 'BLACKLISTED';
  policeVerification: boolean;
  linkedVehicleNumbers?: string[];
  _count?: { movements: number };
};

type Vehicle = {
  id: string;
  vehicleNumber: string;
  ownerName?: string | null;
  transporterName?: string | null;
  vehicleType: 'TRUCK' | 'TANKER' | 'TEMPO' | 'CONTAINER' | 'OTHER';
  insuranceExpiry?: string | null;
  pucExpiry?: string | null;
  fitnessExpiry?: string | null;
  listStatus: 'NORMAL' | 'WHITELISTED' | 'BLACKLISTED';
  _count?: { movements: number };
};

type Entry = {
  id: string;
  referenceNo: string;
  entryType: EntryType;
  status: Status;
  enteredAt: string;
  gateInAt?: string | null;
  gateOutAt?: string | null;
  branchId: string;
  branch?: { id: string; name: string; location: string };
  vehicleMasterId?: string | null;
  driverMasterId?: string | null;
  vehicleNumber: string;
  anprDetectedNumber?: string | null;
  anprCorrectedNumber?: string | null;
  anprConfidence?: number | null;
  anprImageData?: string | null;
  driverName: string;
  driverMobile: string;
  driverLicenseNumber: string;
  driverPhotoData?: string | null;
  transporterName?: string | null;
  supplierName?: string | null;
  customerName?: string | null;
  poNumber?: string | null;
  invoiceNumber?: string | null;
  deliveryChallanNo?: string | null;
  lrNumber?: string | null;
  materialName: string;
  materialCategory?: string | null;
  quantity: number;
  unit: string;
  plantLocation?: string | null;
  destination?: string | null;
  approvedBy?: string | null;
  securityRemarks?: string | null;
  storeRemarks?: string | null;
  dispatchRemarks?: string | null;
  beforePhotoData?: string | null;
  afterPhotoData?: string | null;
  manualOverrideReason?: string | null;
  alerts?: string[];
  insidePlant?: boolean;
  qrToken?: string;
  events?: Array<{ id: string; action: string; notes?: string | null; createdAt: string }>;
};

type DashboardData = {
  cards: {
    todaysReceipts: number;
    todaysDispatches: number;
    vehiclesInsidePlant: number;
    pendingGateOut: number;
    blacklistedAlerts: number;
    driverRepeatVisits: number;
    materialQuantitySummary: number;
  };
  materialSummary: Record<string, number>;
};

type ReportResult = {
  totals: {
    count: number;
    receipts: number;
    dispatches: number;
    openEntries: number;
    blacklistedAttempts: number;
    quantity: number;
  };
  rows: Record<string, unknown>[];
};

type TabKey = 'overview' | 'entries' | 'drivers' | 'vehicles' | 'reports';

const RECEIPT_FLOW: Status[] = ['PENDING', 'SECURITY_IN', 'WEIGHMENT', 'STORE_ACCEPTED', 'GATE_OUT'];
const DISPATCH_FLOW: Status[] = ['PENDING', 'SECURITY_VERIFIED', 'LOADED', 'GATE_OUT'];

const EMPTY_ENTRY = {
  branchId: '',
  entryType: 'RECEIPT' as EntryType,
  status: 'PENDING' as Status,
  vehicleNumber: '',
  anprDetectedNumber: '',
  anprCorrectedNumber: '',
  anprConfidence: '0.82',
  driverName: '',
  driverMobile: '',
  driverLicenseNumber: '',
  driverLicenseExpiry: '',
  driverAddress: '',
  transporterName: '',
  supplierName: '',
  customerName: '',
  poNumber: '',
  invoiceNumber: '',
  deliveryChallanNo: '',
  lrNumber: '',
  materialName: '',
  materialCategory: '',
  quantity: '1',
  unit: 'Kg',
  plantLocation: '',
  destination: '',
  approvedBy: '',
  securityRemarks: '',
  storeRemarks: '',
  dispatchRemarks: '',
  manualOverrideReason: '',
  policeVerification: false,
  vehicleType: 'TRUCK',
  beforePhotoData: '',
  afterPhotoData: '',
  anprImageData: '',
  driverPhotoData: '',
  driverIdProofData: '',
  rcDocumentData: '',
  ownerName: '',
  insuranceExpiry: '',
  pucExpiry: '',
  fitnessExpiry: '',
  vehicleListStatus: 'NORMAL',
  driverListStatus: 'NORMAL',
};

const EMPTY_DRIVER = {
  fullName: '',
  mobile: '',
  licenseNumber: '',
  licenseExpiry: '',
  address: '',
  transporterName: '',
  listStatus: 'NORMAL',
  policeVerification: false,
  photoData: '',
  idProofData: '',
  notes: '',
};

const EMPTY_VEHICLE = {
  vehicleNumber: '',
  ownerName: '',
  transporterName: '',
  vehicleType: 'TRUCK',
  insuranceExpiry: '',
  pucExpiry: '',
  fitnessExpiry: '',
  listStatus: 'NORMAL',
  rcDocumentData: '',
  notes: '',
};

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

function formatStampDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

function makeCaptureFilename(label: string) {
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safe || 'capture'}-${stamp}.jpg`;
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function saveCaptureLocally(label: string, dataUrl: string, locationText: string) {
  const record = {
    label,
    dataUrl,
    locationText,
    capturedAt: new Date().toISOString(),
  };
  try {
    const key = 'gem-material-gate-captures';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const next = [record, ...existing].slice(0, 40);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  downloadDataUrl(makeCaptureFilename(label), dataUrl);
}

async function stampImageWithMeta(
  source: string,
  label: string,
  locationText: string,
  mimeType = 'image/jpeg',
) {
  const image = new Image();
  image.src = source;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to stamp image');

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const lines = [
    `Gem Aromatics • ${label}`,
    `Time: ${formatStampDate()}`,
    `Geo: ${locationText}`,
  ];

  const fontSize = Math.max(18, Math.round(canvas.width / 38));
  const lineHeight = Math.round(fontSize * 1.4);
  const pad = Math.round(fontSize * 0.7);
  ctx.font = `600 ${fontSize}px Arial`;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxHeight = lineHeight * lines.length + pad * 1.2;
  const y = canvas.height - boxHeight - pad;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
  ctx.fillRect(pad, y, textWidth + pad * 2, boxHeight);
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, index) => {
    ctx.fillText(line, pad * 1.5, y + pad + fontSize + index * lineHeight);
  });

  return canvas.toDataURL(mimeType, 0.92);
}

function statusTone(status: Status) {
  if (status === 'GATE_OUT' || status === 'STORE_ACCEPTED' || status === 'LOADED') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (status === 'REJECTED') return 'bg-red-500/10 text-red-300 border-red-500/20';
  if (status === 'WEIGHMENT' || status === 'SECURITY_VERIFIED' || status === 'SECURITY_IN') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
}

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

async function printGatePass(entry: Entry) {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const svg = renderToStaticMarkup(React.createElement(QRCodeSVG, { value: entry.referenceNo, size: 132, includeMargin: true }));
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>${entry.referenceNo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; max-width: 760px; margin: 0 auto; }
          .head { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
          .meta { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 20px; margin-top:20px; }
          .field { border:1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
          .label { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.08em; }
          .value { font-size:15px; font-weight:600; margin-top:4px; }
          .line { margin-top:32px; display:flex; justify-content:space-between; gap:32px; }
          .sig { flex:1; border-top:1px solid #94a3b8; padding-top:8px; font-size:12px; color:#475569; }
          img.photo { width: 120px; height: 120px; object-fit: cover; border-radius: 14px; border:1px solid #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="head">
            <div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Gem Aromatics Group</div>
              <h1 style="margin:8px 0 4px;font-size:28px;">Material Gate Pass</h1>
              <div style="font-size:14px;color:#475569;">${entry.entryType} • ${entry.referenceNo}</div>
            </div>
            <div>${svg}</div>
          </div>
          <div class="meta">
            <div class="field"><div class="label">Vehicle</div><div class="value">${display(entry.vehicleNumber)}</div></div>
            <div class="field"><div class="label">Driver</div><div class="value">${display(entry.driverName)}</div></div>
            <div class="field"><div class="label">Mobile</div><div class="value">${display(entry.driverMobile)}</div></div>
            <div class="field"><div class="label">License</div><div class="value">${display(entry.driverLicenseNumber)}</div></div>
            <div class="field"><div class="label">Material</div><div class="value">${display(entry.materialName)}</div></div>
            <div class="field"><div class="label">Quantity</div><div class="value">${display(entry.quantity)} ${display(entry.unit)}</div></div>
            <div class="field"><div class="label">Supplier / Customer</div><div class="value">${display(entry.supplierName || entry.customerName)}</div></div>
            <div class="field"><div class="label">Gate In</div><div class="value">${display(entry.gateInAt ? new Date(entry.gateInAt).toLocaleString() : entry.enteredAt ? new Date(entry.enteredAt).toLocaleString() : '—')}</div></div>
            <div class="field"><div class="label">Location</div><div class="value">${display(entry.plantLocation || entry.branch?.name)}</div></div>
            <div class="field"><div class="label">Status</div><div class="value">${display(entry.status.replace(/_/g, ' '))}</div></div>
          </div>
          <div style="margin-top:24px; display:flex; gap:24px; align-items:flex-start;">
            ${entry.driverPhotoData ? `<img class="photo" src="${entry.driverPhotoData}" alt="Driver photo" />` : ''}
            <div style="font-size:14px; color:#475569;">
              <div><strong>Invoice:</strong> ${display(entry.invoiceNumber)}</div>
              <div><strong>LR:</strong> ${display(entry.lrNumber)}</div>
              <div><strong>Approved By:</strong> ${display(entry.approvedBy)}</div>
              <div><strong>Transporter:</strong> ${display(entry.transporterName)}</div>
            </div>
          </div>
          <div class="line">
            <div class="sig">Security Signature</div>
            <div class="sig">Store / Dispatch Signature</div>
          </div>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function MaterialPassPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [entryForm, setEntryForm] = useState(EMPTY_ENTRY);
  const [driverForm, setDriverForm] = useState(EMPTY_DRIVER);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [entrySearch, setEntrySearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [reportFilters, setReportFilters] = useState({
    from: '',
    to: '',
    branchId: '',
    entryType: '',
    status: '',
    vehicleNumber: '',
    driverName: '',
    supplierName: '',
    customerName: '',
    materialName: '',
    transporterName: '',
    location: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/auth/login');
  }, [isAuthenticated, isLoading, router]);

  async function loadBranches() {
    setBranches(await apiGet<Branch[]>('/admin/branches'));
  }

  async function loadDashboard(branchId?: string) {
    setDashboard(await apiGet<DashboardData>(`/material-pass/dashboard${branchId ? `?branchId=${branchId}` : ''}`));
  }

  async function loadEntries() {
    const q = new URLSearchParams();
    if (entrySearch.trim()) q.set('search', entrySearch.trim());
    setEntries(await apiGet<Entry[]>(`/material-pass/entries${q.toString() ? `?${q}` : ''}`));
  }

  async function loadDrivers() {
    const q = new URLSearchParams();
    if (driverSearch.trim()) q.set('search', driverSearch.trim());
    setDrivers(await apiGet<Driver[]>(`/material-pass/drivers${q.toString() ? `?${q}` : ''}`));
  }

  async function loadVehicles() {
    const q = new URLSearchParams();
    if (vehicleSearch.trim()) q.set('search', vehicleSearch.trim());
    setVehicles(await apiGet<Vehicle[]>(`/material-pass/vehicles-master${q.toString() ? `?${q}` : ''}`));
  }

  async function loadReport() {
    const q = new URLSearchParams();
    Object.entries(reportFilters).forEach(([key, value]) => {
      if (value) q.set(key, value);
    });
    setReport(await apiGet<ReportResult>(`/material-pass/reports${q.toString() ? `?${q}` : ''}`));
  }

  async function loadAll() {
    setError(null);
    try {
      await Promise.all([loadBranches(), loadDashboard(), loadEntries(), loadDrivers(), loadVehicles(), loadReport()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load material gate module');
    }
  }

  useEffect(() => {
    if (isAuthenticated) loadAll();
  }, [isAuthenticated]);

  async function autofillFromLookup() {
    const q = new URLSearchParams();
    if (entryForm.vehicleNumber) q.set('vehicleNumber', entryForm.vehicleNumber);
    if (entryForm.driverMobile) q.set('mobile', entryForm.driverMobile);
    if (entryForm.driverLicenseNumber) q.set('licenseNumber', entryForm.driverLicenseNumber);
    try {
      const result = await apiGet<{ vehicle?: Vehicle | null; driver?: Driver | null; openEntry?: Entry | null }>(`/material-pass/lookup?${q}`);
      if (result.openEntry) setError(`Vehicle already has an open entry: ${result.openEntry.referenceNo}`);
      if (result.vehicle) {
        setEntryForm((current) => ({
          ...current,
          vehicleNumber: result.vehicle?.vehicleNumber ?? current.vehicleNumber,
          transporterName: result.vehicle?.transporterName ?? current.transporterName,
          ownerName: result.vehicle?.ownerName ?? current.ownerName,
          vehicleType: result.vehicle?.vehicleType ?? current.vehicleType,
        }));
      }
      if (result.driver) {
        setEntryForm((current) => ({
          ...current,
          driverName: result.driver?.fullName ?? current.driverName,
          driverMobile: result.driver?.mobile ?? current.driverMobile,
          driverLicenseNumber: result.driver?.licenseNumber ?? current.driverLicenseNumber,
          driverLicenseExpiry: result.driver?.licenseExpiry ? result.driver.licenseExpiry.slice(0, 10) : current.driverLicenseExpiry,
          transporterName: result.driver?.transporterName ?? current.transporterName,
          driverListStatus: result.driver?.listStatus ?? current.driverListStatus,
          policeVerification: result.driver?.policeVerification ?? current.policeVerification,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
    }
  }

  async function submitEntry() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...entryForm,
        quantity: Number(entryForm.quantity),
      };
      const saved = selectedEntry
        ? await apiPut<Entry>(`/material-pass/entries/${selectedEntry.id}`, payload)
        : await apiPost<Entry>('/material-pass/entries', payload);
      setSelectedEntry(saved);
      setEntryForm(mapEntryToForm(saved));
      await Promise.all([loadEntries(), loadDashboard(), loadReport(), loadDrivers(), loadVehicles()]);
      setActiveTab('entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setBusy(false);
    }
  }

  async function updateEntryStatus(status: Status) {
    if (!selectedEntry) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await apiPost<Entry>(`/material-pass/entries/${selectedEntry.id}/status`, {
        status,
        afterPhotoData: entryForm.afterPhotoData,
        securityRemarks: entryForm.securityRemarks,
        storeRemarks: entryForm.storeRemarks,
        dispatchRemarks: entryForm.dispatchRemarks,
        manualOverrideReason: entryForm.manualOverrideReason,
      });
      setSelectedEntry(saved);
      setEntryForm(mapEntryToForm(saved));
      await Promise.all([loadEntries(), loadDashboard(), loadReport()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  }

  async function saveDriver() {
    setBusy(true);
    setError(null);
    try {
      const saved = selectedDriver
        ? await apiPut<Driver>(`/material-pass/drivers/${selectedDriver.id}`, driverForm)
        : await apiPost<Driver>('/material-pass/drivers', driverForm);
      setSelectedDriver(saved);
      setDriverForm(mapDriverToForm(saved));
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save driver');
    } finally {
      setBusy(false);
    }
  }

  async function saveVehicle() {
    setBusy(true);
    setError(null);
    try {
      const saved = selectedVehicle
        ? await apiPut<Vehicle>(`/material-pass/vehicles-master/${selectedVehicle.id}`, vehicleForm)
        : await apiPost<Vehicle>('/material-pass/vehicles-master', vehicleForm);
      setSelectedVehicle(saved);
      setVehicleForm(mapVehicleToForm(saved));
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vehicle');
    } finally {
      setBusy(false);
    }
  }

  const filteredEntries = useMemo(() => entries, [entries]);
  const flow = entryForm.entryType === 'RECEIPT' ? RECEIPT_FLOW : DISPATCH_FLOW;
  const reportRows = report?.rows ?? [];

  if (isLoading || !isAuthenticated) {
    return <main className="min-h-screen flex items-center justify-center text-text-tertiary">Loading material gate module…</main>;
  }

  return (
    <main className="min-h-screen bg-surface-0">
      <DashboardHeader />
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <section className="rounded-3xl border border-border-subtle bg-surface-1 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
                <Truck className="h-3.5 w-3.5" />
                Material Gate Operations
              </div>
              <h1 className="mt-3 text-3xl font-semibold text-text-primary">Material Dispatch, Receipt and Vehicle Control</h1>
              <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                Camera-first gate workflow for incoming and outgoing material vehicles, with driver and vehicle masters, ANPR-ready evidence capture, status timeline, gate pass printing and filterable exports.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh module
            </button>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'entries', label: 'Gate Entries', icon: ClipboardList },
            { key: 'drivers', label: 'Drivers', icon: UserSquare2 },
            { key: 'vehicles', label: 'Vehicles', icon: CarFront },
            { key: 'reports', label: 'Reports', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                  active ? 'border-brand-500/30 bg-brand-500/10 text-brand-200' : 'border-border-subtle bg-surface-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Today's receipts" value={dashboard?.cards.todaysReceipts ?? 0} icon={Package} />
              <StatCard label="Today's dispatches" value={dashboard?.cards.todaysDispatches ?? 0} icon={ArrowRight} />
              <StatCard label="Vehicles inside" value={dashboard?.cards.vehiclesInsidePlant ?? 0} icon={Truck} />
              <StatCard label="Pending gate out" value={dashboard?.cards.pendingGateOut ?? 0} icon={ShieldAlert} />
              <StatCard label="Repeat drivers" value={dashboard?.cards.driverRepeatVisits ?? 0} icon={UserSquare2} />
              <StatCard label="Alert count" value={dashboard?.cards.blacklistedAlerts ?? 0} icon={AlertTriangle} />
              <StatCard label="Qty summary" value={dashboard?.cards.materialQuantitySummary ?? 0} icon={HardHat} />
              <StatCard label="Open entries" value={entries.filter((entry) => entry.insidePlant).length} icon={CheckCircle2} />
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <Panel title="Material summary today" subtitle="Quick quantity view by material name">
                <div className="space-y-3">
                  {Object.entries(dashboard?.materialSummary ?? {}).length === 0 ? (
                    <div className="text-sm text-text-tertiary">No material movement recorded today.</div>
                  ) : (
                    Object.entries(dashboard?.materialSummary ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-text-primary">{key}</div>
                          <div className="text-sm text-brand-200">{value}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
              <Panel title="Vehicles currently inside" subtitle="Open entries waiting for completion">
                <div className="space-y-3">
                  {entries.filter((entry) => entry.insidePlant).slice(0, 8).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedEntry(entry);
                        setEntryForm(mapEntryToForm(entry));
                        setActiveTab('entries');
                      }}
                      className="w-full rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 text-left hover:bg-surface-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-text-primary">{entry.vehicleNumber}</div>
                          <div className="text-xs text-text-tertiary">{entry.driverName} • {entry.materialName}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(entry.status)}`}>{entry.status.replace(/_/g, ' ')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>
          </>
        ) : null}

        {activeTab === 'entries' ? (
          <div className="grid gap-6 xl:grid-cols-[1.12fr_.88fr]">
            <Panel title={selectedEntry ? `Edit ${selectedEntry.referenceNo}` : 'New gate entry'} subtitle="Use camera upload first, then confirm workflow and documents.">
              <div className="grid gap-4 md:grid-cols-2">
                <ChoiceGroup
                  label="Entry type"
                  value={entryForm.entryType}
                  options={[
                    { value: 'RECEIPT', label: 'Material receipt' },
                    { value: 'DISPATCH', label: 'Material dispatch' },
                  ]}
                  onChange={(value) => setEntryForm((current) => ({ ...current, entryType: value as EntryType, status: 'PENDING' }))}
                />
                <ChoiceGroup
                  label="Workflow status"
                  value={entryForm.status}
                  options={flow.map((item) => ({ value: item, label: item.replace(/_/g, ' ') }))}
                  onChange={(value) => setEntryForm((current) => ({ ...current, status: value as Status }))}
                />
                <SelectField label="Plant / Branch" value={entryForm.branchId} onChange={(value) => setEntryForm((current) => ({ ...current, branchId: value }))} options={branches.map((branch) => ({ value: branch.id, label: `${branch.name} • ${branch.location}` }))} />
                <TextField label="Plant / location" value={entryForm.plantLocation} onChange={(value) => setEntryForm((current) => ({ ...current, plantLocation: value }))} />
                <TextField label="Vehicle number" value={entryForm.vehicleNumber} onChange={(value) => setEntryForm((current) => ({ ...current, vehicleNumber: value }))} />
                <TextField label="ANPR detected number" value={entryForm.anprDetectedNumber} onChange={(value) => setEntryForm((current) => ({ ...current, anprDetectedNumber: value }))} />
                <TextField label="Corrected plate" value={entryForm.anprCorrectedNumber} onChange={(value) => setEntryForm((current) => ({ ...current, anprCorrectedNumber: value }))} />
                <TextField label="ANPR confidence" value={entryForm.anprConfidence} onChange={(value) => setEntryForm((current) => ({ ...current, anprConfidence: value }))} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <ImageField label="Plate capture / ANPR image" value={entryForm.anprImageData} onChange={(value) => setEntryForm((current) => ({ ...current, anprImageData: value }))} />
                <ImageField label="Truck before load / unload" value={entryForm.beforePhotoData} onChange={(value) => setEntryForm((current) => ({ ...current, beforePhotoData: value }))} />
                <ImageField label="Truck after load / unload" value={entryForm.afterPhotoData} onChange={(value) => setEntryForm((current) => ({ ...current, afterPhotoData: value }))} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={autofillFromLookup} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  <Search className="h-4 w-4" />
                  Auto-fill from master
                </button>
                <button type="button" onClick={() => { setSelectedEntry(null); setEntryForm(EMPTY_ENTRY); }} className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  Reset form
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <TextField label="Driver name" value={entryForm.driverName} onChange={(value) => setEntryForm((current) => ({ ...current, driverName: value }))} />
                <TextField label="Driver mobile" value={entryForm.driverMobile} onChange={(value) => setEntryForm((current) => ({ ...current, driverMobile: value }))} />
                <TextField label="License number" value={entryForm.driverLicenseNumber} onChange={(value) => setEntryForm((current) => ({ ...current, driverLicenseNumber: value }))} />
                <TextField label="License expiry" type="date" value={entryForm.driverLicenseExpiry} onChange={(value) => setEntryForm((current) => ({ ...current, driverLicenseExpiry: value }))} />
                <TextField label="Transporter name" value={entryForm.transporterName} onChange={(value) => setEntryForm((current) => ({ ...current, transporterName: value }))} />
                <TextField label="Owner name" value={entryForm.ownerName} onChange={(value) => setEntryForm((current) => ({ ...current, ownerName: value }))} />
                <ImageField label="Driver photo" value={entryForm.driverPhotoData} onChange={(value) => setEntryForm((current) => ({ ...current, driverPhotoData: value }))} />
                <ImageField label="Driver ID proof" value={entryForm.driverIdProofData} onChange={(value) => setEntryForm((current) => ({ ...current, driverIdProofData: value }))} accept="image/*,.pdf" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ChoiceGroup
                  label="Driver list status"
                  value={entryForm.driverListStatus}
                  options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'WHITELISTED', label: 'Whitelist' }, { value: 'BLACKLISTED', label: 'Blacklist' }]}
                  onChange={(value) => setEntryForm((current) => ({ ...current, driverListStatus: value }))}
                />
                <ChoiceGroup
                  label="Vehicle list status"
                  value={entryForm.vehicleListStatus}
                  options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'WHITELISTED', label: 'Whitelist' }, { value: 'BLACKLISTED', label: 'Blacklist' }]}
                  onChange={(value) => setEntryForm((current) => ({ ...current, vehicleListStatus: value }))}
                />
                <ChoiceGroup
                  label="Vehicle type"
                  value={entryForm.vehicleType}
                  options={['TRUCK', 'TANKER', 'TEMPO', 'CONTAINER', 'OTHER'].map((item) => ({ value: item, label: item }))}
                  onChange={(value) => setEntryForm((current) => ({ ...current, vehicleType: value }))}
                />
                <ToggleField label="Police verification complete" checked={entryForm.policeVerification} onChange={(checked) => setEntryForm((current) => ({ ...current, policeVerification: checked }))} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <TextField label="Insurance expiry" type="date" value={entryForm.insuranceExpiry} onChange={(value) => setEntryForm((current) => ({ ...current, insuranceExpiry: value }))} />
                <TextField label="PUC expiry" type="date" value={entryForm.pucExpiry} onChange={(value) => setEntryForm((current) => ({ ...current, pucExpiry: value }))} />
                <TextField label="Fitness expiry" type="date" value={entryForm.fitnessExpiry} onChange={(value) => setEntryForm((current) => ({ ...current, fitnessExpiry: value }))} />
                <ImageField label="RC document" value={entryForm.rcDocumentData} onChange={(value) => setEntryForm((current) => ({ ...current, rcDocumentData: value }))} accept="image/*,.pdf" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <TextField label="Supplier name" value={entryForm.supplierName} onChange={(value) => setEntryForm((current) => ({ ...current, supplierName: value }))} />
                <TextField label="Customer name" value={entryForm.customerName} onChange={(value) => setEntryForm((current) => ({ ...current, customerName: value }))} />
                <TextField label="PO number" value={entryForm.poNumber} onChange={(value) => setEntryForm((current) => ({ ...current, poNumber: value }))} />
                <TextField label="Invoice number" value={entryForm.invoiceNumber} onChange={(value) => setEntryForm((current) => ({ ...current, invoiceNumber: value }))} />
                <TextField label="Delivery challan no" value={entryForm.deliveryChallanNo} onChange={(value) => setEntryForm((current) => ({ ...current, deliveryChallanNo: value }))} />
                <TextField label="LR number" value={entryForm.lrNumber} onChange={(value) => setEntryForm((current) => ({ ...current, lrNumber: value }))} />
                <TextField label="Material name" value={entryForm.materialName} onChange={(value) => setEntryForm((current) => ({ ...current, materialName: value }))} />
                <TextField label="Material category" value={entryForm.materialCategory} onChange={(value) => setEntryForm((current) => ({ ...current, materialCategory: value }))} />
                <TextField label="Quantity" type="number" value={entryForm.quantity} onChange={(value) => setEntryForm((current) => ({ ...current, quantity: value }))} />
                <TextField label="Unit" value={entryForm.unit} onChange={(value) => setEntryForm((current) => ({ ...current, unit: value }))} />
                <TextField label="Destination" value={entryForm.destination} onChange={(value) => setEntryForm((current) => ({ ...current, destination: value }))} />
                <TextField label="Approved by" value={entryForm.approvedBy} onChange={(value) => setEntryForm((current) => ({ ...current, approvedBy: value }))} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <TextAreaField label="Security remarks" value={entryForm.securityRemarks} onChange={(value) => setEntryForm((current) => ({ ...current, securityRemarks: value }))} />
                <TextAreaField label="Store remarks" value={entryForm.storeRemarks} onChange={(value) => setEntryForm((current) => ({ ...current, storeRemarks: value }))} />
                <TextAreaField label="Dispatch remarks" value={entryForm.dispatchRemarks} onChange={(value) => setEntryForm((current) => ({ ...current, dispatchRemarks: value }))} />
                <TextAreaField label="Manual override reason" value={entryForm.manualOverrideReason} onChange={(value) => setEntryForm((current) => ({ ...current, manualOverrideReason: value }))} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" disabled={busy} onClick={submitEntry} className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {selectedEntry ? 'Update entry' : 'Create entry'}
                </button>
                {selectedEntry ? (
                  <>
                    {flow.map((status) => (
                      <button key={status} type="button" disabled={busy || selectedEntry.status === status} onClick={() => updateEntryStatus(status)} className={`rounded-xl border px-4 py-3 text-sm ${selectedEntry.status === status ? statusTone(status) : 'border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'}`}>
                        {status.replace(/_/g, ' ')}
                      </button>
                    ))}
                    <button type="button" onClick={() => printGatePass(selectedEntry)} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                      <Printer className="h-4 w-4" />
                      Print gate pass
                    </button>
                  </>
                ) : null}
              </div>
            </Panel>

            <div className="space-y-6">
              <Panel title="Open and recent entries" subtitle="Select any entry to update status, photos or remarks.">
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
                  <Search className="h-4 w-4 text-text-tertiary" />
                  <input value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} placeholder="Search vehicle, driver, material, invoice" className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary" />
                  <button type="button" onClick={loadEntries} className="text-xs text-brand-300">Apply</button>
                </div>
                <div className="space-y-3">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedEntry(entry);
                        setEntryForm(mapEntryToForm(entry));
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedEntry?.id === entry.id ? 'border-brand-500/30 bg-brand-500/10' : 'border-border-subtle bg-surface-2 hover:bg-surface-3'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{entry.referenceNo}</div>
                          <div className="mt-1 text-sm text-text-secondary">{entry.vehicleNumber} • {entry.driverName}</div>
                          <div className="mt-1 text-xs text-text-tertiary">{entry.materialName} • {entry.quantity} {entry.unit} • {entry.branch?.name ?? '—'}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(entry.status)}`}>{entry.status.replace(/_/g, ' ')}</span>
                      </div>
                      {entry.alerts?.length ? <div className="mt-3 flex flex-wrap gap-2">{entry.alerts.map((alert) => <span key={alert} className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">{alert}</span>)}</div> : null}
                    </button>
                  ))}
                </div>
              </Panel>

              {selectedEntry ? (
                <Panel title="Selected gate pass" subtitle="Printable proof with QR verification.">
                  <div className="rounded-3xl border border-border-subtle bg-surface-2 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-widest text-text-tertiary">Gate pass</div>
                        <div className="mt-2 text-2xl font-semibold text-text-primary">{selectedEntry.referenceNo}</div>
                        <div className="mt-1 text-sm text-text-secondary">{selectedEntry.entryType} • {selectedEntry.vehicleNumber}</div>
                      </div>
                      <QRCodeSVG value={selectedEntry.referenceNo} size={112} includeMargin />
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <QuickInfo label="Driver" value={selectedEntry.driverName} />
                      <QuickInfo label="Mobile" value={selectedEntry.driverMobile} />
                      <QuickInfo label="Material" value={selectedEntry.materialName} />
                      <QuickInfo label="Supplier / Customer" value={selectedEntry.supplierName || selectedEntry.customerName || '—'} />
                      <QuickInfo label="Gate in" value={selectedEntry.gateInAt ? new Date(selectedEntry.gateInAt).toLocaleString() : 'Not yet marked'} />
                      <QuickInfo label="Status" value={selectedEntry.status.replace(/_/g, ' ')} />
                    </div>
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'drivers' ? (
          <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
            <Panel title={selectedDriver ? `Edit driver: ${selectedDriver.fullName}` : 'Driver master'} subtitle="Security can maintain reusable driver records here.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Driver name" value={driverForm.fullName} onChange={(value) => setDriverForm((current) => ({ ...current, fullName: value }))} />
                <TextField label="Mobile" value={driverForm.mobile} onChange={(value) => setDriverForm((current) => ({ ...current, mobile: value }))} />
                <TextField label="License number" value={driverForm.licenseNumber} onChange={(value) => setDriverForm((current) => ({ ...current, licenseNumber: value }))} />
                <TextField label="License expiry" type="date" value={driverForm.licenseExpiry} onChange={(value) => setDriverForm((current) => ({ ...current, licenseExpiry: value }))} />
                <TextField label="Transporter name" value={driverForm.transporterName} onChange={(value) => setDriverForm((current) => ({ ...current, transporterName: value }))} />
                <ChoiceGroup label="Status" value={driverForm.listStatus} options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'WHITELISTED', label: 'Whitelist' }, { value: 'BLACKLISTED', label: 'Blacklist' }]} onChange={(value) => setDriverForm((current) => ({ ...current, listStatus: value }))} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ImageField label="Driver photo" value={driverForm.photoData} onChange={(value) => setDriverForm((current) => ({ ...current, photoData: value }))} />
                <ImageField label="ID proof" value={driverForm.idProofData} onChange={(value) => setDriverForm((current) => ({ ...current, idProofData: value }))} accept="image/*,.pdf" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextAreaField label="Address" value={driverForm.address} onChange={(value) => setDriverForm((current) => ({ ...current, address: value }))} />
                <TextAreaField label="Notes" value={driverForm.notes} onChange={(value) => setDriverForm((current) => ({ ...current, notes: value }))} />
              </div>
              <div className="mt-4">
                <ToggleField label="Police verification available" checked={driverForm.policeVerification} onChange={(checked) => setDriverForm((current) => ({ ...current, policeVerification: checked }))} />
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={saveDriver} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {selectedDriver ? 'Update driver' : 'Create driver'}
                </button>
                <button type="button" onClick={() => { setSelectedDriver(null); setDriverForm(EMPTY_DRIVER); }} className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  Reset
                </button>
              </div>
            </Panel>
            <Panel title="Driver records" subtitle="Previous visits are reflected through linked vehicle and movement counts.">
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
                <Search className="h-4 w-4 text-text-tertiary" />
                <input value={driverSearch} onChange={(event) => setDriverSearch(event.target.value)} placeholder="Search driver, mobile, license, transporter" className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary" />
                <button type="button" onClick={loadDrivers} className="text-xs text-brand-300">Apply</button>
              </div>
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <button key={driver.id} type="button" onClick={() => { setSelectedDriver(driver); setDriverForm(mapDriverToForm(driver)); }} className={`w-full rounded-2xl border p-4 text-left ${selectedDriver?.id === driver.id ? 'border-brand-500/30 bg-brand-500/10' : 'border-border-subtle bg-surface-2 hover:bg-surface-3'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{driver.fullName}</div>
                        <div className="mt-1 text-xs text-text-secondary">{driver.mobile} • {driver.licenseNumber}</div>
                        <div className="mt-1 text-xs text-text-tertiary">{driver.transporterName || 'No transporter'} • Visits: {driver._count?.movements ?? 0}</div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${driver.listStatus === 'BLACKLISTED' ? 'border-red-500/20 bg-red-500/10 text-red-300' : driver.listStatus === 'WHITELISTED' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-border-subtle bg-surface-1 text-text-secondary'}`}>{driver.listStatus}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === 'vehicles' ? (
          <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
            <Panel title={selectedVehicle ? `Edit vehicle: ${selectedVehicle.vehicleNumber}` : 'Vehicle master'} subtitle="Track blacklist, document expiry and transporter ownership.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Vehicle number" value={vehicleForm.vehicleNumber} onChange={(value) => setVehicleForm((current) => ({ ...current, vehicleNumber: value }))} />
                <TextField label="Owner name" value={vehicleForm.ownerName} onChange={(value) => setVehicleForm((current) => ({ ...current, ownerName: value }))} />
                <TextField label="Transporter" value={vehicleForm.transporterName} onChange={(value) => setVehicleForm((current) => ({ ...current, transporterName: value }))} />
                <ChoiceGroup label="Vehicle type" value={vehicleForm.vehicleType} options={['TRUCK', 'TANKER', 'TEMPO', 'CONTAINER', 'OTHER'].map((item) => ({ value: item, label: item }))} onChange={(value) => setVehicleForm((current) => ({ ...current, vehicleType: value }))} />
                <TextField label="Insurance expiry" type="date" value={vehicleForm.insuranceExpiry} onChange={(value) => setVehicleForm((current) => ({ ...current, insuranceExpiry: value }))} />
                <TextField label="PUC expiry" type="date" value={vehicleForm.pucExpiry} onChange={(value) => setVehicleForm((current) => ({ ...current, pucExpiry: value }))} />
                <TextField label="Fitness expiry" type="date" value={vehicleForm.fitnessExpiry} onChange={(value) => setVehicleForm((current) => ({ ...current, fitnessExpiry: value }))} />
                <ChoiceGroup label="List status" value={vehicleForm.listStatus} options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'WHITELISTED', label: 'Whitelist' }, { value: 'BLACKLISTED', label: 'Blacklist' }]} onChange={(value) => setVehicleForm((current) => ({ ...current, listStatus: value }))} />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ImageField label="RC document" value={vehicleForm.rcDocumentData} onChange={(value) => setVehicleForm((current) => ({ ...current, rcDocumentData: value }))} accept="image/*,.pdf" />
                <TextAreaField label="Notes" value={vehicleForm.notes} onChange={(value) => setVehicleForm((current) => ({ ...current, notes: value }))} />
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={saveVehicle} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {selectedVehicle ? 'Update vehicle' : 'Create vehicle'}
                </button>
                <button type="button" onClick={() => { setSelectedVehicle(null); setVehicleForm(EMPTY_VEHICLE); }} className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  Reset
                </button>
              </div>
            </Panel>
            <Panel title="Vehicle records" subtitle="Filter by number, transporter or owner.">
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2">
                <Search className="h-4 w-4 text-text-tertiary" />
                <input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Search vehicle, owner or transporter" className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary" />
                <button type="button" onClick={loadVehicles} className="text-xs text-brand-300">Apply</button>
              </div>
              <div className="space-y-3">
                {vehicles.map((vehicle) => (
                  <button key={vehicle.id} type="button" onClick={() => { setSelectedVehicle(vehicle); setVehicleForm(mapVehicleToForm(vehicle)); }} className={`w-full rounded-2xl border p-4 text-left ${selectedVehicle?.id === vehicle.id ? 'border-brand-500/30 bg-brand-500/10' : 'border-border-subtle bg-surface-2 hover:bg-surface-3'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{vehicle.vehicleNumber}</div>
                        <div className="mt-1 text-xs text-text-secondary">{vehicle.vehicleType} • {vehicle.transporterName || 'No transporter'}</div>
                        <div className="mt-1 text-xs text-text-tertiary">Movements: {vehicle._count?.movements ?? 0}</div>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${vehicle.listStatus === 'BLACKLISTED' ? 'border-red-500/20 bg-red-500/10 text-red-300' : vehicle.listStatus === 'WHITELISTED' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-border-subtle bg-surface-1 text-text-secondary'}`}>{vehicle.listStatus}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}

        {activeTab === 'reports' ? (
          <div className="space-y-6">
            <Panel title="Advanced filters" subtitle="Vehicle-wise, driver-wise, supplier-wise and location-wise exports.">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                <TextField label="From" type="date" value={reportFilters.from} onChange={(value) => setReportFilters((current) => ({ ...current, from: value }))} />
                <TextField label="To" type="date" value={reportFilters.to} onChange={(value) => setReportFilters((current) => ({ ...current, to: value }))} />
                <SelectField label="Branch" value={reportFilters.branchId} onChange={(value) => setReportFilters((current) => ({ ...current, branchId: value }))} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                <SelectField label="Entry type" value={reportFilters.entryType} onChange={(value) => setReportFilters((current) => ({ ...current, entryType: value }))} options={[{ value: 'RECEIPT', label: 'Receipt' }, { value: 'DISPATCH', label: 'Dispatch' }]} />
                <SelectField label="Status" value={reportFilters.status} onChange={(value) => setReportFilters((current) => ({ ...current, status: value }))} options={[...RECEIPT_FLOW, 'SECURITY_VERIFIED', 'LOADED', 'REJECTED'].filter((value, index, array) => array.indexOf(value) === index).map((value) => ({ value, label: value.replace(/_/g, ' ') }))} />
                <TextField label="Vehicle number" value={reportFilters.vehicleNumber} onChange={(value) => setReportFilters((current) => ({ ...current, vehicleNumber: value }))} />
                <TextField label="Driver name" value={reportFilters.driverName} onChange={(value) => setReportFilters((current) => ({ ...current, driverName: value }))} />
                <TextField label="Supplier" value={reportFilters.supplierName} onChange={(value) => setReportFilters((current) => ({ ...current, supplierName: value }))} />
                <TextField label="Customer" value={reportFilters.customerName} onChange={(value) => setReportFilters((current) => ({ ...current, customerName: value }))} />
                <TextField label="Material" value={reportFilters.materialName} onChange={(value) => setReportFilters((current) => ({ ...current, materialName: value }))} />
                <TextField label="Transporter" value={reportFilters.transporterName} onChange={(value) => setReportFilters((current) => ({ ...current, transporterName: value }))} />
                <TextField label="Location" value={reportFilters.location} onChange={(value) => setReportFilters((current) => ({ ...current, location: value }))} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={loadReport} className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-medium text-white">
                  <BarChart3 className="h-4 w-4" />
                  Run report
                </button>
                <button type="button" onClick={() => { setReportFilters({ from: '', to: '', branchId: '', entryType: '', status: '', vehicleNumber: '', driverName: '', supplierName: '', customerName: '', materialName: '', transporterName: '', location: '' }); }} className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  Reset filters
                </button>
              </div>
            </Panel>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              <StatCard label="Rows" value={report?.totals.count ?? 0} icon={ClipboardList} />
              <StatCard label="Receipts" value={report?.totals.receipts ?? 0} icon={Package} />
              <StatCard label="Dispatches" value={report?.totals.dispatches ?? 0} icon={ArrowRight} />
              <StatCard label="Open entries" value={report?.totals.openEntries ?? 0} icon={Truck} />
              <StatCard label="Blacklist attempts" value={report?.totals.blacklistedAttempts ?? 0} icon={AlertTriangle} />
              <StatCard label="Quantity" value={report?.totals.quantity ?? 0} icon={BadgeCheck} />
            </section>

            <Panel title="Export report" subtitle="Download the current filtered data in your preferred format.">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => downloadCSV(`material-gate-report-${new Date().toISOString().slice(0, 10)}.csv`, reportRows as Record<string, any>[])} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button type="button" onClick={() => downloadXLSX(`material-gate-report-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: 'Material Gate Report', rows: reportRows as Record<string, any>[] }])} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadPDF(
                      `material-gate-report-${new Date().toISOString().slice(0, 10)}.pdf`,
                      {
                        title: 'Material Gate Report',
                        subtitle: 'Receipt and dispatch movement export',
                        filters: Object.entries(reportFilters).filter(([, value]) => value).map(([label, value]) => ({ label, value })),
                        kpis: [
                          { label: 'Rows', value: report?.totals.count ?? 0 },
                          { label: 'Receipts', value: report?.totals.receipts ?? 0 },
                          { label: 'Dispatches', value: report?.totals.dispatches ?? 0 },
                        ],
                        brand: 'Gem Aromatics',
                      },
                      reportRows as Record<string, any>[],
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-3 text-sm font-medium text-white"
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </Panel>

            <Panel title="Report rows" subtitle="Current filtered report output.">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border-subtle bg-surface-2 text-text-secondary">
                    <tr>
                      {Object.keys(reportRows[0] ?? {}).map((column) => (
                        <th key={column} className="px-4 py-3 text-left font-medium">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {reportRows.map((row, index) => (
                      <tr key={index} className="hover:bg-surface-2/60">
                        {Object.keys(reportRows[0] ?? {}).map((column) => (
                          <td key={column} className="px-4 py-3 text-text-primary">{display(row[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function mapEntryToForm(entry: Entry) {
  return {
    ...EMPTY_ENTRY,
    branchId: entry.branchId || entry.branch?.id || '',
    entryType: entry.entryType,
    status: entry.status,
    vehicleNumber: entry.vehicleNumber || '',
    anprDetectedNumber: entry.anprDetectedNumber || '',
    anprCorrectedNumber: entry.anprCorrectedNumber || '',
    anprConfidence: entry.anprConfidence != null ? String(entry.anprConfidence) : '',
    driverName: entry.driverName || '',
    driverMobile: entry.driverMobile || '',
    driverLicenseNumber: entry.driverLicenseNumber || '',
    transporterName: entry.transporterName || '',
    supplierName: entry.supplierName || '',
    customerName: entry.customerName || '',
    poNumber: entry.poNumber || '',
    invoiceNumber: entry.invoiceNumber || '',
    deliveryChallanNo: entry.deliveryChallanNo || '',
    lrNumber: entry.lrNumber || '',
    materialName: entry.materialName || '',
    materialCategory: entry.materialCategory || '',
    quantity: String(entry.quantity ?? 1),
    unit: entry.unit || 'Kg',
    plantLocation: entry.plantLocation || '',
    destination: entry.destination || '',
    approvedBy: entry.approvedBy || '',
    securityRemarks: entry.securityRemarks || '',
    storeRemarks: entry.storeRemarks || '',
    dispatchRemarks: entry.dispatchRemarks || '',
    manualOverrideReason: entry.manualOverrideReason || '',
    beforePhotoData: entry.beforePhotoData || '',
    afterPhotoData: entry.afterPhotoData || '',
    anprImageData: entry.anprImageData || '',
    driverPhotoData: entry.driverPhotoData || '',
  };
}

function mapDriverToForm(driver: Driver) {
  return {
    ...EMPTY_DRIVER,
    fullName: driver.fullName || '',
    mobile: driver.mobile || '',
    licenseNumber: driver.licenseNumber || '',
    licenseExpiry: driver.licenseExpiry ? driver.licenseExpiry.slice(0, 10) : '',
    transporterName: driver.transporterName || '',
    listStatus: driver.listStatus || 'NORMAL',
    policeVerification: driver.policeVerification,
  };
}

function mapVehicleToForm(vehicle: Vehicle) {
  return {
    ...EMPTY_VEHICLE,
    vehicleNumber: vehicle.vehicleNumber || '',
    ownerName: vehicle.ownerName || '',
    transporterName: vehicle.transporterName || '',
    vehicleType: vehicle.vehicleType || 'TRUCK',
    insuranceExpiry: vehicle.insuranceExpiry ? vehicle.insuranceExpiry.slice(0, 10) : '',
    pucExpiry: vehicle.pucExpiry ? vehicle.pucExpiry.slice(0, 10) : '',
    fitnessExpiry: vehicle.fitnessExpiry ? vehicle.fitnessExpiry.slice(0, 10) : '',
    listStatus: vehicle.listStatus || 'NORMAL',
  };
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border-subtle bg-surface-1 p-5">
      <div className="mb-5">
        <div className="text-lg font-semibold text-text-primary">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-text-secondary">{subtitle}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 px-4 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-tertiary">
        <Icon className="h-4 w-4 text-brand-400" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function QuickInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className="mt-1 text-sm font-medium text-text-primary">{value}</div>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500/40" />
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500/40" />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500/40">
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`rounded-xl border px-3 py-2 text-sm ${value === option.value ? 'border-brand-500/30 bg-brand-500/10 text-brand-200' : 'border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'}`}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left ${checked ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-border-subtle bg-surface-2 text-text-secondary'}`}>
      <span className="text-sm">{label}</span>
      <span className="text-xs font-medium">{checked ? 'Yes' : 'No'}</span>
    </button>
  );
}

function ImageField({ label, value, onChange, accept = 'image/*' }: { label: string; value: string; onChange: (value: string) => void; accept?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [locationText, setLocationText] = useState('Location unavailable');
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function loadGeo() {
    if (!navigator.geolocation) {
      setLocationText('Geolocation unsupported');
      return;
    }
    setGeoLoading(true);
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          resolve();
        },
        () => {
          setLocationText('Location permission denied');
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
    setGeoLoading(false);
  }

  async function openCamera() {
    setCaptureError(null);
    try {
      await loadGeo();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCameraOpen(true);
      setCameraReady(false);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Unable to open camera');
      setCameraOpen(false);
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
  }

  async function captureLivePhoto() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCaptureError('Unable to capture frame');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const raw = canvas.toDataURL('image/jpeg', 0.92);
    const stamped = await stampImageWithMeta(raw, label, locationText);
    onChange(stamped);
    saveCaptureLocally(label, stamped, locationText);
    closeCamera();
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await readFileAsDataUrl(file);
    const stamped = raw.startsWith('data:image') ? await stampImageWithMeta(raw, label, locationText) : raw;
    onChange(stamped);
    if (stamped.startsWith('data:image')) {
      saveCaptureLocally(label, stamped, locationText);
    }
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-2 p-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openCamera} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
            <Video className="h-4 w-4" />
            Live camera
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
            <Camera className="h-4 w-4" />
            Upload file
            <input type="file" accept={accept} capture="environment" className="hidden" onChange={uploadFile} />
          </label>
          <button type="button" onClick={loadGeo} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
            <Crosshair className="h-4 w-4" />
            {geoLoading ? 'Fetching geo…' : 'Refresh geo'}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-text-tertiary">
          Stamp: {formatStampDate()} • {locationText}
        </div>

        {cameraOpen ? (
          <div className="mt-3 rounded-2xl border border-border-subtle bg-black/40 p-3">
            <video ref={videoRef} muted playsInline onLoadedMetadata={() => setCameraReady(true)} className="h-48 w-full rounded-xl object-cover sm:h-64" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={captureLivePhoto} disabled={!cameraReady} className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                <Camera className="h-4 w-4" />
                Capture stamped photo
              </button>
              <button type="button" onClick={closeCamera} className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-1 px-4 py-2 text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary">
                <VideoOff className="h-4 w-4" />
                Close camera
              </button>
            </div>
          </div>
        ) : null}

        {captureError ? <div className="mt-3 text-xs text-red-300">{captureError}</div> : null}

        {value ? (
          value.startsWith('data:image') ? (
            <img src={value} alt={label} className="mt-3 h-36 w-full rounded-xl object-cover" />
          ) : (
            <div className="mt-3 text-xs text-text-tertiary">Document attached</div>
          )
        ) : (
          <div className="mt-3 text-xs text-text-tertiary">
            Live capture adds date, time and geo stamp on the image, stores it in the form, and downloads a local copy automatically.
          </div>
        )}
      </div>
    </label>
  );
}
