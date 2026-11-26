import test from "node:test";
import assert from "node:assert/strict";

import {
    DEFAULT_SIDEBAR_PREFERENCE,
    SIDEBAR_COLLAPSED_WIDTH,
    SIDEBAR_DEFAULT_WIDTH,
    SIDEBAR_MAX_WIDTH,
    SIDEBAR_MIN_WIDTH,
    clampSidebarWidth,
    effectiveSidebarWidth,
    parseSidebarPreference,
    serializeSidebarPreference,
    sidebarStorageKey,
    widthAfterKey,
    widthFromPointer,
} from "./sidebar-width.ts";

test("el ancho se mantiene entre el mínimo y el máximo", () => {
    assert.equal(clampSidebarWidth(100), SIDEBAR_MIN_WIDTH);
    assert.equal(clampSidebarWidth(9999), SIDEBAR_MAX_WIDTH);
    assert.equal(clampSidebarWidth(300.6), 301);
    assert.equal(clampSidebarWidth(Number.NaN), SIDEBAR_DEFAULT_WIDTH);
    assert.equal(clampSidebarWidth(Infinity), SIDEBAR_DEFAULT_WIDTH);
});

test("contraída ocupa solo el ancho de iconos y expandida su ancho guardado", () => {
    assert.equal(effectiveSidebarWidth({ width: 300, collapsed: true }), SIDEBAR_COLLAPSED_WIDTH);
    assert.equal(effectiveSidebarWidth({ width: 300, collapsed: false }), 300);
    assert.equal(effectiveSidebarWidth({ width: 5000, collapsed: false }), SIDEBAR_MAX_WIDTH);
});

test("la preferencia se guarda y se recupera igual", () => {
    const saved = serializeSidebarPreference({ width: 320, collapsed: true });

    assert.deepEqual(parseSidebarPreference(saved), { width: 320, collapsed: true });
});

test("datos ausentes o dañados vuelven al valor predeterminado", () => {
    for (const raw of [null, undefined, "", "no es json", "null", "42", "[]"]) {
        assert.deepEqual(parseSidebarPreference(raw), DEFAULT_SIDEBAR_PREFERENCE, String(raw));
    }
});

test("una preferencia parcial o fuera de rango se corrige", () => {
    assert.deepEqual(parseSidebarPreference('{"width":10}'), { width: SIDEBAR_MIN_WIDTH, collapsed: false });
    assert.deepEqual(parseSidebarPreference('{"collapsed":true}'), { width: SIDEBAR_DEFAULT_WIDTH, collapsed: true });
    assert.deepEqual(parseSidebarPreference('{"width":"ancho","collapsed":"si"}'), DEFAULT_SIDEBAR_PREFERENCE);
});

test("cada persona tiene su propia clave", () => {
    assert.notEqual(sidebarStorageKey("a"), sidebarStorageKey("b"));
    assert.equal(sidebarStorageKey(null), sidebarStorageKey(undefined));
});

test("teclado: flechas, Mayús, Inicio y Fin respetan los límites", () => {
    assert.equal(widthAfterKey("ArrowRight", 256), 272);
    assert.equal(widthAfterKey("ArrowLeft", 256), 240);
    assert.equal(widthAfterKey("ArrowRight", 256, true), 304);
    assert.equal(widthAfterKey("ArrowLeft", SIDEBAR_MIN_WIDTH), SIDEBAR_MIN_WIDTH);
    assert.equal(widthAfterKey("ArrowRight", SIDEBAR_MAX_WIDTH), SIDEBAR_MAX_WIDTH);
    assert.equal(widthAfterKey("Home", 300), SIDEBAR_MIN_WIDTH);
    assert.equal(widthAfterKey("End", 300), SIDEBAR_MAX_WIDTH);
    assert.equal(widthAfterKey("Enter", 300), null);
});

test("arrastrar calcula el ancho desde la posición del puntero", () => {
    assert.equal(widthFromPointer(300), 300);
    assert.equal(widthFromPointer(350, 50), 300);
    assert.equal(widthFromPointer(10), SIDEBAR_MIN_WIDTH);
    assert.equal(widthFromPointer(2000), SIDEBAR_MAX_WIDTH);
});
