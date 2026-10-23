# Proteger endpoints administrativos (middleware de roles/autorización) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el hueco de autorización en `apps/api/src/routes/admin.routes.ts`, donde hoy cualquier usuario autenticado (no solo admins) puede crear eventos, comités, memberships y cuentas.

**Architecture:** Un middleware nuevo `requireAdmin` se añade a `auth.middleware.ts`, junto a `requireAuth`/`requireEventMembership`/`requireRole` ya existentes. Reutiliza `isAdminRole` de `rbac.utils.ts`. Regla: admin global = al menos una membership `ACTIVE` con rol admin, en cualquier evento (mismo criterio que ya usa `requireEventMembership` para su bypass). Se inserta como segundo middleware (después de `requireAuth`) en las 4 rutas de `admin.routes.ts`.

**Tech Stack:** Node.js, Express 5, TypeScript. Sin framework de tests en `apps/api` — verificación manual con `curl` contra el dev server.

## Global Constraints

- Todo endpoint administrativo debe estar protegido por middleware de roles/autorización antes de exponer su lógica (regla no negociable del proyecto).
- No modificar ningún archivo fuera de `apps/api/src/middleware/auth.middleware.ts` y `apps/api/src/routes/admin.routes.ts`.
- No agregar logging de auditoría para los 403 (fuera de alcance, ver spec).
- No tocar `profiles.controller.ts`, `posts`, `comments`, `events` — ya están protegidos con checks propios.

---

### Task 1: Middleware `requireAdmin`

**Files:**
- Modify: `apps/api/src/middleware/auth.middleware.ts`

**Interfaces:**
- Consumes: `req.auth.memberships: AuthMembership[]` (poblado por `requireAuth`, tipo ya definido en `apps/api/src/types/auth-context.ts`), `isAdminRole(role: string | null | undefined): boolean` de `apps/api/src/utils/rbac.utils.ts`.
- Produces: `export const requireAdmin: (req: Request, res: Response, next: NextFunction) => Response | void` — middleware Express estándar, mismo shape que `requireRole` en el mismo archivo.

- [ ] **Step 1: Añadir `requireAdmin` al final de `auth.middleware.ts`**

Editar `apps/api/src/middleware/auth.middleware.ts`. El archivo ya importa `isAdminRole` en la línea 7 (se usa en `requireEventMembership`), así que no hace falta agregar el import. Añadir al final del archivo, después de `requireRole`:

```ts
// Middleware de autorización global: exige al menos una membership activa con rol admin.
// A diferencia de requireRole, no depende de req.auth.currentMembership ni de event_id,
// por eso sirve para rutas admin sin evento en contexto (ej. crear evento nuevo).
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores (0 output, exit code 0).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/auth.middleware.ts
git commit -m "feat: add requireAdmin middleware for global admin authorization"
```

---

### Task 2: Proteger rutas de `admin.routes.ts`

**Files:**
- Modify: `apps/api/src/routes/admin.routes.ts`

**Interfaces:**
- Consumes: `requireAdmin` de Task 1 (`apps/api/src/middleware/auth.middleware.ts`).
- Produces: nada consumido por otras tasks — es la task final del plan.

- [ ] **Step 1: Importar y aplicar `requireAdmin` en las 4 rutas**

Reemplazar el contenido completo de `apps/api/src/routes/admin.routes.ts`:

```ts
import { Router } from 'express';
import { createAccount, createCommittee, createEvent, createMembership } from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) + requireAdmin (al menos una
// membership activa con rol admin en cualquier evento).
router.post(
  '/events',
  requireAuth,
  requireAdmin,
  createEvent
);

router.post(
  '/committees',
  requireAuth,
  requireAdmin,
  createCommittee
);

router.post(
  '/memberships',
  requireAuth,
  requireAdmin,
  createMembership
);

router.post(
  '/create-account',
  requireAuth,
  requireAdmin,
  createAccount
);

export default router;
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Verificación manual con el dev server**

Run: `cd apps/api && npm run dev` (dejar corriendo en background).

Con un token de un usuario **sin** membership admin activa (ej. participante normal ya activado):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:<PORT>/admin/events \
  -H "Authorization: Bearer <TOKEN_PARTICIPANTE>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test-slug"}'
```
Expected: `403`

Con un token de un usuario **con** membership admin activa:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:<PORT>/admin/events \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Event","slug":"test-event-<timestamp-unico>"}'
```
Expected: `200`

Sin token:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:<PORT>/admin/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test-slug"}'
```
Expected: `401` (comportamiento existente de `requireAuth`, sin cambios)

Repetir el caso 403 (participante normal) para `/admin/committees`, `/admin/memberships`,
`/admin/create-account` — cada uno debe devolver `403`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/admin.routes.ts
git commit -m "feat: enforce requireAdmin on admin routes"
```
