import type { MembershipSummary } from "../types/auth.ts";
import { withoutPracticeMembership } from "./practice/membership.ts";

// Último evento real usado en este navegador. Solo sirve para ordenar: un id que no pertenece a
// las membresías actuales se ignora. Se conserva al cerrar sesión (es una preferencia del dispositivo).
export const LAST_MEMBERSHIP_KEY = "munet_last_membership";

// Membresías que se pueden elegir: reales (sin práctica) y activas.
export const selectableMemberships = (memberships: MembershipSummary[]): MembershipSummary[] =>
    withoutPracticeMembership(memberships).filter(
        (membership) => (membership.accountStatus ?? "").trim().toUpperCase() === "ACTIVE",
    );

// Orden determinista: primero el último usado (si sigue vigente), luego por nombre del evento y,
// en empate, por id. El contrato no trae fecha de membresía ni de evento, así que el criterio
// "más reciente" no se puede aplicar hasta que la API la exponga. No muta la lista recibida.
export const orderMembershipsForSelection = (
    memberships: MembershipSummary[],
    lastUsedMembershipId: string | null | undefined,
): MembershipSummary[] =>
    selectableMemberships(memberships).sort((a, b) => {
        const lastA = a.id === lastUsedMembershipId ? 0 : 1;
        const lastB = b.id === lastUsedMembershipId ? 0 : 1;

        if (lastA !== lastB) {
            return lastA - lastB;
        }

        const byName = a.eventName.localeCompare(b.eventName, "es");

        if (byName !== 0) {
            return byName;
        }

        return a.id.localeCompare(b.id);
    });

// Membresía que se usa por defecto: la primera del orden determinista, o null si no hay ninguna.
export const pickDefaultMembership = (
    memberships: MembershipSummary[],
    lastUsedMembershipId: string | null | undefined,
): MembershipSummary | null => orderMembershipsForSelection(memberships, lastUsedMembershipId)[0] ?? null;

// Lee el último id usado. Sin almacenamiento disponible (ventana privada, datos bloqueados) devuelve null.
export const readLastUsedMembershipId = (): string | null => {
    try {
        return localStorage.getItem(LAST_MEMBERSHIP_KEY);
    } catch {
        return null;
    }
};

// Guarda el último id usado. Si no se puede guardar, solo se pierde el orden preferido.
export const writeLastUsedMembershipId = (membershipId: string): void => {
    try {
        localStorage.setItem(LAST_MEMBERSHIP_KEY, membershipId);
    } catch {
        // Sin almacenamiento la sesión sigue igual; el orden vuelve al criterio por defecto.
    }
};
