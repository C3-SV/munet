import assert from "node:assert/strict";
import test from "node:test";
import {
    PRACTICE_DB_PREFIX,
    PRACTICE_EVENT_ID,
    PRACTICE_MEMBERSHIP_ID,
    PRACTICE_STATE_VERSION,
    isPracticeEvent,
    practiceDbName,
} from "./constants.ts";

test("identificadores fijos del modo práctica", () => {
    assert.equal(PRACTICE_EVENT_ID, "practice-local");
    assert.equal(PRACTICE_MEMBERSHIP_ID, "practice-membership");
    assert.equal(PRACTICE_DB_PREFIX, "munet-practice-");
});

test("la versión de estado es el entero 2", () => {
    assert.equal(Number.isInteger(PRACTICE_STATE_VERSION), true);
    assert.ok(PRACTICE_STATE_VERSION > 0);
    assert.equal(PRACTICE_STATE_VERSION, 2);
});

test("detecta solo el evento de práctica con comparación estricta", () => {
    assert.equal(isPracticeEvent("practice-local"), true);
    assert.equal(isPracticeEvent("11111111-1111-1111-1111-111111111111"), false);
    assert.equal(isPracticeEvent(""), false);
    assert.equal(isPracticeEvent(null), false);
    assert.equal(isPracticeEvent(undefined), false);
    assert.equal(isPracticeEvent("practice-local "), false);
});

test("construye el nombre de base de datos local por usuario", () => {
    assert.equal(practiceDbName("u1"), "munet-practice-u1");
});
