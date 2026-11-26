import test from "node:test";
import assert from "node:assert/strict";

import { hasUnreadIncoming, markIncomingReadLocally, messageReadState, shouldMarkRead } from "./read-receipts.ts";

const m = (id, senderId, readAt) => ({ id, senderId, readAt });

test("un mensaje propio está enviado hasta que la otra persona lo lee", () => {
    assert.equal(messageReadState(m("1", "yo", null)), "sent");
    assert.equal(messageReadState(m("2", "yo")), "sent");
    assert.equal(messageReadState(m("3", "yo", "2026-11-25T10:00:00Z")), "read");
});

test("hay pendientes solo si la otra persona escribió y yo no lo he leído", () => {
    assert.equal(hasUnreadIncoming([m("1", "yo", null)], "yo"), false);
    assert.equal(hasUnreadIncoming([m("1", "otro", "2026-11-25T10:00:00Z")], "yo"), false);
    assert.equal(hasUnreadIncoming([m("1", "otro", null)], "yo"), true);
    assert.equal(hasUnreadIncoming([m("1", "otro", null)], null), false);
    assert.equal(hasUnreadIncoming([], "yo"), false);
});

test("marcar localmente solo cambia los recibidos sin leer", () => {
    const messages = [m("1", "otro", null), m("2", "yo", null), m("3", "otro", "antes")];
    const result = markIncomingReadLocally(messages, "yo", "ahora");

    assert.equal(result[0].readAt, "ahora");
    assert.equal(result[1].readAt, null);
    assert.equal(result[2].readAt, "antes");
    // No muta el original.
    assert.equal(messages[0].readAt, null);
});

test("no se marca como leído por haberlo recibido: hace falta verlo", () => {
    const base = { hasUnread: true, tabVisible: true, windowFocused: true, nearBottom: true, loaded: true };

    assert.equal(shouldMarkRead(base), true);
    assert.equal(shouldMarkRead({ ...base, tabVisible: false }), false);
    assert.equal(shouldMarkRead({ ...base, windowFocused: false }), false);
    assert.equal(shouldMarkRead({ ...base, nearBottom: false }), false);
    assert.equal(shouldMarkRead({ ...base, loaded: false }), false);
    assert.equal(shouldMarkRead({ ...base, hasUnread: false }), false);
});
