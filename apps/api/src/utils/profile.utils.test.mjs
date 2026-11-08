import test from "node:test";
import assert from "node:assert/strict";

import {
  ALIAS_MAX_LENGTH,
  findProtectedFields,
  parseAlias,
} from "./profile.utils.ts";

test("parseAlias recorta espacios y acepta un alias válido", () => {
  assert.deepEqual(parseAlias("  Anita  "), { value: "Anita" });
});

test("parseAlias convierte null, undefined y vacío en alias borrado (null)", () => {
  assert.deepEqual(parseAlias(null), { value: null });
  assert.deepEqual(parseAlias(undefined), { value: null });
  assert.deepEqual(parseAlias(""), { value: null });
  assert.deepEqual(parseAlias("    "), { value: null });
});

test("parseAlias acepta exactamente el máximo y rechaza uno más", () => {
  assert.deepEqual(parseAlias("a".repeat(ALIAS_MAX_LENGTH)), {
    value: "a".repeat(ALIAS_MAX_LENGTH),
  });
  assert.ok("error" in parseAlias("a".repeat(ALIAS_MAX_LENGTH + 1)));
});

test("parseAlias rechaza valores que no son texto", () => {
  assert.ok("error" in parseAlias(42));
  assert.ok("error" in parseAlias({}));
});

test("findProtectedFields detecta campos que el participante no puede editar", () => {
  assert.deepEqual(
    findProtectedFields({ alias: "x", role: "ADMIN_MUN", delegation_code: "#1" }),
    ["role", "delegation_code"],
  );
  assert.deepEqual(findProtectedFields({ alias: "x", bio: "hola" }), []);
  assert.deepEqual(findProtectedFields(null), []);
});
