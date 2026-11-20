import test from "node:test";
import assert from "node:assert/strict";

import { buildPersonLabel } from "./person-label.ts";

test("muestra nombre y alias recortados", () => {
    const label = buildPersonLabel({ name: "  Ana López ", alias: "  La Canciller " });

    assert.equal(label.primary, "Ana López");
    assert.equal(label.alias, "La Canciller");
});

test("alias vacío, solo espacios o ausente queda en null", () => {
    assert.equal(buildPersonLabel({ name: "Ana", alias: "" }).alias, null);
    assert.equal(buildPersonLabel({ name: "Ana", alias: "   " }).alias, null);
    assert.equal(buildPersonLabel({ name: "Ana", alias: null }).alias, null);
    assert.equal(buildPersonLabel({ name: "Ana" }).alias, null);
});

test("alias igual al nombre sin distinguir mayúsculas queda en null", () => {
    assert.equal(buildPersonLabel({ name: "Ana López", alias: "ana lópez" }).alias, null);
    assert.equal(buildPersonLabel({ name: "Ana", alias: " ANA " }).alias, null);
});

test("el comité es la línea secundaria", () => {
    const label = buildPersonLabel({
        name: "Ana",
        committeeName: " Consejo de Seguridad ",
        roleName: "Delegado",
    });

    assert.equal(label.secondary, "Consejo de Seguridad");
});

test("sin comité usa el rol como línea secundaria", () => {
    assert.equal(buildPersonLabel({ name: "Ana", committeeName: "  ", roleName: "Delegado" }).secondary, "Delegado");
    assert.equal(buildPersonLabel({ name: "Ana", roleName: "Mesa" }).secondary, "Mesa");
});

test("sin comité ni rol no hay línea secundaria ni texto de relleno", () => {
    const label = buildPersonLabel({ name: "Ana" });

    assert.equal(label.secondary, null);
    assert.ok(!JSON.stringify(label).includes("SIN ASIGNAR"));
});

test("sin nombre el principal es Participante", () => {
    assert.equal(buildPersonLabel({}).primary, "Participante");
    assert.equal(buildPersonLabel({ name: "   " }).primary, "Participante");
    assert.equal(buildPersonLabel({ name: null }).primary, "Participante");
});

test("las iniciales toman las dos primeras palabras", () => {
    assert.equal(buildPersonLabel({ name: "Ana María López" }).initials, "AM");
    assert.equal(buildPersonLabel({ name: "Zoe" }).initials, "Z");
});

test("un nombre de 80 caracteres sin espacios se devuelve íntegro", () => {
    const name = "a".repeat(80);

    assert.equal(buildPersonLabel({ name }).primary, name);
});
