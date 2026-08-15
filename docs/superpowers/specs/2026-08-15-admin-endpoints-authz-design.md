# Proteger endpoints administrativos (middleware de roles/autorización)

Sprint 0 — base backend.

## Problema

Las rutas de `apps/api/src/routes/admin.routes.ts` (`POST /events`, `POST /committees`,
`POST /memberships`, `POST /create-account`) solo pasan por `requireAuth`. No hay ningún
chequeo de rol antes de ejecutar los controllers. Cualquier usuario autenticado —incluyendo
un participante normal— puede hoy crear eventos, comités, memberships y cuentas operativas.

El comentario existente en `admin.routes.ts` ("autorización fina se valida en
controllers/servicios") es falso: ninguno de los 4 controllers en `admin.controller.ts`
valida el rol del actor.

Revisión del resto del repo confirma que **este es el único hueco real**:
- `profiles.controller.ts` ya valida admin por evento con su propio helper
  `requireAdminMembership` (usa `x-event-id` + `isAdminRole`).
- `posts.service.ts` y `comments.service.ts` ya usan `isAdminRole` para permitir borrar
  contenido ajeno.
- `events.controller.ts` ya usa `isAdminRole` para el bypass de acceso a comités.
- `GET /auth/events-by-code/:participant_code` es público por diseño (se usa antes de
  tener token, en el flujo de pre-activación) — no aplica aquí.

## Alcance

Solo las 4 rutas de `admin.routes.ts`. No se toca ningún otro endpoint.

## Diseño

### Middleware `requireAdmin`

Nuevo middleware en `apps/api/src/middleware/auth.middleware.ts` (junto a `requireAuth`,
`requireEventMembership`, `requireRole`), reutilizando `isAdminRole` de
`utils/rbac.utils.ts`.

Regla de autorización: el usuario es **admin global** si tiene al menos una membership con
`accountStatus === 'ACTIVE'` cuyo rol cumple `isAdminRole` (ADMIN/COORDINADOR/ORGANIZADOR),
en cualquier evento. Es el mismo criterio que ya usa `requireEventMembership` para el bypass
de admin transversal — no se inventa una regla nueva, se reutiliza la existente.

Este criterio evita depender de `event_id`/`x-event-id`, lo cual es necesario porque
`createEvent` no tiene evento aún cuando se llama.

```ts
// Middleware de autorización global: exige al menos una membership activa con rol admin.
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const memberships = req.auth?.memberships ?? [];

  const hasAdminMembership = memberships.some(
    (m) => isAdminRole(m.role) && m.accountStatus === 'ACTIVE'
  );

  if (!hasAdminMembership) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  return next();
};
```

Debe ir después de `requireAuth` en la cadena de middlewares, ya que depende de
`req.auth.memberships` (poblado por `requireAuth`).

### Rutas actualizadas

`admin.routes.ts` pasa a:

```ts
router.post('/events', requireAuth, requireAdmin, createEvent);
router.post('/committees', requireAuth, requireAdmin, createCommittee);
router.post('/memberships', requireAuth, requireAdmin, createMembership);
router.post('/create-account', requireAuth, requireAdmin, createAccount);
```

Se corrige el comentario del archivo para reflejar la protección real.

### Fuera de alcance

- No se loguea en la tabla de auditoría cuando `requireAdmin` rechaza con 403 (se deja para
  el sprint de cierre, junto con rate limiting).
- No se toca `profiles.controller.ts`, `posts`, `comments`, `events` — ya están protegidos.
- No se construye interfaz de admin en frontend (ese es un item de Notion aparte).
- No se crea tabla de roles globales nueva; se reutiliza el rol por membership existente.

## Verificación

No hay framework de tests en `apps/api` (`package.json` solo tiene script `dev`, sin
`test`). La verificación es manual:

1. Levantar el server (`npm run dev` en `apps/api`).
2. Con un token de participante normal (rol no-admin) → `POST /admin/events` debe devolver
   `403 { error: 'No autorizado' }`.
3. Con un token de usuario con membership admin activa → `POST /admin/events` debe
   funcionar igual que antes (200, evento creado, log de auditoría `CREATE_EVENT`).
4. Repetir el caso 403 para `/committees`, `/memberships`, `/create-account`.
5. Sin token → sigue devolviendo 401 (comportamiento de `requireAuth`, sin cambios).
