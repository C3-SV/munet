import test from "node:test";
import assert from "node:assert/strict";

import { REACTIONS, applyReaction, emptyReactions, nextReaction, totalReactions } from "./reactions.ts";

const withCounts = (counts, mine = null) => ({ counts: { ...emptyReactions().counts, ...counts }, mine });

test("las cuatro reacciones iniciales", () => {
    assert.deepEqual(REACTIONS.map((r) => r.type), ["LIKE", "LOVE", "LAUGH", "CLAP"]);
    assert.deepEqual(REACTIONS.map((r) => r.emoji), ["👍", "❤️", "😂", "👏"]);
});

test("pulsar sin reacción previa la agrega", () => {
    const result = applyReaction(withCounts({ LIKE: 2 }), "LIKE");

    assert.equal(result.mine, "LIKE");
    assert.equal(result.counts.LIKE, 3);
});

test("pulsar la reacción propia la retira", () => {
    const result = applyReaction(withCounts({ LIKE: 3 }, "LIKE"), "LIKE");

    assert.equal(result.mine, null);
    assert.equal(result.counts.LIKE, 2);
});

test("pulsar otra distinta cambia la reacción: baja la anterior y sube la nueva", () => {
    const result = applyReaction(withCounts({ LIKE: 3, CLAP: 1 }, "LIKE"), "CLAP");

    assert.equal(result.mine, "CLAP");
    assert.equal(result.counts.LIKE, 2);
    assert.equal(result.counts.CLAP, 2);
});

test("nunca deja contadores negativos y no muta el original", () => {
    const original = withCounts({ LIKE: 0 }, "LIKE");
    const result = applyReaction(original, "LIKE");

    assert.equal(result.counts.LIKE, 0);
    assert.equal(original.mine, "LIKE");
});

test("nextReaction y totalReactions", () => {
    assert.equal(nextReaction(null, "LOVE"), "LOVE");
    assert.equal(nextReaction("LOVE", "LOVE"), null);
    assert.equal(nextReaction("LOVE", "CLAP"), "CLAP");
    assert.equal(totalReactions(withCounts({ LIKE: 2, LAUGH: 3 })), 5);
    assert.equal(totalReactions(emptyReactions()), 0);
});
