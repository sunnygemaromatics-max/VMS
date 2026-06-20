import jsPDF from 'jspdf';

interface BadgeData {
  visitorName: string;
  visitorCompany?: string | null;
  hostName: string;
  branchName: string;
  branchLocation?: string;
  purpose: string;
  expectedEntry: string;
  vehicleNumber?: string | null;
  qrCodeToken: string;
}

/**
 * Produces a printable A6-ish visitor badge as a PDF. Uses a small canvas
 * to render the QR code as a PNG that's embedded in the PDF.
 */
export async function downloadBadgePDF(badge: BadgeData) {
  // 1. Render QR on offscreen canvas via qrcode-svg → wait, we already have
  //    qrcode.react for the UI. For PDF we need a raster image. Use the
  //    `qrcode` package... but to avoid adding another dep, draw a tiny
  //    HTML canvas, render the SVG to it, then export as PNG.
  const qrPng = await renderQrPng(badge.qrCodeToken, 256);

  const doc = new jsPDF({ unit: 'mm', format: [105, 148], orientation: 'portrait' }); // A6

  // Header band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 105, 24, 'F');
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.text('VISITOR PASS', 52.5, 11, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text('Gem Aromatics Group · vms.gemaromatics.com', 52.5, 17, { align: 'center' });

  // QR
  doc.addImage(qrPng, 'PNG', 30, 28, 45, 45);

  // Visitor name
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.text(badge.visitorName, 52.5, 82, { align: 'center', maxWidth: 95 });
  if (badge.visitorCompany) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(badge.visitorCompany, 52.5, 88, { align: 'center', maxWidth: 95 });
  }

  // Divider
  doc.setDrawColor(220);
  doc.line(8, 95, 97, 95);

  // Fields
  let y = 102;
  const addField = (label: string, value: string) => {
    doc.setTextColor(120);
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), 8, y);
    doc.setTextColor(40);
    doc.setFontSize(10);
    doc.text(value, 8, y + 4, { maxWidth: 89 });
    y += 11;
  };

  addField('Host', badge.hostName);
  addField('Location', `${badge.branchName}${badge.branchLocation ? ` · ${badge.branchLocation}` : ''}`);
  addField('Expected', new Date(badge.expectedEntry).toLocaleString());
  if (badge.vehicleNumber) addField('Vehicle', badge.vehicleNumber);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(badge.qrCodeToken, 52.5, 144, { align: 'center' });

  doc.save(`visitor-badge-${badge.visitorName.replace(/\s+/g, '-')}.pdf`);
}

async function renderQrPng(text: string, size: number): Promise<string> {
  // Lightweight: use qrcode.react under the hood by mounting in a hidden div
  // and serialising the resulting SVG, then drawing onto canvas.
  const { QRCodeSVG } = await import('qrcode.react');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');

  const svgString = renderToStaticMarkup(
    React.createElement(QRCodeSVG, { value: text, size, level: 'M', includeMargin: true }),
  );

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('QR image failed to render'));
    img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
  });
}
