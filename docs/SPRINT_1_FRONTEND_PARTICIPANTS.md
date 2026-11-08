# Plan frontend — Sprint 1, Participantes (S1-14)

Preparado para Alex. El backend de Sprint 1 (S1-10, S1-11, S1-12, S1-13) ya
está implementado, verificado (`tsc` + 18 pruebas) y documentado en
[`docs/SPRINT_1_BACKEND_FE.md`](SPRINT_1_BACKEND_FE.md) — ese es el contrato
real, no una suposición. Nada de esto está comiteado todavía, pero el
contrato de API no debería cambiar antes de que avances.

## Punto de partida

- `apps/web/app/(admin)/admin/participants/page.tsx` es un stub con
  `AdminEmptyState`; no hay páginas de detalle, edición ni alta.
- No existe `apps/web/lib/api/participants.ts`. El único cliente admin hoy es
  `apps/web/lib/api/admin.ts` (eventos y comités) — síguelo como plantilla de
  estilo (tipos exportados, funciones `async (token, ...) => requestApi(...)`).
- `apps/web/app/(admin)/admin/events/page.tsx` y
  `apps/web/app/(admin)/admin/events/[eventId]/committees/page.tsx` son las
  referencias de patrón de pantalla (tabla con paginación, estados de carga/
  error/vacío, formularios con `AdminFormInput`/`AdminFormTextarea`/
  `AdminButton`/`AdminAlertBanner`).

## Decisión estructural (recomendada, confírmala con Christian si quieres cambiarla)

Los comités ya están anidados por evento: `/admin/events/[eventId]/committees`.
Los participantes también pertenecen a un evento, así que recomiendo anidarlos
igual, no usar la ruta global `/admin/participants` del stub actual:

```
/admin/events/[eventId]/participants
/admin/events/[eventId]/participants/new
/admin/events/[eventId]/participants/[membershipId]
```

Razón técnica, no solo de estilo: con la autorización ahora acotada por
evento (S1-13 / ADR-005), el backend necesita `event_id` en cada petición de
todas formas — tenerlo en la URL es más natural que un selector aparte.

## Contrato real de la API (confirmado, ya probado)

Todo bajo `/admin`, requiere `Authorization: Bearer <token>` como ya hace
`admin.ts`. No necesitas enviar ningún header de evento nuevo: `event_id`
va en query/body/params según el endpoint, igual que hoy con comités.

| Método y ruta | Body / Query | Respuesta |
| --- | --- | --- |
| `GET /admin/participants?event_id=<id>&committee_id=&role=&status=&page=&limit=` | — | `{ participants, pagination: { page, limit, total, total_pages } }` |
| `GET /admin/participants/:membershipId` | — | `{ participant }` |
| `PATCH /admin/participants/:membershipId` | `role?, committee_id?, delegation_name?, institution_name?, first_name?, last_name?, display_name?, bio?` | `{ message }` |
| `POST /admin/participants/:membershipId/suspend` | `{ reason }` (**requerido**) | `{ message, membership }` |
| `POST /admin/participants/:membershipId/reactivate` | `{ reason }` (**requerido**) | `{ message, membership }` |
| `POST /admin/participants/:membershipId/reset-password` | — | `{ message, temporary_password }` |
| `POST /admin/create-account` | `event_id, participant_code, role, committee_id?, delegation_name?, institution_name?, first_name, last_name, display_name?, bio?` (**sin** `initial_password`: el servidor la genera) | `{ message, user, membership, profile, initial_password }` |

Forma de `participant` (list y detalle):

```ts
{
  id: string;                 // membershipId
  event_id: string;
  user_id: string;
  participant_code: string;   // inmutable, no lo muestres como editable
  role: string;
  committee_id: string | null;
  delegation_name: string | null;
  institution_name: string | null;
  account_status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED";
  created_at: string;
  profile: { first_name: string; last_name: string; display_name: string | null; bio?: string; profile_image_path?: string } | null;
}
```

Reglas de negocio que la API ya aplica (no las dupliques mal en el cliente,
pero sí refleja los mismos mensajes/estados en la UI):

- `participant_code` y `event_id` son inmutables — ni los muestres como
  campos editables en el formulario de edición.
- Suspender/reactivar devuelven 400 si falta `reason`, si la cuenta ya está
  en el estado destino (suspender una ya suspendida, reactivar una que no lo
  está). El modal de confirmación debe pedir el motivo como campo de texto
  obligatorio, no como botón simple de confirmar.
- `reset-password` devuelve 400 si la cuenta está `SUSPENDED` (hay que
  reactivarla primero). El `temporary_password` viene en texto plano **una
  sola vez**: muéstralo en un banner con botón "copiar" tras la acción y no
  lo guardes en estado más allá de esa pantalla (igual que con
  `initial_password` al crear cuenta).
- Solo existen los estados `PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED` — no
  hay `BLOQUEADA_SEGURIDAD` ni `EXPULSADA` todavía (quedó fuera de alcance
  de este sprint a propósito). No diseñes la UI asumiendo más estados de los
  que el backend realmente soporta.

## Alcance de S1-14

1. **Cliente API** — `apps/web/lib/api/participants.ts`, mismo estilo que
   `admin.ts`: `listParticipants`, `getParticipant`, `updateParticipant`,
   `suspendParticipant`, `reactivateParticipant`, `resetParticipantPassword`,
   y `createAccount` (agrégalo aquí; hoy no está expuesto en `lib/api`
   aunque el backend ya lo soporta).

2. **Listado** — reemplaza el stub de `participants/page.tsx` (muévelo a
   `events/[eventId]/participants/page.tsx` si sigues la recomendación de
   arriba) por una tabla igual en espíritu a `events/page.tsx`: columnas
   código, nombre (`profile.display_name` o `first_name last_name`), comité,
   rol, estado (`AdminStatusBadge`), acciones. Filtros por comité/rol/estado;
   misma paginación que eventos.

3. **Alta individual** — formulario tipo `events/new/page.tsx`: campos
   `participant_code`, `role`, `committee_id` (select poblado con
   `listCommittees` del mismo evento), `delegation_name`/`institution_name`,
   `first_name`, `last_name`, `display_name?`, `bio?`. Sin campo de
   contraseña. Tras crear, muestra `initial_password` una sola vez (banner +
   copiar), igual que se describe arriba para `reset-password`.

4. **Detalle/edición** — editar rol, comité, delegación/institución, datos
   de perfil vía `PATCH`. Acciones de ciclo de vida (restablecer contraseña,
   suspender, reactivar) con diálogo de confirmación que pida el motivo como
   texto obligatorio antes de enviar la petición. Revisa si ya existe un
   componente de diálogo de confirmación reutilizable en `components/admin`;
   si no, es una pieza nueva a construir.

5. **Importación CSV** — no es parte de S1-14; sigue fuera de alcance según
   `docs/07-auditoria/pendientes.md`.

## Verificación

Sigue `docs/04-desarrollo/pruebas-y-validacion.md`. Levanta `apps/web` y
`apps/api` localmente y prueba el flujo completo (listar, crear, editar,
suspender, reactivar, restablecer contraseña) contra la API real antes de
dar una pantalla por terminada — los estados de carga/error/vacío de la
tabla de eventos son el estándar a igualar. Si algo del contrato no coincide
con lo descrito aquí, es un bug o un cambio sin documentar: avisa antes de
adaptarte en silencio.
