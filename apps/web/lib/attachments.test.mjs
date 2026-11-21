import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize, validateAttachment } from "./attachments.ts";

const MB = 1024 * 1024;

test("acepta JPG/PNG hasta 5 MB y PDF hasta 20 MB", () => {
    assert.equal(validateAttachment({ type: "image/jpeg", size: 5 * MB }), null);
    assert.equal(validateAttachment({ type: "image/png", size: 1 }), null);
    assert.equal(validateAttachment({ type: "application/pdf", size: 20 * MB }), null);
});

test("rechaza archivos por encima del límite de su tipo", () => {
    assert.match(validateAttachment({ type: "image/png", size: 5 * MB + 1 }), /5 MB/);
    assert.match(validateAttachment({ type: "application/pdf", size: 20 * MB + 1 }), /20 MB/);
});

test("rechaza tipos no admitidos y archivos vacíos", () => {
    assert.match(validateAttachment({ type: "image/webp", size: 10 }), /JPG o PNG/);
    assert.match(validateAttachment({ type: "", size: 10 }), /JPG o PNG/);
    assert.match(validateAttachment({ type: "application/pdf", size: 0 }), /vacío/);
});

test("formatea tamaños", () => {
    assert.equal(formatFileSize(500), "500 B");
    assert.equal(formatFileSize(2048), "2 KB");
    assert.equal(formatFileSize(3 * MB), "3 MB");
    assert.equal(formatFileSize(Math.round(1.5 * MB)), "1.5 MB");
});
