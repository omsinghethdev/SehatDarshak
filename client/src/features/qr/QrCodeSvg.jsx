import { qrPathData } from '../../lib/qrcode';

/** Renders an encoded QR matrix (from encodeQr) as an accessible, crisp SVG. */
export function QrCodeSvg({ qr, label, className }) {
  const margin = 4;
  const dimension = qr.size + margin * 2;
  return (
    <svg
      viewBox={`0 0 ${dimension} ${dimension}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={dimension} height={dimension} fill="#ffffff" />
      <path d={qrPathData(qr, margin)} fill="#000000" />
    </svg>
  );
}
