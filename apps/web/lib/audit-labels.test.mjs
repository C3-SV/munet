import test from "node:test";
import assert from "node:assert/strict";

import {
    formatAuditAction,
    formatAuditEntity,
    formatAuditOutcome,
} from "./audit-labels.ts";

test("traduce las acciones conocidas al español", () => {
    assert.equal(formatAuditAction("MODERATE_DELETE_POST"), "Publicación eliminada por moderación");
    assert.equal(formatAuditAction("CHANGE_ROLE"), "Rol cambiado");
    assert.equal(formatAuditAction("ACCESS_DENIED"), "Acceso denegado");
    assert.equal(formatAuditAction("HIDE_POST"), "Publicación ocultada");
    assert.equal(formatAuditAction("UNHIDE_COMMENT"), "Comentario restaurado");
});

test("una acción desconocida se muestra tal cual", () => {
    assert.equal(formatAuditAction("HIDE_POST_V2"), "HIDE_POST_V2");
    assert.equal(formatAuditAction("  SOME_NEW_ACTION  "), "SOME_NEW_ACTION");
});

test("nombres heredados de objetos no se tratan como etiquetas", () => {
    assert.equal(formatAuditAction("constructor"), "constructor");
    assert.equal(formatAuditAction("__proto__"), "__proto__");
    assert.equal(formatAuditEntity("toString"), "toString");
    assert.equal(formatAuditOutcome("hasOwnProperty"), "hasOwnProperty");
});

test("valores vacíos o ausentes muestran raya", () => {
    assert.equal(formatAuditAction(null), "—");
    assert.equal(formatAuditAction(undefined), "—");
    assert.equal(formatAuditAction("   "), "—");
    assert.equal(formatAuditEntity(""), "—");
    assert.equal(formatAuditOutcome(null), "—");
});

test("traduce tipos de entidad y resultados", () => {
    assert.equal(formatAuditEntity("DM_MESSAGE"), "Mensaje directo");
    assert.equal(formatAuditEntity("MEMBERSHIP"), "Membresía");
    assert.equal(formatAuditOutcome("SUCCESS"), "Correcto");
    assert.equal(formatAuditOutcome("DENIED"), "Denegado");
    assert.equal(formatAuditOutcome("PENDING"), "PENDING");
});
