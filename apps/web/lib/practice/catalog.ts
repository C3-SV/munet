import type { EventWall } from "../../types/common.ts";
import { PRACTICE_EVENT_ID } from "./constants.ts";

// Comités fijos del modo práctica. El orden es el orden de los muros.
export const PRACTICE_COMMITTEES: readonly { id: string; code: string; name: string }[] = [
    { id: "practice-committee-ag", code: "AG", name: "Asamblea General" },
    { id: "practice-committee-cs", code: "CS", name: "Consejo de Seguridad" },
    { id: "practice-committee-unicef", code: "UNICEF", name: "UNICEF" },
    { id: "practice-committee-ecosoc", code: "ECOSOC", name: "ECOSOC" },
];

// Muros de la práctica: Avisos, General y uno por comité. Solo el comité indicado
// (el de la persona) es accesible y publicable; los demás comités quedan cerrados.
export const buildPracticeWalls = (committeeId: string): EventWall[] => {
    const announcements: EventWall = {
        id: "practice-wall-avisos",
        eventId: PRACTICE_EVENT_ID,
        name: "Avisos",
        wallType: "ANNOUNCEMENTS",
        kind: "announcements",
        slug: "avisos",
        committeeId: null,
        committeeName: null,
        committeeCode: null,
        canAccess: true,
        canPublish: false,
    };

    const general: EventWall = {
        id: "practice-wall-general",
        eventId: PRACTICE_EVENT_ID,
        name: "General",
        wallType: "GENERAL",
        kind: "general",
        slug: "general",
        committeeId: null,
        committeeName: null,
        committeeCode: null,
        canAccess: true,
        canPublish: true,
    };

    const committeeWalls = PRACTICE_COMMITTEES.map((committee): EventWall => {
        const slug = `comite-${committee.code.toLowerCase()}`;
        const own = committee.id === committeeId;
        return {
            id: `practice-wall-${slug}`,
            eventId: PRACTICE_EVENT_ID,
            name: committee.name,
            wallType: "COMMITTEE",
            kind: "committee",
            slug,
            committeeId: committee.id,
            committeeName: committee.name,
            committeeCode: committee.code,
            canAccess: own,
            canPublish: own,
        };
    });

    return [announcements, general, ...committeeWalls];
};
