import { crc32, deflateSync } from 'node:zlib';

// Archivos de ejemplo para el evento de entrenamiento, generados en código para no versionar
// binarios. Son válidos (firma real de PNG y de PDF) y pequeños.

const chunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, checksum]);
};

// PNG RGB con un degradado azul a ámbar y una franja clara: reconocible en el muro.
export const makePng = (width = 480, height = 240): Buffer => {
  const rows: Buffer[] = [];

  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3); // byte de filtro 0 + píxeles
    for (let x = 0; x < width; x += 1) {
      const t = x / (width - 1);
      const stripe = y > height * 0.42 && y < height * 0.58;
      const o = 1 + x * 3;
      row[o] = stripe ? 255 : Math.round(37 + t * (245 - 37));
      row[o + 1] = stripe ? 255 : Math.round(99 + t * (158 - 99));
      row[o + 2] = stripe ? 255 : Math.round(235 + t * (11 - 235));
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // profundidad de bits
  header[9] = 2; // RGB
  // compresión, filtro y entrelazado en 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// PDF mínimo de una página con texto (ASCII, sin acentos para no depender de codificaciones).
export const makePdf = (title = 'Procedimiento de debate'): Buffer => {
  const lines = [
    title,
    'Evento de entrenamiento Conoce MUNET',
    '1. La presidencia abre la sesion y pasa lista.',
    '2. Se fija el tiempo de intervencion.',
    '3. Las delegaciones piden la palabra y debaten.',
    '4. Se presentan y votan las resoluciones.',
  ];
  const escape = (text: string) => text.replace(/[()\\]/g, '\\$&');
  const stream = ['BT', '/F1 14 Tf', '72 720 Td', '18 TL', ...lines.map((line, i) => `${i === 0 ? '' : 'T* '}(${escape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(out));
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { out += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(out, 'latin1');
};

export const MIME_BY_KIND = { png: 'image/png', pdf: 'application/pdf' } as const;
