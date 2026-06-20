/**
 * Lightweight client-side export helpers for JSON and XML.
 * Excel / CSV / PDF live in their own modules — these complement them
 * so the Download Center can offer five formats end-to-end without
 * an extra server round-trip.
 */

function triggerDownload(filename: string, mime: string, text: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadJSON(
  filename: string,
  payload: { title: string; range?: { from: string; to: string }; totals?: any; rows: any[] },
) {
  triggerDownload(
    filename.endsWith('.json') ? filename : `${filename}.json`,
    'application/json',
    JSON.stringify(payload, null, 2),
  );
}

function escapeXml(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeTag(s: string): string {
  // XML tag names: must start with a letter/underscore, no spaces or punctuation.
  const cleaned = s.replace(/[^A-Za-z0-9_-]/g, '_');
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `c_${cleaned}`;
}

export function downloadXML(
  filename: string,
  payload: { title: string; range?: { from: string; to: string }; totals?: any; rows: any[] },
) {
  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  parts.push(`<report title="${escapeXml(payload.title)}">`);
  if (payload.range) {
    parts.push(`  <range from="${escapeXml(payload.range.from)}" to="${escapeXml(payload.range.to)}"/>`);
  }
  if (payload.totals && typeof payload.totals === 'object') {
    parts.push('  <totals>');
    for (const [k, v] of Object.entries(payload.totals)) {
      parts.push(`    <${safeTag(k)}>${escapeXml(v)}</${safeTag(k)}>`);
    }
    parts.push('  </totals>');
  }
  parts.push('  <rows>');
  for (const r of payload.rows) {
    parts.push('    <row>');
    for (const [k, v] of Object.entries(r)) {
      parts.push(`      <${safeTag(k)}>${escapeXml(v)}</${safeTag(k)}>`);
    }
    parts.push('    </row>');
  }
  parts.push('  </rows>');
  parts.push('</report>');
  triggerDownload(
    filename.endsWith('.xml') ? filename : `${filename}.xml`,
    'application/xml',
    parts.join('\n'),
  );
}

/**
 * Print-friendly HTML view that opens the system print dialog.
 * No download — the user picks "Save as PDF" from the print sheet if
 * they want a file. Cheap, reliable, no extra deps.
 */
export function printReport(
  title: string,
  rows: any[],
  meta?: { range?: { from: string; to: string }; totals?: any },
) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const css = `
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
    .totals { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0 20px; }
    .totals span { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    thead { background: #7c3aed; color: white; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    footer { margin-top: 24px; color: #64748b; font-size: 10px; border-top: 1px solid #cbd5e1; padding-top: 8px; }
    @media print { body { padding: 0; } }
  `;
  const totalsHtml = meta?.totals
    ? `<div class="totals">${Object.entries(meta.totals)
        .map(([k, v]) => `<span><b>${escapeHtml(k)}:</b> ${escapeHtml(v as any)}</span>`)
        .join('')}</div>`
    : '';
  const range = meta?.range
    ? `${meta.range.from} → ${meta.range.to}`
    : new Date().toLocaleDateString();
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>`);
  win.document.write(`<h1>${escapeHtml(title)}</h1><div class="meta">${range} · ${rows.length} rows</div>`);
  win.document.write(totalsHtml);
  if (rows.length) {
    win.document.write('<table><thead><tr>');
    headers.forEach((h) => win.document.write(`<th>${escapeHtml(h)}</th>`));
    win.document.write('</tr></thead><tbody>');
    rows.forEach((r) => {
      win.document.write('<tr>');
      headers.forEach((h) => win.document.write(`<td>${escapeHtml(r[h] ?? '')}</td>`));
      win.document.write('</tr>');
    });
    win.document.write('</tbody></table>');
  } else {
    win.document.write('<p>No rows to display.</p>');
  }
  win.document.write(`<footer>Gem Aromatics Group · Generated ${new Date().toLocaleString()}</footer>`);
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function escapeHtml(v: any): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c],
  );
}
