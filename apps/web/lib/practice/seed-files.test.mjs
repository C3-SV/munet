import assert from "node:assert/strict";
import test from "node:test";
import {
    makeSeedPdf,
    makeSeedPng,
    seedBlobFor,
    SEED_IMAGE_ATTACHMENT_ID,
    SEED_PDF_ATTACHMENT_ID,
} from "./seed-files.ts";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WIDTH = 480;
const HEIGHT = 240;

// CRC-32 y Adler-32 independientes de seed-files.ts: bit a bit, sin tabla precalculada.
const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes) => {
    let a = 1;
    let b = 0;
    for (const byte of bytes) {
        a = (a + byte) % 65521;
        b = (b + a) % 65521;
    }
    return (b * 65536 + a) >>> 0;
};

const concat = (parts) => {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
};

// Lee los trozos PNG comprobando la longitud, el tipo y el CRC de cada uno.
const readChunks = (png) => {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const chunks = [];
    let position = 8;
    while (position < png.length) {
        const length = view.getUint32(position);
        const type = String.fromCharCode(...png.subarray(position + 4, position + 8));
        const data = png.subarray(position + 8, position + 8 + length);
        const crc = view.getUint32(position + 8 + length);
        assert.equal(crc, crc32(png.subarray(position + 4, position + 8 + length)), `CRC del trozo ${type}`);
        chunks.push({ type, data });
        position += 12 + length;
    }
    assert.equal(position, png.length, "no sobra ni falta nada al final del PNG");
    return chunks;
};

// Recorre el flujo zlib de bloques «stored» y devuelve los datos sin comprimir y la longitud de cada bloque.
const inflateStored = (stream) => {
    assert.equal(stream[0], 0x78);
    assert.equal(stream[1], 0x01);
    assert.equal((stream[0] * 256 + stream[1]) % 31, 0, "cabecera zlib válida");
    const parts = [];
    const lengths = [];
    let position = 2;
    let final = false;
    while (!final) {
        const header = stream[position];
        assert.equal(header & 0x06, 0, "BTYPE 00: bloque sin comprimir");
        final = (header & 1) === 1;
        const length = stream[position + 1] | (stream[position + 2] << 8);
        const complement = stream[position + 3] | (stream[position + 4] << 8);
        assert.equal(complement, ~length & 0xffff, "NLEN es el complemento de LEN");
        parts.push(stream.subarray(position + 5, position + 5 + length));
        lengths.push(length);
        position += 5 + length;
    }
    const raw = concat(parts);
    const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
    assert.equal(view.getUint32(position), adler32(raw), "Adler-32 del flujo");
    assert.equal(position + 4, stream.length, "no sobran bytes tras el Adler-32");
    return { raw, lengths };
};

test("PNG: firma, IHDR 480x240 RGB y trozos en orden IHDR, IDAT, IEND", () => {
    const png = makeSeedPng();
    assert.deepEqual([...png.subarray(0, 8)], PNG_SIGNATURE);
    const chunks = readChunks(png);
    assert.deepEqual(
        chunks.map((chunk) => chunk.type),
        ["IHDR", "IDAT", "IEND"],
    );
    const header = chunks[0].data;
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    assert.equal(view.getUint32(0), WIDTH);
    assert.equal(view.getUint32(4), HEIGHT);
    assert.equal(header[8], 8, "profundidad de bit 8");
    assert.equal(header[9], 2, "tipo de color RGB");
    assert.equal(chunks[2].data.length, 0, "IEND vacío");
});

test("PNG: el flujo IDAT es zlib de bloques sin comprimir con Adler-32 correcto y filas bien formadas", () => {
    const idat = readChunks(makeSeedPng())[1].data;
    const { raw, lengths } = inflateStored(idat);

    assert.equal(raw.length, HEIGHT * (1 + WIDTH * 3));
    assert.ok(lengths.length > 1, "los datos ocupan varios bloques de deflate");
    assert.ok(lengths.every((length) => length <= 65535), "ningún bloque supera 65535 bytes");

    const rowLength = 1 + WIDTH * 3;
    for (let y = 0; y < HEIGHT; y += 1) {
        assert.equal(raw[y * rowLength], 0, `la fila ${y} usa el filtro None`);
    }
});

test("PNG: degradado de azul a ámbar y franja clara en la banda", () => {
    const { raw } = inflateStored(readChunks(makeSeedPng())[1].data);
    const rowLength = 1 + WIDTH * 3;
    const pixel = (x, y) => {
        const start = y * rowLength + 1 + x * 3;
        return [raw[start], raw[start + 1], raw[start + 2]];
    };
    const [startRed, , startBlue] = pixel(0, 0);
    const [endRed, , endBlue] = pixel(WIDTH - 1, 0);
    assert.ok(startBlue > startRed, "el extremo izquierdo es azul");
    assert.ok(endRed > endBlue, "el extremo derecho es ámbar");
    assert.deepEqual(pixel(10, 100), [248, 250, 252], "la franja clara es casi blanca");
});

test("PDF: empieza con %PDF- y termina con %%EOF, con texto y página", () => {
    const bytes = makeSeedPdf();
    const pdf = new TextDecoder("latin1").decode(bytes);
    assert.ok(pdf.startsWith("%PDF-"));
    assert.ok(pdf.trimEnd().endsWith("%%EOF"));
    assert.ok(pdf.includes("(Procedimiento de debate)"));
    assert.ok(pdf.includes("/Type /Page "));
    assert.ok([...bytes].every((byte) => byte < 128), "solo ASCII");
});

test("PDF: el xref apunta a cada objeto y ocupa 20 bytes por entrada", () => {
    const pdf = new TextDecoder("latin1").decode(makeSeedPdf());
    const xrefOffset = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)?.[1]);
    assert.equal(pdf.slice(xrefOffset, xrefOffset + 4), "xref");

    const lines = pdf.slice(xrefOffset).split("\n");
    const count = Number(lines[1].split(" ")[1]);
    assert.equal(count, 6);
    assert.equal(lines[2], "0000000000 65535 f ");
    for (let number = 1; number < count; number += 1) {
        const entry = lines[2 + number];
        assert.equal(entry.length, 19, `entrada ${number} sin el fin de línea (20 bytes con él)`);
        const offset = Number(entry.slice(0, 10));
        assert.ok(pdf.startsWith(`${number} 0 obj`, offset), `el objeto ${number} está en su desplazamiento`);
    }
});

test("seedBlobFor: devuelve el PNG y el PDF de la semilla con su tipo y nada para otros ids", async () => {
    const image = seedBlobFor(SEED_IMAGE_ATTACHMENT_ID);
    const pdf = seedBlobFor(SEED_PDF_ATTACHMENT_ID);
    assert.equal(image.type, "image/png");
    assert.equal(pdf.type, "application/pdf");
    assert.equal(image.size, makeSeedPng().length);
    assert.equal(pdf.size, makeSeedPdf().length);
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), makeSeedPng());
    assert.equal(seedBlobFor("practice-att-7"), null);
    assert.equal(seedBlobFor("practice-seed-att-otro"), null);
});
