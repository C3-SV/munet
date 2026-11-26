import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
    clearPracticeFiles,
    peekPracticeFile,
    stashPracticeFile,
    takePracticeFile,
} from "./uploads.ts";

afterEach(() => {
    clearPracticeFiles();
});

const fileNamed = (name) => new File(["contenido"], name, { type: "image/png" });

test("peek no consume el archivo y take sí, una sola vez", () => {
    const file = fileNamed("mapa.png");
    stashPracticeFile("practice-upload-1", file);

    assert.equal(peekPracticeFile("practice-upload-1"), file);
    assert.equal(peekPracticeFile("practice-upload-1"), file);
    assert.equal(takePracticeFile("practice-upload-1"), file);
    assert.equal(takePracticeFile("practice-upload-1"), null);
    assert.equal(peekPracticeFile("practice-upload-1"), null);
});

test("un id sin archivo devuelve null en peek y en take", () => {
    assert.equal(peekPracticeFile("practice-upload-404"), null);
    assert.equal(takePracticeFile("practice-upload-404"), null);
});

test("stash con el mismo id reemplaza el archivo anterior", () => {
    const first = fileNamed("a.png");
    const second = fileNamed("b.png");
    stashPracticeFile("practice-upload-2", first);
    stashPracticeFile("practice-upload-2", second);
    assert.equal(takePracticeFile("practice-upload-2"), second);
});

test("ids distintos guardan archivos distintos", () => {
    const first = fileNamed("a.png");
    const second = fileNamed("b.png");
    stashPracticeFile("practice-upload-3", first);
    stashPracticeFile("practice-upload-4", second);
    assert.equal(takePracticeFile("practice-upload-4"), second);
    assert.equal(takePracticeFile("practice-upload-3"), first);
});

test("clearPracticeFiles vacía todos los archivos pendientes", () => {
    stashPracticeFile("practice-upload-5", fileNamed("a.png"));
    stashPracticeFile("practice-upload-6", fileNamed("b.pdf"));
    clearPracticeFiles();
    assert.equal(peekPracticeFile("practice-upload-5"), null);
    assert.equal(takePracticeFile("practice-upload-6"), null);
});
