import test from "node:test";
import assert from "node:assert/strict";

import { buildCsv, escapeCsvCell } from "./csv.ts";

test("escapeCsvCell envuelve y duplica comillas", () => {
    assert.equal(escapeCsvCell('Ana "La Jefa"'), '"Ana ""La Jefa"""');
});

test("escapeCsvCell neutraliza fórmulas de Excel", () => {
    for (const value of ["=1+1", "+SUM(A1)", "-2", "@cmd"]) {
        assert.equal(escapeCsvCell(value), `"'${value}"`);
    }
});

test("escapeCsvCell convierte null y undefined en celdas vacías", () => {
    assert.equal(escapeCsvCell(null), '""');
    assert.equal(escapeCsvCell(undefined), '""');
});

test("buildCsv agrega BOM y usa CRLF", () => {
    const csv = buildCsv(["nombre", "apellido"], [["Ana", "Pérez"]]);

    assert.ok(csv.startsWith("\uFEFF"));
    assert.equal(csv, '\uFEFF"nombre","apellido"\r\n"Ana","Pérez"\r\n');
});
