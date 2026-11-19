import test from "node:test";
import assert from "node:assert/strict";

import {
    formatDateTime,
    formatDayLabel,
    formatTime,
    isSameLocalDay,
} from "./format-datetime.ts";

const timeZone = "America/El_Salvador";

test("formatDateTime muestra fecha y hora locales", () => {
    assert.equal(
        formatDateTime("2026-11-19T20:32:00Z", { timeZone }),
        "19 nov 2026 · 14:32",
    );
});

test("formatDateTime usa enero sin punto final", () => {
    assert.equal(
        formatDateTime("2026-01-05T15:05:00Z", { timeZone }),
        "5 ene 2026 · 09:05",
    );
});

test("formatTime muestra solo la hora", () => {
    assert.equal(formatTime("2026-11-19T20:32:00Z", { timeZone }), "14:32");
});

test("formatDateTime devuelve raya para valores inválidos", () => {
    assert.equal(formatDateTime(null, { timeZone }), "—");
    assert.equal(formatDateTime("", { timeZone }), "—");
    assert.equal(formatDateTime("no-fecha", { timeZone }), "—");
    assert.equal(formatTime("no-fecha", { timeZone }), "—");
});

test("formatDayLabel distingue Hoy, Ayer y fecha completa", () => {
    const now = new Date("2026-11-19T20:00:00Z");
    assert.equal(
        formatDayLabel("2026-11-19T05:50:00Z", { timeZone, now }),
        "Ayer",
    );
    assert.equal(
        formatDayLabel("2026-11-19T18:00:00Z", { timeZone, now }),
        "Hoy",
    );
    assert.equal(
        formatDayLabel("2026-11-17T18:00:00Z", { timeZone, now }),
        "17 nov 2026",
    );
});

test("isSameLocalDay respeta la medianoche local", () => {
    assert.equal(
        isSameLocalDay("2026-11-19T05:50:00Z", "2026-11-19T07:00:00Z", { timeZone }),
        false,
    );
    assert.equal(
        isSameLocalDay("2026-11-19T15:00:00Z", "2026-11-19T20:00:00Z", { timeZone }),
        true,
    );
});
