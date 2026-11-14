import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** The QR module matrix for a text (error correction M). true = dark. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Draws the code as one SVG path on white with the four-module quiet zone scanners need. */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const { path, dim } = useMemo(() => {
    const m = qrMatrix(value);
    const quiet = 4;
    let d = '';
    m.forEach((row, r) => {
      let c = 0;
      while (c < row.length) {
        if (!row[c]) { c += 1; continue; }
        let end = c;
        while (end < row.length && row[end]) end += 1;
        d += `M${c + quiet} ${r + quiet}h${end - c}v1h-${end - c}z`;
        c = end;
      }
    });
    return { path: d, dim: m.length + quiet * 2 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0 rounded-field border border-line bg-white"
    >
      <path d={path} fill="#141625" />
    </svg>
  );
}
