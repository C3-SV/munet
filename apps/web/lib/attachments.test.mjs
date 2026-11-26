import test from "node:test";
import assert from "node:assert/strict";

import {
    MAX_ATTACHMENTS_PER_POST,
    MAX_POST_ATTACHMENT_BYTES,
    addAttachments,
    countAttachments,
    removeAttachmentAt,
    validateAttachment,
} from "./attachments.ts";

const MB = 1024 * 1024;
const img = (n, size = MB, type = "image/jpeg") => ({ name: `foto-${n}.jpg`, type, size, lastModified: n });
const pdf = (n, size = MB) => ({ name: `doc-${n}.pdf`, type: "application/pdf", size, lastModified: 1000 + n });

test("límites por archivo: imágenes de 15 MB y PDF de 30 MB", () => {
    assert.equal(validateAttachment(img(1, 15 * MB)), null);
    assert.match(validateAttachment(img(1, 15 * MB + 1)), /15 MB/);
    assert.equal(validateAttachment(pdf(1, 30 * MB)), null);
    assert.match(validateAttachment(pdf(1, 30 * MB + 1)), /30 MB/);
});

test("rechaza tipos no admitidos y archivos vacíos", () => {
    assert.match(validateAttachment({ type: "image/webp", size: 10 }), /JPG o PNG y archivos PDF/);
    assert.match(validateAttachment({ type: "text/plain", size: 10 }), /JPG o PNG y archivos PDF/);
    assert.match(validateAttachment({ type: "application/pdf", size: 0 }), /vacío/);
});

test("acepta hasta 10 imágenes y 2 PDF, combinados, en el orden elegido", () => {
    const incoming = [...Array.from({ length: 10 }, (_, i) => img(i + 1)), pdf(1), pdf(2)];
    const { files, errors } = addAttachments([], incoming);

    assert.equal(files.length, MAX_ATTACHMENTS_PER_POST);
    assert.deepEqual(errors, []);
    assert.deepEqual(files.map((f) => f.name), incoming.map((f) => f.name));
    assert.deepEqual(countAttachments(files), { images: 10, pdfs: 2 });
});

test("la imagen 11 y el PDF 3 se omiten con un mensaje y los demás se conservan", () => {
    const current = Array.from({ length: 10 }, (_, i) => img(i + 1));
    const result = addAttachments(current, [img(11), pdf(1), pdf(2), pdf(3)]);

    assert.equal(result.files.length, 12);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0], /foto-11\.jpg.*hasta 10 imágenes/);
    assert.match(result.errors[1], /doc-3\.pdf.*hasta 2 archivos PDF/);
});

test("un archivo inválido no impide agregar los válidos del mismo lote", () => {
    const result = addAttachments([], [img(1), { name: "video.mp4", type: "video/mp4", size: 5 }, img(2, 16 * MB), pdf(1)]);

    assert.deepEqual(result.files.map((f) => f.name), ["foto-1.jpg", "doc-1.pdf"]);
    assert.equal(result.errors.length, 2);
    assert.match(result.errors[0], /^video\.mp4: Solo se admiten/);
    assert.match(result.errors[1], /^foto-2\.jpg: El archivo supera el máximo de 15 MB/);
});

test("no repite el mismo archivo", () => {
    const first = addAttachments([], [img(1)]);
    const again = addAttachments(first.files, [img(1)]);

    assert.equal(again.files.length, 1);
    assert.match(again.errors[0], /ya está en la lista/);
});

test("respeta el máximo total por publicación", () => {
    assert.equal(MAX_POST_ATTACHMENT_BYTES, 210 * MB);
    // 2 PDF de 30 MB + 8 imágenes de 15 MB = 180 MB; sumar 3 imágenes de 15 MB más supera la cantidad, no el total.
    const current = [pdf(1, 30 * MB), pdf(2, 30 * MB), ...Array.from({ length: 9 }, (_, i) => img(i + 1, 15 * MB))];
    const result = addAttachments(current, [img(10, 15 * MB)]);

    assert.equal(result.files.length, 12);
    assert.deepEqual(result.errors, []);
});

test("no muta la lista actual y removeAttachmentAt quita uno", () => {
    const current = [img(1), img(2), img(3)];
    const result = addAttachments(current, [img(4)]);

    assert.equal(current.length, 3);
    assert.equal(result.files.length, 4);
    assert.deepEqual(removeAttachmentAt(result.files, 1).map((f) => f.name), ["foto-1.jpg", "foto-3.jpg", "foto-4.jpg"]);
});
