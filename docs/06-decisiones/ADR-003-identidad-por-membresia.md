# ADR-003 — Identidad operativa por membresía y evento

- **Estado:** aceptada; implementación parcial
- **Revisión:** 2026-10-23

## Contexto

Una persona puede participar en múltiples eventos con roles, comités, códigos y estados diferentes. Usar solo el usuario global mezclaría permisos y contenido.

## Decisión

`event_memberships` representa la identidad operativa. Las operaciones deben resolver una membresía activa dentro del evento del recurso. El cliente conserva una membresía/evento seleccionado para navegación.

## Consecuencias

- Perfiles, posts, votos, comentarios y mensajes se atribuyen a membresía.
- El mismo usuario puede cambiar de evento sin otra cuenta global.
- Toda autorización debe comprobar evento y estado, no solo JWT o rol textual.
- La autorización administrativa global actual es una excepción provisional y potencialmente contradictoria.

## Evidencia

Especificaciones históricas RN-01/RN-02 migradas, `auth-context.service.ts`, `auth.store.ts` y controladores de dominio.
