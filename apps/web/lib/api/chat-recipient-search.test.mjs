import test from "node:test";
import assert from "node:assert/strict";

import {
    buildInitials,
    buildRecipientSearchKey,
    directoryEntryToRecipient,
    excludeOwnRecipient,
    resolveRecipientSearchMode,
    resolveRecipientSearchView,
} from "./chat-recipient-search.ts";

const COMMITTEE_ID = "11111111-1111-4111-8111-111111111111";

const sampleEntry = (membershipId, firstName, lastName) => ({
    membershipId,
    firstName,
    lastName,
    alias: null,
    committee: null,
    delegationCode: null,
});

test("resolveRecipientSearchMode shows the inbox when there is no committee and no text", () => {
    assert.equal(resolveRecipientSearchMode({ query: "", committeeId: "" }), "idle");
    assert.equal(resolveRecipientSearchMode({ query: "   ", committeeId: "" }), "idle");
});

test("resolveRecipientSearchMode uses the DM search when only text is entered", () => {
    assert.equal(resolveRecipientSearchMode({ query: "ana", committeeId: "" }), "dm");
});

test("resolveRecipientSearchMode uses the directory whenever a committee is selected", () => {
    assert.equal(resolveRecipientSearchMode({ query: "", committeeId: COMMITTEE_ID }), "directory");
    assert.equal(resolveRecipientSearchMode({ query: "ana", committeeId: COMMITTEE_ID }), "directory");
});

test("buildRecipientSearchKey is empty while idle or without an event", () => {
    assert.equal(buildRecipientSearchKey({ eventId: "evt-1", query: "", committeeId: "" }), "");
    assert.equal(buildRecipientSearchKey({ eventId: null, query: "ana", committeeId: "" }), "");
});

test("buildRecipientSearchKey changes with event, committee and text, but not with surrounding spaces", () => {
    const base = buildRecipientSearchKey({ eventId: "evt-1", query: "ana", committeeId: "" });

    assert.equal(buildRecipientSearchKey({ eventId: "evt-1", query: " ana ", committeeId: "" }), base);
    assert.notEqual(buildRecipientSearchKey({ eventId: "evt-2", query: "ana", committeeId: "" }), base);
    assert.notEqual(buildRecipientSearchKey({ eventId: "evt-1", query: "ana", committeeId: COMMITTEE_ID }), base);
    assert.notEqual(buildRecipientSearchKey({ eventId: "evt-1", query: "ani", committeeId: "" }), base);
});

test("resolveRecipientSearchView reports loading when no result belongs to the current context", () => {
    const staleResult = {
        key: buildRecipientSearchKey({ eventId: "evt-1", query: "ana", committeeId: "" }),
        status: "ready",
        participants: [directoryEntryToRecipient(sampleEntry("m-2", "Ana", "Lopez"))],
        hasMore: false,
        error: null,
    };
    const currentKey = buildRecipientSearchKey({ eventId: "evt-2", query: "ana", committeeId: "" });

    const view = resolveRecipientSearchView(currentKey, staleResult);

    assert.equal(view.status, "loading");
    assert.deepEqual(view.participants, []);
    assert.equal(resolveRecipientSearchView(currentKey, null).status, "loading");
});

test("resolveRecipientSearchView discards a result after the term changed", () => {
    const resultForOldTerm = {
        key: buildRecipientSearchKey({ eventId: "evt-1", query: "an", committeeId: "" }),
        status: "ready",
        participants: [directoryEntryToRecipient(sampleEntry("m-2", "Ana", "Lopez"))],
        hasMore: false,
        error: null,
    };
    const currentKey = buildRecipientSearchKey({ eventId: "evt-1", query: "ana", committeeId: "" });

    assert.equal(resolveRecipientSearchView(currentKey, resultForOldTerm).status, "loading");
});

test("resolveRecipientSearchView returns the result and error for the current context", () => {
    const key = buildRecipientSearchKey({ eventId: "evt-1", query: "ana", committeeId: "" });
    const participants = [directoryEntryToRecipient(sampleEntry("m-2", "Ana", "Lopez"))];

    assert.deepEqual(
        resolveRecipientSearchView(key, { key, status: "ready", participants, hasMore: true, error: null }),
        { status: "ready", participants, hasMore: true, error: null },
    );
    assert.deepEqual(
        resolveRecipientSearchView(key, { key, status: "error", participants: [], hasMore: false, error: "Fallo" }),
        { status: "error", participants: [], hasMore: false, error: "Fallo" },
    );
});

test("resolveRecipientSearchView is idle when there is no context", () => {
    assert.equal(resolveRecipientSearchView("", null).status, "idle");
});

test("excludeOwnRecipient removes the authenticated membership only", () => {
    const participants = [
        directoryEntryToRecipient(sampleEntry("m-1", "Yo", "Propio")),
        directoryEntryToRecipient(sampleEntry("m-2", "Ana", "Lopez")),
    ];

    assert.deepEqual(
        excludeOwnRecipient(participants, "m-1").map((participant) => participant.id),
        ["m-2"],
    );
    assert.equal(excludeOwnRecipient(participants, null).length, 2);
    assert.equal(excludeOwnRecipient(participants, "m-9").length, 2);
});

test("directoryEntryToRecipient maps public fields and falls back to alias or a neutral name", () => {
    const withCommittee = directoryEntryToRecipient({
        membershipId: "m-2",
        firstName: "  Ana ",
        lastName: "Lopez",
        alias: "Anita",
        committee: { id: COMMITTEE_ID, name: "Seguridad" },
        delegationCode: "MX-01",
    });

    assert.equal(withCommittee.id, "m-2");
    assert.equal(withCommittee.name, "Ana Lopez");
    assert.equal(withCommittee.committee, "Seguridad");
    assert.equal(withCommittee.delegationName, "MX-01");
    assert.equal(withCommittee.avatar, "");
    assert.equal(withCommittee.alias, "Anita");

    const aliasOnly = directoryEntryToRecipient({
        membershipId: "m-3",
        firstName: "",
        lastName: " ",
        alias: "Ñandú",
        committee: null,
        delegationCode: null,
    });

    assert.equal(aliasOnly.name, "Ñandú");
    assert.equal(aliasOnly.committee, "Sin comité");
    assert.equal(aliasOnly.delegationName, null);

    const anonymous = directoryEntryToRecipient({
        membershipId: "m-4",
        firstName: "",
        lastName: "",
        alias: null,
        committee: null,
        delegationCode: null,
    });

    assert.equal(anonymous.name, "Participante");
});

test("buildInitials uses the first letter of the first two words", () => {
    assert.equal(buildInitials("ana lopez garcia"), "AL");
    assert.equal(buildInitials("  Ñandú  "), "Ñ");
    assert.equal(buildInitials(""), "");
});
