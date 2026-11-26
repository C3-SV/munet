import test from "node:test";
import assert from "node:assert/strict";

import { QUOTA_ALERT_RATIO, QUOTA_BLOCK_RATIO, evaluateStorageQuota, parseQuotaBytes } from "./storage-quota.ts";

const GB = 1024 ** 3;

test("los umbrales son 90 % para alertar y 95 % para bloquear", () => {
  assert.equal(QUOTA_ALERT_RATIO, 0.9);
  assert.equal(QUOTA_BLOCK_RATIO, 0.95);
});

test("sin cuota configurada no hay protección", () => {
  assert.equal(evaluateStorageQuota({ quotaBytes: null, usedBytes: 999 * GB }).level, "disabled");
  assert.equal(parseQuotaBytes(undefined), null);
  assert.equal(parseQuotaBytes(""), null);
  assert.equal(parseQuotaBytes("0"), null);
  assert.equal(parseQuotaBytes("-5"), null);
  assert.equal(parseQuotaBytes("10GB"), null);
  assert.equal(parseQuotaBytes("1.5"), null);
});

test("parseQuotaBytes acepta un entero positivo", () => {
  assert.equal(parseQuotaBytes("10737418240"), 10 * GB);
  assert.equal(parseQuotaBytes(" 1000 "), 1000);
});

test("por debajo del 90 % todo normal", () => {
  const status = evaluateStorageQuota({ quotaBytes: 100, usedBytes: 89 });
  assert.equal(status.level, "ok");
  assert.equal(status.usedPercent, 89);
});

test("desde el 90 % hay alerta pero se sigue aceptando", () => {
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 90 }).level, "alert");
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 94 }).level, "alert");
  // 94 + 0 sigue por debajo del bloqueo.
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 94, incomingBytes: 0 }).level, "alert");
});

test("desde el 95 % se bloquean las cargas nuevas", () => {
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 95 }).level, "blocked");
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 100 }).level, "blocked");
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 120 }).level, "blocked");
});

test("también se bloquea la carga que haría pasar el uso del 95 %", () => {
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 80, incomingBytes: 14 }).level, "alert");
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 80, incomingBytes: 15 }).level, "blocked");
  assert.equal(evaluateStorageQuota({ quotaBytes: 100, usedBytes: 10, incomingBytes: 5 }).level, "ok");
});

test("informa el uso actual y el proyectado", () => {
  const status = evaluateStorageQuota({ quotaBytes: 200, usedBytes: 100, incomingBytes: 50 });
  assert.equal(status.usedPercent, 50);
  assert.equal(status.projectedPercent, 75);
});
