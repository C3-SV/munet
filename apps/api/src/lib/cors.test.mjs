import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAllowedOrigin } from "./cors.ts";

test("normalizeAllowedOrigin adds https when the env var omits a protocol", () => {
  assert.equal(
    normalizeAllowedOrigin("munet-web.vercel.app"),
    "https://munet-web.vercel.app",
  );
});

test("normalizeAllowedOrigin preserves an explicit local origin", () => {
  assert.equal(
    normalizeAllowedOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
});
