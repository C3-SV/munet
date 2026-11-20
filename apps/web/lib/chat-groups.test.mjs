import test from "node:test";
import assert from "node:assert/strict";

import { groupMessages } from "./chat-groups.ts";

const timeZone = "America/El_Salvador";
// Hoy en zona local: 19 nov 2026 a las 06:00.
const now = new Date("2026-11-19T12:00:00Z");

test("tres mensajes del mismo autor en 2 minutos forman un solo run", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T20:01:00Z" },
            { id: "m3", senderId: "a", createdAt: "2026-11-19T20:02:00Z" },
        ],
        { timeZone, now },
    );

    assert.equal(groups.length, 1);
    assert.equal(groups[0].runs.length, 1);
    assert.deepEqual(groups[0].runs[0].messageIds, ["m1", "m2", "m3"]);
    assert.equal(groups[0].runs[0].senderId, "a");
});

test("un cambio de autor abre un nuevo run", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m2", senderId: "b", createdAt: "2026-11-19T20:01:00Z" },
            { id: "m3", senderId: "a", createdAt: "2026-11-19T20:02:00Z" },
        ],
        { timeZone, now },
    );

    const runs = groups[0].runs;
    assert.equal(runs.length, 3);
    assert.deepEqual(runs.map((run) => run.senderId), ["a", "b", "a"]);
    assert.deepEqual(runs.map((run) => run.messageIds), [["m1"], ["m2"], ["m3"]]);
});

test("un hueco de 6 minutos del mismo autor abre un nuevo run", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T20:06:00Z" },
        ],
        { timeZone, now },
    );

    assert.equal(groups[0].runs.length, 2);
    assert.deepEqual(groups[0].runs[0].messageIds, ["m1"]);
    assert.deepEqual(groups[0].runs[1].messageIds, ["m2"]);
});

test("un hueco menor de windowMinutes sigue en el mismo run", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T20:09:00Z" },
        ],
        { timeZone, now, windowMinutes: 10 },
    );

    assert.equal(groups[0].runs.length, 1);
    assert.deepEqual(groups[0].runs[0].messageIds, ["m1", "m2"]);
});

test("mensajes a 23:50 y 00:10 locales forman dos grupos de día", () => {
    // 23:50 del 18 nov y 00:10 del 19 nov en America/El_Salvador (UTC-6).
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T05:50:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T06:10:00Z" },
        ],
        { timeZone, now },
    );

    assert.equal(groups.length, 2);
    assert.equal(groups[0].dayLabel, "Ayer");
    assert.deepEqual(groups[0].runs[0].messageIds, ["m1"]);
    assert.equal(groups[1].dayLabel, "Hoy");
    assert.deepEqual(groups[1].runs[0].messageIds, ["m2"]);
});

test("un día sin etiqueta relativa usa la fecha completa", () => {
    const groups = groupMessages(
        [{ id: "m1", senderId: "a", createdAt: "2026-11-10T20:00:00Z" }],
        { timeZone, now },
    );

    assert.equal(groups[0].dayLabel, "10 nov 2026");
});

test("el mismo autor a través de medianoche no se agrupa en un run", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T05:58:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T06:01:00Z" },
        ],
        { timeZone, now },
    );

    assert.equal(groups.length, 2);
    assert.equal(groups[0].runs.length, 1);
    assert.equal(groups[1].runs.length, 1);
});

test("lista vacía devuelve []", () => {
    assert.deepEqual(groupMessages([], { timeZone, now }), []);
});

test("ids duplicados no se repiten", () => {
    const groups = groupMessages(
        [
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m1", senderId: "a", createdAt: "2026-11-19T20:00:00Z" },
            { id: "m2", senderId: "a", createdAt: "2026-11-19T20:01:00Z" },
        ],
        { timeZone, now },
    );

    assert.deepEqual(groups[0].runs[0].messageIds, ["m1", "m2"]);
});
