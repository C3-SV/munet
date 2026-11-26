import assert from "node:assert/strict";
import test from "node:test";
import { mergeFeedPosts, orderFeedPosts } from "./feed-order.ts";

const at = (iso) => Date.parse(iso);

// Publicación mínima con los campos que mira el orden: id, fecha, y fijado con su fecha de fijado.
const post = (id, createdAt, pinnedAt = null) => ({
    id,
    content: `texto ${id}`,
    createdAt,
    timestamp: at(createdAt),
    isPinned: pinnedAt !== null,
    pinnedAt,
});

const ids = (posts) => posts.map((item) => item.id);

test("fijados primero, por fecha de fijado descendente; el resto por fecha descendente", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T08:00:00.000Z", "2026-11-21T08:00:00.000Z");
    const c = post("c", "2026-11-21T10:00:00.000Z");
    const d = post("d", "2026-11-21T09:30:00.000Z", "2026-11-21T09:30:00.000Z");
    // Creado después que b, pero fijado antes: va detrás de b porque se fijó antes de que b se fijara.
    const f = post("f", "2026-11-21T09:45:00.000Z", "2026-11-21T07:30:00.000Z");

    assert.deepEqual(ids(orderFeedPosts([a, b, c, d, f])), ["d", "b", "f", "c", "a"]);
});

test("con orden antiguo, los fijados siguen primero y solo el resto cambia de sentido", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T08:00:00.000Z", "2026-11-21T08:00:00.000Z");
    const c = post("c", "2026-11-21T10:00:00.000Z");
    const d = post("d", "2026-11-21T09:30:00.000Z", "2026-11-21T09:30:00.000Z");

    assert.deepEqual(ids(orderFeedPosts([a, b, c, d], "oldest")), ["d", "b", "a", "c"]);
});

test("un fijado sin fecha de fijado va después de los que la tienen, ordenado por fecha", () => {
    const sinFecha = { ...post("x", "2026-11-21T11:00:00.000Z"), isPinned: true, pinnedAt: null };
    const conFecha = post("y", "2026-11-21T06:00:00.000Z", "2026-11-21T06:00:00.000Z");
    const otroSinFecha = { ...post("z", "2026-11-21T10:00:00.000Z"), isPinned: true, pinnedAt: null };
    const normal = post("n", "2026-11-21T12:00:00.000Z");

    assert.deepEqual(ids(orderFeedPosts([sinFecha, conFecha, otroSinFecha, normal])), ["y", "x", "z", "n"]);
});

test("no modifica la lista de entrada", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T10:00:00.000Z", "2026-11-21T08:00:00.000Z");
    const input = [a, b];

    const ordered = orderFeedPosts(input);

    assert.notEqual(ordered, input);
    assert.deepEqual(ids(input), ["a", "b"]);
});

test("conserva el orden de entrada entre publicaciones con la misma fecha", () => {
    const primero = post("primero", "2026-11-21T09:00:00.000Z");
    const segundo = post("segundo", "2026-11-21T09:00:00.000Z");
    const fijadoPrimero = post("fijado-1", "2026-11-21T08:00:00.000Z", "2026-11-21T08:00:00.000Z");
    const fijadoSegundo = post("fijado-2", "2026-11-21T07:00:00.000Z", "2026-11-21T08:00:00.000Z");

    assert.deepEqual(
        ids(orderFeedPosts([primero, segundo, fijadoPrimero, fijadoSegundo])),
        ["fijado-1", "fijado-2", "primero", "segundo"],
    );
});

test("no duplica una publicación que llega repetida", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T10:00:00.000Z");

    assert.deepEqual(ids(orderFeedPosts([a, b, a])), ["b", "a"]);
});

test("una lista vacía sigue vacía", () => {
    assert.deepEqual(orderFeedPosts([]), []);
});

test("mergeFeedPosts reemplaza en su sitio la publicación ya cargada y añade la nueva al final", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T10:00:00.000Z");
    const bActualizada = { ...b, content: "texto editado", commentCount: 3 };
    const c = post("c", "2026-11-21T11:00:00.000Z");

    const merged = mergeFeedPosts([a, b], [bActualizada, c]);

    assert.deepEqual(ids(merged), ["a", "b", "c"]);
    assert.equal(merged[1], bActualizada);
});

test("mergeFeedPosts no duplica una publicación propia que ya llegó por Realtime", () => {
    // Carrera: el refresco por Realtime trae la publicación antes de que responda el POST.
    const existente = post("existente", "2026-11-21T09:00:00.000Z");
    const nueva = post("nueva", "2026-11-21T10:00:00.000Z");

    const merged = mergeFeedPosts([nueva, existente], [nueva]);

    assert.deepEqual(ids(merged), ["nueva", "existente"]);
});

test("mergeFeedPosts quita duplicados que ya vengan repetidos en la lista actual o en la recibida", () => {
    const a = post("a", "2026-11-21T09:00:00.000Z");
    const b = post("b", "2026-11-21T10:00:00.000Z");

    assert.deepEqual(ids(mergeFeedPosts([a, a], [b, b])), ["a", "b"]);
});

test("una publicación fijada que llega después aparece primera al ordenar", () => {
    const normal = post("normal", "2026-11-21T12:00:00.000Z");
    const antigua = post("antigua", "2026-11-21T08:00:00.000Z");
    const fijada = post("fijada", "2026-11-21T07:00:00.000Z", "2026-11-21T13:00:00.000Z");

    const visible = orderFeedPosts(mergeFeedPosts([normal, antigua], [fijada]));

    assert.deepEqual(ids(visible), ["fijada", "normal", "antigua"]);
});
