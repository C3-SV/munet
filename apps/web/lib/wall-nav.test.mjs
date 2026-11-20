import test from "node:test";
import assert from "node:assert/strict";

import { buildWallNav } from "./wall-nav.ts";

const wall = (overrides) => ({
    id: overrides.id ?? overrides.slug,
    eventId: "event-1",
    name: overrides.name ?? overrides.slug,
    wallType: "PUBLIC",
    kind: "other",
    slug: overrides.slug,
    committeeId: null,
    committeeName: null,
    committeeCode: null,
    canAccess: true,
    canPublish: false,
    ...overrides,
});

const announcements = wall({ slug: "avisos", name: "Avisos", kind: "announcements" });
const general = wall({ slug: "general", name: "General", kind: "general" });

const committee = (slug, committeeName) =>
    wall({
        slug,
        name: `Muro ${committeeName}`,
        kind: "committee",
        committeeId: `committee-${slug}`,
        committeeName,
    });

test("con avisos, general y un solo comite accesible, el comite es 'mine' y no hay grupo", () => {
    const nav = buildWallNav([announcements, general, committee("cpj", "CPJ")], null);

    assert.equal(nav.announcements?.slug, "avisos");
    assert.equal(nav.general?.slug, "general");
    assert.equal(nav.mine?.slug, "cpj");
    assert.deepEqual(nav.committees, []);
    assert.equal(nav.showCommitteeGroup, false);
});

test("con tres comites accesibles no hay 'mine', se listan los tres y se muestra el grupo", () => {
    const nav = buildWallNav(
        [
            announcements,
            general,
            committee("cpj", "CPJ"),
            committee("unsc", "UNSC"),
            committee("acnur", "ACNUR"),
        ],
        null,
    );

    assert.equal(nav.mine, null);
    assert.equal(nav.committees.length, 3);
    assert.equal(nav.showCommitteeGroup, true);
});

test("con dos comites accesibles se muestra el grupo y no hay 'mine'", () => {
    const nav = buildWallNav([general, committee("cpj", "CPJ"), committee("unsc", "UNSC")], null);

    assert.equal(nav.mine, null);
    assert.equal(nav.committees.length, 2);
    assert.equal(nav.showCommitteeGroup, true);
});

test("los muros con canAccess false se ignoran", () => {
    const blockedCommittee = { ...committee("secreto", "Secreto"), canAccess: false };
    const blockedGeneral = { ...general, slug: "general-bloqueado", canAccess: false };

    const nav = buildWallNav([announcements, blockedGeneral, blockedCommittee], null);

    assert.equal(nav.general, null);
    assert.equal(nav.mine, null);
    assert.deepEqual(nav.committees, []);
    assert.equal(nav.showCommitteeGroup, false);
});

test("sin ningun muro devuelve todo vacio sin lanzar", () => {
    const nav = buildWallNav([], null);

    assert.equal(nav.announcements, null);
    assert.equal(nav.general, null);
    assert.equal(nav.mine, null);
    assert.deepEqual(nav.committees, []);
    assert.equal(nav.showCommitteeGroup, false);
    assert.equal(nav.activeSlug, null);
});

test("activeSlug se devuelve tal cual", () => {
    assert.equal(buildWallNav([general], "general").activeSlug, "general");
    assert.equal(buildWallNav([general], "slug-inexistente").activeSlug, "slug-inexistente");
    assert.equal(buildWallNav([general], null).activeSlug, null);
});

test("general cae en el primer muro sin committeeId si no hay kind general", () => {
    const other = wall({ slug: "sala-unica", name: "Sala única", kind: "other", committeeId: null });
    const nav = buildWallNav([announcements, other], null);

    assert.equal(nav.general?.slug, "sala-unica");
});

test("general no toma el aviso ni un comite aunque no tenga kind general", () => {
    const nav = buildWallNav([announcements, committee("cpj", "CPJ")], null);

    assert.equal(nav.general, null);
});

test("announcements no se confunde con general cuando solo existe el de avisos", () => {
    const nav = buildWallNav([announcements], null);

    assert.equal(nav.announcements?.slug, "avisos");
    assert.equal(nav.general, null);
});
