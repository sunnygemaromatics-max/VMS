'use client';

export type CaptureContext = {
  moduleName: string;
  label: string;
  locationText?: string;
  capturedAt?: Date;
  mimeType?: string;
};

type CaptureRecord = {
  moduleName: string;
  label: string;
  filename: string;
  dataUrl: string;
  locationText: string;
  capturedAt: string;
};

const HISTORY_PREFIX = 'gem-captures:';
const HISTORY_LIMIT = 60;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'capture';
}

export function formatCaptureDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
}

export function makeCaptureFilename({ moduleName, label, capturedAt = new Date() }: CaptureContext) {
  const stamp = capturedAt.toISOString().replace(/[:.]/g, '-');
  return `gem-aromatics-${slugify(moduleName)}-${slugify(label)}-${stamp}.jpg`;
}

export async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export async function getLocationText() {
  if (!navigator.geolocation) return 'Geolocation unsupported';
  return new Promise<string>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        resolve(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve('Location permission denied');
          return;
        }
        resolve('Location unavailable');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

export async function stampImageWithMeta(source: string, context: CaptureContext) {
  const {
    moduleName,
    label,
    locationText = 'Location unavailable',
    capturedAt = new Date(),
    mimeType = 'image/jpeg',
  } = context;

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
    `Gem Aromatics • ${moduleName}`,
    `Image: ${label}`,
    `Time: ${formatCaptureDate(capturedAt)}`,
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

export async function createStampedCapture(source: string, context: CaptureContext) {
  const capturedAt = context.capturedAt ?? new Date();
  const locationText = context.locationText ?? (await getLocationText());
  const filename = makeCaptureFilename({ ...context, capturedAt });
  const dataUrl = await stampImageWithMeta(source, { ...context, capturedAt, locationText });
  return { dataUrl, filename, locationText, capturedAt };
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function saveCaptureLocally(record: CaptureRecord) {
  const historyKey = `${HISTORY_PREFIX}${slugify(record.moduleName)}`;
  try {
    const existing = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const next = [record, ...existing].slice(0, HISTORY_LIMIT);
    localStorage.setItem(historyKey, JSON.stringify(next));
  } catch {}
  downloadDataUrl(record.filename, record.dataUrl);
}

export function snapshotVideo(video: HTMLVideoElement, mimeType = 'image/jpeg', quality = 0.92) {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to capture frame');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mimeType, quality);
}
