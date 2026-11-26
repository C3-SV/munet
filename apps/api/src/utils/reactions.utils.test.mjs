import test from "node:test";
import assert from "node:assert/strict";

import { REACTION_TYPES, emptyReactionSummary, isReactionType, summarizeReactions } from "./reactions.utils.ts";

test("las reacciones iniciales son me gusta, me encanta, risa y aplausos", () => {
  assert.deepEqual([...REACTION_TYPES], ["LIKE", "LOVE", "LAUGH", "CLAP"]);
});

test("isReactionType acepta solo los tipos permitidos", () => {
  for (const value of REACTION_TYPES) assert.equal(isReactionType(value), true);
  for (const value of ["like", "ANGRY", "", null, undefined, 1, {}]) assert.equal(isReactionType(value), false);
});

test("emptyReactionSummary arranca en cero y sin reacción propia", () => {
  assert.deepEqual(emptyReactionSummary(), { counts: { LIKE: 0, LOVE: 0, LAUGH: 0, CLAP: 0 }, mine: null });
});

test("summarizeReactions cuenta por tipo e identifica la reacción propia", () => {
  const rows = [
    { post_id: "p1", membership_id: "a", reaction: "LIKE" },
    { post_id: "p1", membership_id: "b", reaction: "LIKE" },
    { post_id: "p1", membership_id: "yo", reaction: "CLAP" },
    { post_id: "p2", membership_id: "a", reaction: "LOVE" },
  ];
  const summaries = summarizeReactions(["p1", "p2", "p3"], rows, "yo");

  assert.deepEqual(summaries.get("p1"), { counts: { LIKE: 2, LOVE: 0, LAUGH: 0, CLAP: 1 }, mine: "CLAP" });
  assert.deepEqual(summaries.get("p2"), { counts: { LIKE: 0, LOVE: 1, LAUGH: 0, CLAP: 0 }, mine: null });
  assert.deepEqual(summaries.get("p3"), emptyReactionSummary());
});

test("summarizeReactions ignora tipos desconocidos y publicaciones que no se pidieron", () => {
  const rows = [
    { post_id: "p1", membership_id: "a", reaction: "FUTURO" },
    { post_id: "otro", membership_id: "a", reaction: "LIKE" },
  ];
  const summaries = summarizeReactions(["p1"], rows, "yo");

  assert.deepEqual(summaries.get("p1"), emptyReactionSummary());
  assert.equal(summaries.has("otro"), false);
});
