import test from "node:test";
import assert from "node:assert/strict";

import {
    COMMITTEE_DELETE_FALLBACK_MESSAGE,
    describeCommitteeDeleteError,
} from "./admin-committee-delete.ts";

test("sin respuesta HTTP se indica que no hay conexión", () => {
    assert.match(describeCommitteeDeleteError(null), /conexión/);
});

test("403 indica falta de permiso sobre el evento", () => {
    assert.match(describeCommitteeDeleteError(403), /permiso/);
});

test("404 indica que el comité ya no existe", () => {
    assert.match(describeCommitteeDeleteError(404), /ya no existe/);
});

test("429 pide esperar antes de reintentar", () => {
    assert.match(describeCommitteeDeleteError(429), /Demasiados intentos/);
});

test("400 y 500 usan el mensaje genérico en vez del texto técnico del servidor", () => {
    assert.equal(describeCommitteeDeleteError(400), COMMITTEE_DELETE_FALLBACK_MESSAGE);
    assert.equal(describeCommitteeDeleteError(500), COMMITTEE_DELETE_FALLBACK_MESSAGE);
});

test("cualquier otro código cae en el mensaje genérico", () => {
    assert.equal(describeCommitteeDeleteError(418), COMMITTEE_DELETE_FALLBACK_MESSAGE);
});
