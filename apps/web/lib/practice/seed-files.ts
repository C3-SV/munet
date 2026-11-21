// Binarios de ejemplo de la práctica: un PNG y un PDF generados en código, sin red ni dependencias.
// El PNG no usa zlib: su flujo son bloques deflate «stored» (sin comprimir) con Adler-32 al final,
// y el CRC-32 de cada trozo se calcula aquí. Los tamaños declarados en la semilla no tienen que
// coincidir con los de estos archivos.

export const SEED_IMAGE_ATTACHMENT_ID = "practice-seed-att-image";
export const SEED_PDF_ATTACHMENT_ID = "practice-seed-att-pdf";

const IMAGE_WIDTH = 480;
const IMAGE_HEIGHT = 240;
// Franja clara horizontal, de la fila BAND_TOP a BAND_TOP + BAND_HEIGHT - 1.
const BAND_TOP = 96;
const BAND_HEIGHT = 12;
const BLUE: readonly number[] = [30, 58, 138];
const AMBER: readonly number[] = [245, 158, 11];
const CLEAR: readonly number[] = [248, 250, 252];

const MAX_STORED_BLOCK = 65535;
const ADLER_MODULUS = 65521;
const PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Tabla de CRC-32 (polinomio reflejado 0xEDB88320), calculada una sola vez.
const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        table[index] = value >>> 0;
    }
    return table;
})();

const crc32 = (bytes: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: Uint8Array): number => {
    let a = 1;
    let b = 0;
    for (const byte of bytes) {
        a = (a + byte) % ADLER_MODULUS;
        b = (b + a) % ADLER_MODULUS;
    }
    return ((b << 16) | a) >>> 0;
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

// Flujo zlib (cabecera 0x78 0x01) formado solo por bloques deflate sin comprimir de hasta 65535 bytes.
// Cada bloque: una cabecera de 1 byte (bit BFINAL, BTYPE = 00), LEN y NLEN en little-endian y los datos.
const zlibStored = (data: Uint8Array): Uint8Array => {
    const blocks = Math.max(1, Math.ceil(data.length / MAX_STORED_BLOCK));
    const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
    out[0] = 0x78;
    out[1] = 0x01;
    let position = 2;
    let offset = 0;
    do {
        const length = Math.min(MAX_STORED_BLOCK, data.length - offset);
        const complement = ~length & 0xffff;
        out[position] = offset + length >= data.length ? 1 : 0;
        out[position + 1] = length & 0xff;
        out[position + 2] = length >>> 8;
        out[position + 3] = complement & 0xff;
        out[position + 4] = complement >>> 8;
        out.set(data.subarray(offset, offset + length), position + 5);
        position += 5 + length;
        offset += length;
    } while (offset < data.length);
    const checksum = adler32(data);
    out[position] = (checksum >>> 24) & 0xff;
    out[position + 1] = (checksum >>> 16) & 0xff;
    out[position + 2] = (checksum >>> 8) & 0xff;
    out[position + 3] = checksum & 0xff;
    return out;
};

// Trozo PNG: longitud (4 bytes, big-endian), tipo (4 letras), datos y CRC-32 sobre tipo y datos.
const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length);
    for (let index = 0; index < 4; index += 1) {
        chunk[4 + index] = type.charCodeAt(index);
    }
    chunk.set(data, 8);
    view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
    return chunk;
};

const imageHeader = (): Uint8Array => {
    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, IMAGE_WIDTH);
    view.setUint32(4, IMAGE_HEIGHT);
    header[8] = 8; // profundidad de bit
    header[9] = 2; // color RGB
    // Compresión, filtro y entrelazado: todos a 0.
    return header;
};

// Píxeles en bruto: cada fila empieza con el byte de filtro 0 (None) y luego RGB. Degradado de azul a ámbar
// a lo largo del ancho y una franja clara horizontal.
const imageScanlines = (): Uint8Array => {
    const rowLength = 1 + IMAGE_WIDTH * 3;
    const raw = new Uint8Array(IMAGE_HEIGHT * rowLength);
    for (let y = 0; y < IMAGE_HEIGHT; y += 1) {
        const rowStart = y * rowLength;
        const inBand = y >= BAND_TOP && y < BAND_TOP + BAND_HEIGHT;
        raw[rowStart] = 0;
        for (let x = 0; x < IMAGE_WIDTH; x += 1) {
            const t = x / (IMAGE_WIDTH - 1);
            for (let channel = 0; channel < 3; channel += 1) {
                const from = BLUE[channel] ?? 0;
                const to = AMBER[channel] ?? 0;
                const value = inBand ? (CLEAR[channel] ?? 0) : Math.round(from + (to - from) * t);
                raw[rowStart + 1 + x * 3 + channel] = value;
            }
        }
    }
    return raw;
};

// PNG de 480 × 240 válido: firma, IHDR, un único IDAT con el flujo sin comprimir e IEND.
export const makeSeedPng = (): Uint8Array<ArrayBuffer> =>
    concatBytes([
        Uint8Array.from(PNG_SIGNATURE),
        pngChunk("IHDR", imageHeader()),
        pngChunk("IDAT", zlibStored(imageScanlines())),
        pngChunk("IEND", new Uint8Array(0)),
    ]);

// PDF mínimo de una página con el texto «Procedimiento de debate». Todo es ASCII, así que los
// desplazamientos del xref coinciden con las posiciones de caracteres.
export const makeSeedPdf = (): Uint8Array<ArrayBuffer> => {
    const content = "BT /F1 24 Tf 72 720 Td (Procedimiento de debate) Tj ET";
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    // Cada entrada ocupa exactamente 20 bytes, incluido el final de línea.
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Uint8Array.from(pdf, (character) => character.charCodeAt(0));
};

let seedPng: Uint8Array<ArrayBuffer> | null = null;
let seedPdf: Uint8Array<ArrayBuffer> | null = null;

// Blob del adjunto sembrado, o null si el id no es de la semilla. Los binarios se generan una vez.
export const seedBlobFor = (attachmentId: string): Blob | null => {
    if (attachmentId === SEED_IMAGE_ATTACHMENT_ID) {
        seedPng ??= makeSeedPng();
        return new Blob([seedPng], { type: "image/png" });
    }
    if (attachmentId === SEED_PDF_ATTACHMENT_ID) {
        seedPdf ??= makeSeedPdf();
        return new Blob([seedPdf], { type: "application/pdf" });
    }
    return null;
};
