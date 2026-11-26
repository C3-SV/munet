import test from "node:test";
import assert from "node:assert/strict";

import { canSubmitEdit, isEdited } from "./message-edit.ts";

test("se guarda solo con texto distinto del actual", () => {
    assert.equal(canSubmitEdit("Hola", "Hola mundo"), true);
    assert.equal(canSubmitEdit("Hola", "  Hola  "), false);
    assert.equal(canSubmitEdit("Hola", ""), false);
    assert.equal(canSubmitEdit("Hola", "   "), false);
});

test("«editado» aparece solo si hay fecha de edición", () => {
    assert.equal(isEdited({ editedAt: "2026-11-25T10:00:00Z" }), true);
    assert.equal(isEdited({ editedAt: null }), false);
    assert.equal(isEdited({}), false);
});
