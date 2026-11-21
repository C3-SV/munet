import type { MembershipSummary } from "../../types/auth.ts";
import { PRACTICE_EVENT_ID, PRACTICE_MEMBERSHIP_ID, isPracticeEvent } from "./constants.ts";

// Membresía del modo práctica. Vive solo en memoria del cliente: no es un dato de Supabase.
export const buildPracticeMembership = (): MembershipSummary => ({
    id: PRACTICE_MEMBERSHIP_ID,
    eventId: PRACTICE_EVENT_ID,
    eventName: "Práctica",
    eventSlug: "practica",
    eventStatus: "ACTIVE",
    role: "PARTICIPANT",
    committeeId: null,
    committeeName: null,
    committeeCode: null,
    participantCode: "PRACTICA",
    accountStatus: "ACTIVE",
});

// Verdadero si el id o el evento son los reservados de la práctica.
export const isPracticeMembership = (membership: Pick<MembershipSummary, "id" | "eventId">): boolean =>
    membership.id === PRACTICE_MEMBERSHIP_ID || isPracticeEvent(membership.eventId);

// Quita la membresía de práctica y conserva el orden del resto.
export const withoutPracticeMembership = (memberships: MembershipSummary[]): MembershipSummary[] =>
    memberships.filter((membership) => !isPracticeMembership(membership));

// Agrega la membresía de práctica al final, sin duplicarla.
export const withPracticeMembership = (memberships: MembershipSummary[]): MembershipSummary[] => [
    ...withoutPracticeMembership(memberships),
    buildPracticeMembership(),
];

// La práctica nunca se escribe como membresía activa en localStorage.
export const shouldPersistActive = (membership: Pick<MembershipSummary, "id" | "eventId">): boolean =>
    !isPracticeMembership(membership);
