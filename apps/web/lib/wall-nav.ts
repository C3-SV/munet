import type { EventWall } from "../types/common";

export type WallNav = {
    announcements: EventWall | null;
    general: EventWall | null;
    // Comité propio cuando solo hay uno accesible; en otro caso null.
    mine: EventWall | null;
    // Comités accesibles que van dentro del grupo colapsable (vacío si hay uno solo).
    committees: EventWall[];
    // Hay más de un muro de comité accesible.
    showCommitteeGroup: boolean;
    activeSlug: string | null;
};

// Agrupa los muros accesibles del evento para el menú lateral y el selector del muro.
export const buildWallNav = (walls: EventWall[], activeSlug: string | null): WallNav => {
    const accessible = walls.filter((wall) => wall.canAccess);

    const announcements = accessible.find((wall) => wall.kind === "announcements") ?? null;

    // Misma regla que tenía Sidebar: kind general, o el primer muro sin comité que no sea avisos.
    const general =
        accessible.find((wall) => wall.kind === "general") ??
        accessible.find((wall) => !wall.committeeId && wall.kind !== "announcements") ??
        null;

    const committeeWalls = accessible.filter((wall) => wall.kind === "committee");
    const showCommitteeGroup = committeeWalls.length > 1;
    const mine = committeeWalls.length === 1 ? (committeeWalls[0] ?? null) : null;
    const committees = showCommitteeGroup ? committeeWalls : [];

    return {
        announcements,
        general,
        mine,
        committees,
        showCommitteeGroup,
        activeSlug,
    };
};
