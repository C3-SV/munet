import test from "node:test";
import assert from "node:assert/strict";

import { buildCredentialsCsv, CREDENTIAL_HEADERS } from "./credentials-csv.ts";

const row = (over = {}) => ({
    first_name: "Ana",
    last_name: "Pérez",
    alias: "Anita",
    committee_label: "AG",
    participant_code: "ana.perez",
    delegation_code: "#007",
    initial_password: "Xk9!mQ2#vLp4",
    ...over,
});

const parseLine = (line) => line.match(/"(?:[^"]|"")*"/g).map((c) => c.slice(1, -1).replace(/""/g, '"'));

test("los encabezados distinguen el código para iniciar sesión del número de delegación", () => {
    const joined = CREDENTIAL_HEADERS.join("|").toLowerCase();

    assert.match(joined, /código para iniciar sesión/);
    assert.match(joined, /contraseña temporal/);
    assert.match(joined, /número de delegación #.*no sirve para entrar/);
    // Ya no existe la etiqueta ambigua "Código de login" / "Código #".
    assert.doesNotMatch(joined, /código de login/);
    assert.equal(CREDENTIAL_HEADERS.filter((h) => /código/i.test(h)).length, 1);
});

test("el código y la contraseña exportados son exactamente los que sirven para entrar", () => {
    // Casos que antes se corrompían con un apóstrofe antepuesto.
    const tricky = [
        { participant_code: "-codigo", initial_password: "@Abc123456789" },
        { participant_code: "ana.perez", initial_password: "=Ab12!cdefgh" },
        { participant_code: "+x1", initial_password: "-Zz9#yyyyyyy" },
    ];

    for (const over of tricky) {
        const csv = buildCredentialsCsv([row(over)]);
        const cells = parseLine(csv.split("\r\n")[1]);

        assert.equal(cells[4], over.participant_code);
        assert.equal(cells[5], over.initial_password);
    }
});

test("el número de delegación va al final y marca los que aún no tienen", () => {
    const [, first, second] = buildCredentialsCsv([row(), row({ delegation_code: null })]).split("\r\n");

    assert.equal(parseLine(first)[6], "#007");
    assert.equal(parseLine(second)[6], "Sin asignar");
});

test("el nombre y el alias siguen neutralizando fórmulas", () => {
    const csv = buildCredentialsCsv([row({ first_name: "=HYPERLINK(x)", alias: "+cmd" })]);
    const cells = parseLine(csv.split("\r\n")[1]);

    assert.equal(cells[0], "'=HYPERLINK(x)");
    assert.equal(cells[2], "'+cmd");
});
