import test from "node:test";
import assert from "node:assert/strict";

import { generateInitialPassword } from "./password.utils.ts";

test("la contraseña inicial tiene 12 caracteres y los 4 tipos", () => {
  for (let i = 0; i < 200; i++) {
    const password = generateInitialPassword();
    assert.equal(password.length, 12);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!#$%&*?]/);
  }
});

test("la contraseña inicial nunca empieza con un carácter que Excel trate como fórmula", () => {
  for (let i = 0; i < 5000; i++) {
    assert.doesNotMatch(generateInitialPassword()[0], /[=+\-@]/);
  }
});

test("la contraseña inicial no contiene '@' ni caracteres ambiguos", () => {
  for (let i = 0; i < 1000; i++) {
    assert.doesNotMatch(generateInitialPassword(), /[@0O1lI]/);
  }
});
