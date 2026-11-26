import test from "node:test";
import assert from "node:assert/strict";

import { clampIndex, indexFromScroll, keyToDelta, nearbyIndexes, stepIndex } from "./carousel.ts";

test("clampIndex limita al rango válido", () => {
    assert.equal(clampIndex(-3, 5), 0);
    assert.equal(clampIndex(2, 5), 2);
    assert.equal(clampIndex(9, 5), 4);
    assert.equal(clampIndex(3, 0), 0);
});

test("indexFromScroll redondea a la diapositiva más cercana y tolera anchos inválidos", () => {
    assert.equal(indexFromScroll(0, 400, 5), 0);
    assert.equal(indexFromScroll(190, 400, 5), 0);
    assert.equal(indexFromScroll(210, 400, 5), 1);
    assert.equal(indexFromScroll(1600, 400, 5), 4);
    assert.equal(indexFromScroll(99999, 400, 5), 4);
    assert.equal(indexFromScroll(100, 0, 5), 0);
});

test("stepIndex avanza y retrocede sin pasar de los extremos", () => {
    assert.equal(stepIndex(0, -1, 4), 0);
    assert.equal(stepIndex(0, 1, 4), 1);
    assert.equal(stepIndex(3, 1, 4), 3);
    assert.equal(stepIndex(2, -1, 4), 1);
});

test("keyToDelta traduce las flechas", () => {
    assert.equal(keyToDelta("ArrowRight"), 1);
    assert.equal(keyToDelta("ArrowLeft"), -1);
    assert.equal(keyToDelta("Enter"), null);
    assert.equal(keyToDelta("a"), null);
});

test("nearbyIndexes devuelve la actual y las vecinas dentro del rango", () => {
    assert.deepEqual(nearbyIndexes(0, 5), [0, 1]);
    assert.deepEqual(nearbyIndexes(2, 5), [1, 2, 3]);
    assert.deepEqual(nearbyIndexes(4, 5), [3, 4]);
    assert.deepEqual(nearbyIndexes(0, 1), [0]);
});
