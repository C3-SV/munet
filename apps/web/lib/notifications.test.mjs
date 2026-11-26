import test from "node:test";
import assert from "node:assert/strict";

import {
    conversationIdsToWatch,
    formatBadge,
    isNewAnnouncement,
    MAX_REALTIME_CONVERSATIONS,
    totalUnread,
    withAnnouncementsRead,
    withConversationRead,
} from "./notifications.ts";

const summary = () => ({
    unread: { total: 8, dms: 5, announcements: 3 },
    announcements: { wallId: "w", slug: "avisos", name: "Avisos", lastReadAt: "2026-11-20T00:00:00Z", unreadCount: 3, latest: [{ postId: "p1" }] },
    dms: [
        { conversationId: "c1", unreadCount: 2 },
        { conversationId: "c2", unreadCount: 3 },
    ],
    conversationIds: ["c0", "c1", "c2", "c3"],
});

test("formatBadge: oculta el cero y limita a 99+", () => {
    assert.equal(formatBadge(0), null);
    assert.equal(formatBadge(undefined), null);
    assert.equal(formatBadge(null), null);
    assert.equal(formatBadge(1), "1");
    assert.equal(formatBadge(99), "99");
    assert.equal(formatBadge(100), "99+");
});

test("totalUnread tolera que aún no haya resumen", () => {
    assert.equal(totalUnread(null), 0);
    assert.equal(totalUnread(summary()), 8);
});

test("abrir los avisos los quita del resumen y del total sin tocar los mensajes", () => {
    const result = withAnnouncementsRead(summary());

    assert.equal(result.unread.announcements, 0);
    assert.equal(result.unread.total, 5);
    assert.equal(result.unread.dms, 5);
    assert.equal(result.announcements.unreadCount, 0);
    assert.deepEqual(result.announcements.latest, []);
    assert.equal(result.dms.length, 2);
});

test("abrir los avisos sin resumen o sin muro no cambia nada", () => {
    assert.equal(withAnnouncementsRead(null), null);
    const noWall = { ...summary(), announcements: null };
    assert.equal(withAnnouncementsRead(noWall), noWall);
});

test("abrir una conversación la quita de pendientes y descuenta del total", () => {
    const result = withConversationRead(summary(), "c1");

    assert.deepEqual(result.dms.map((item) => item.conversationId), ["c2"]);
    assert.equal(result.unread.dms, 3);
    assert.equal(result.unread.total, 6);
    assert.equal(result.unread.announcements, 3);
});

test("abrir una conversación sin pendientes no cambia el resumen", () => {
    const original = summary();
    assert.equal(withConversationRead(original, "c3"), original);
    assert.equal(withConversationRead(null, "c1"), null);
});

test("conversaciones a vigilar: primero las pendientes, sin repetir y con tope", () => {
    assert.deepEqual(conversationIdsToWatch(summary()), ["c1", "c2", "c0", "c3"]);
    assert.deepEqual(conversationIdsToWatch(null), []);

    const many = { ...summary(), dms: [], conversationIds: Array.from({ length: 80 }, (_, i) => `c${i}`) };
    assert.equal(conversationIdsToWatch(many).length, MAX_REALTIME_CONVERSATIONS);
});

test("un aviso es nuevo si es posterior a la última lectura y de otra persona", () => {
    const post = (createdAt, id = "otro") => ({ createdAt, user: { id } });
    const lastRead = "2026-11-20T00:00:00Z";

    assert.equal(isNewAnnouncement(post("2026-11-21T00:00:00Z"), lastRead, "yo"), true);
    assert.equal(isNewAnnouncement(post("2026-11-19T00:00:00Z"), lastRead, "yo"), false);
    assert.equal(isNewAnnouncement(post("2026-11-21T00:00:00Z", "yo"), lastRead, "yo"), false);
    assert.equal(isNewAnnouncement(post("2026-11-21T00:00:00Z"), null, "yo"), false);
});
