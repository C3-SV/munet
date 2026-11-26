import test from "node:test";
import assert from "node:assert/strict";

import { buildThreads, excerpt } from "./comment-threads.ts";

const c = (id, parent, minute, extra = {}) => ({
    id,
    parentCommentId: parent,
    createdAt: `2026-11-25T10:${String(minute).padStart(2, "0")}:00Z`,
    ...extra,
});

test("sin respuestas: un hilo por comentario, en orden cronológico", () => {
    const threads = buildThreads([c("b", null, 5), c("a", null, 1)]);

    assert.deepEqual(threads.map((t) => t.root.id), ["a", "b"]);
    assert.ok(threads.every((t) => t.replies.length === 0));
});

test("las respuestas quedan bajo su comentario, no entremezcladas con otros hilos", () => {
    const threads = buildThreads([
        c("a", null, 1),
        c("b", null, 2),
        c("a1", "a", 3),
        c("b1", "b", 4),
        c("a2", "a", 5),
    ]);

    assert.deepEqual(threads.map((t) => t.root.id), ["a", "b"]);
    assert.deepEqual(threads[0].replies.map((r) => r.comment.id), ["a1", "a2"]);
    assert.deepEqual(threads[1].replies.map((r) => r.comment.id), ["b1"]);
});

test("responder a una respuesta no añade niveles: queda en el mismo hilo e indica a quién responde", () => {
    const threads = buildThreads([c("a", null, 1), c("a1", "a", 2), c("a1x", "a1", 3), c("a1xy", "a1x", 4)]);

    assert.equal(threads.length, 1);
    assert.deepEqual(threads[0].replies.map((r) => r.comment.id), ["a1", "a1x", "a1xy"]);
    assert.equal(threads[0].replies[0].replyTo.id, "a");
    assert.equal(threads[0].replies[1].replyTo.id, "a1");
    assert.equal(threads[0].replies[2].replyTo.id, "a1x");
    assert.ok(threads[0].replies.every((r) => !r.replyToMissing));
});

test("si el comentario original ya no está, la respuesta se marca y no se pierde", () => {
    const threads = buildThreads([c("a", null, 1), c("r", "borrado", 2), c("r2", "r", 3)]);

    // "r" respondía a un comentario eliminado: abre su propio hilo.
    const thread = threads.find((t) => t.root.id === "r");

    assert.equal(thread.rootReplyToMissing, true);
    assert.deepEqual(thread.replies.map((r) => r.comment.id), ["r2"]);
    assert.equal(thread.replies[0].replyTo.id, "r");
});

test("una respuesta a un comentario intermedio eliminado queda en el hilo con replyToMissing", () => {
    const threads = buildThreads([c("a", null, 1), c("a2", "intermedio-eliminado", 3)]);
    const orphan = threads.find((t) => t.root.id === "a2");

    assert.equal(orphan.rootReplyToMissing, true);
});

test("tolera referencias circulares sin colgarse", () => {
    const threads = buildThreads([c("x", "y", 1), c("y", "x", 2)]);
    const total = threads.reduce((sum, t) => sum + 1 + t.replies.length, 0);

    assert.equal(total, 2);
});

test("el orden usa el timestamp cuando existe y el id para desempatar", () => {
    const threads = buildThreads([
        c("b", null, 1, { timestamp: 2000 }),
        c("a", null, 1, { timestamp: 2000 }),
        c("z", null, 1, { timestamp: 1000 }),
    ]);

    assert.deepEqual(threads.map((t) => t.root.id), ["z", "a", "b"]);
});

test("excerpt compacta espacios y recorta con puntos suspensivos", () => {
    assert.equal(excerpt("hola\n\n  mundo"), "hola mundo");
    assert.equal(excerpt("a".repeat(100), 10), "aaaaaaaaa…");
});
