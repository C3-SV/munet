import test from "node:test";
import assert from "node:assert/strict";

import { getEventStatusToggleTarget } from "./admin-event-status.ts";

test("un evento activo ofrece cerrarlo", () => {
    assert.equal(getEventStatusToggleTarget("ACTIVE"), "CLOSED");
});

test("un evento cerrado ofrece reabrirlo", () => {
    assert.equal(getEventStatusToggleTarget("CLOSED"), "ACTIVE");
});

test("un evento archivado no tiene botón de cambio rápido", () => {
    assert.equal(getEventStatusToggleTarget("ARCHIVED"), null);
});

test("un estado desconocido no ofrece ningún cambio", () => {
    assert.equal(getEventStatusToggleTarget(""), null);
    assert.equal(getEventStatusToggleTarget("active"), null);
    assert.equal(getEventStatusToggleTarget("constructor"), null);
});
