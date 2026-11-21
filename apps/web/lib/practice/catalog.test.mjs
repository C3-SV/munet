import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_COMMITTEES, buildPracticeWalls } from "./catalog.ts";

const CS_ID = "practice-committee-cs";

test("define los cuatro comités del modo práctica", () => {
    assert.deepEqual(
        PRACTICE_COMMITTEES.map(({ id, code, name }) => ({ id, code, name })),
        [
            { id: "practice-committee-ag", code: "AG", name: "Asamblea General" },
            { id: "practice-committee-cs", code: "CS", name: "Consejo de Seguridad" },
            { id: "practice-committee-unicef", code: "UNICEF", name: "UNICEF" },
            { id: "practice-committee-ecosoc", code: "ECOSOC", name: "ECOSOC" },
        ],
    );
});

test("construye seis muros con los slugs esperados", () => {
    const walls = buildPracticeWalls(CS_ID);
    assert.equal(walls.length, 6);
    assert.equal(new Set(walls.map((wall) => wall.id)).size, 6);
    assert.deepEqual(
        walls.map((wall) => wall.slug),
        ["avisos", "general", "comite-ag", "comite-cs", "comite-unicef", "comite-ecosoc"],
    );
});

test("avisos no admite publicar y general sí", () => {
    const [avisos, general] = buildPracticeWalls(CS_ID);
    assert.equal(avisos.kind, "announcements");
    assert.equal(avisos.wallType, "ANNOUNCEMENTS");
    assert.equal(avisos.canAccess, true);
    assert.equal(avisos.canPublish, false);
    assert.equal(general.kind, "general");
    assert.equal(general.wallType, "GENERAL");
    assert.equal(general.canAccess, true);
    assert.equal(general.canPublish, true);
});

test("solo el comité de la persona tiene acceso y publicación", () => {
    const committees = buildPracticeWalls(CS_ID).filter((wall) => wall.kind === "committee");
    assert.equal(committees.length, 4);
    for (const wall of committees) {
        assert.equal(wall.wallType, "COMMITTEE");
        const own = wall.slug === "comite-cs";
        assert.equal(wall.canAccess, own, wall.slug);
        assert.equal(wall.canPublish, own, wall.slug);
    }
});

test("los muros de comité enlazan con su comité y los de avisos y general no", () => {
    const walls = buildPracticeWalls(CS_ID);
    const cs = walls.find((wall) => wall.slug === "comite-cs");
    assert.equal(cs.committeeId, "practice-committee-cs");
    assert.equal(cs.committeeCode, "CS");
    assert.equal(cs.committeeName, "Consejo de Seguridad");
    for (const wall of walls.filter((item) => item.kind !== "committee")) {
        assert.equal(wall.committeeId, null, wall.slug);
    }
});

test("todos los muros pertenecen al evento de práctica", () => {
    for (const wall of buildPracticeWalls(CS_ID)) {
        assert.equal(wall.eventId, "practice-local", wall.slug);
    }
});
