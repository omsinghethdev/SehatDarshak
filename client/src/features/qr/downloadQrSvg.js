import { qrSvgString } from '../../lib/qrcode';

/** Save an encoded QR (from encodeQr) as an SVG file. Purely client-side; nothing is uploaded. */
export function downloadQrSvg(qr, { title, fileName }) {
  const blob = new Blob([qrSvgString(qr, { title })], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}
