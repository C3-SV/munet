# Sprint 1 (Backend): CRUD de eventos y comités + muro automático Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar CRUD de administración para eventos (listar, ver, editar) y comités (listar, ver, editar, eliminar), y hacer que crear un comité cree automáticamente su muro asociado.

**Architecture:** Todo el trabajo vive en 3 archivos existentes de `apps/api`: se agregan tipos de auditoría nuevos en `audit.logger.ts`, funciones de controller nuevas en `admin.controller.ts` (mismo archivo/patrón que ya usan `createEvent`/`createCommittee`), y rutas nuevas en `admin.routes.ts`, todas protegidas con `requireAuth, requireAdmin` (middleware ya existente de Sprint 0). Sin tablas ni columnas nuevas.

**Tech Stack:** Node.js, Express 5, TypeScript, Supabase (`@supabase/supabase-js`). Sin framework de tests en `apps/api` — verificación por `tsc --noEmit` + revisión de código + curl manual (requiere `.env` con credenciales reales, que corre el usuario).

## Global Constraints

- Todo endpoint administrativo debe estar protegido por `requireAuth, requireAdmin` (regla del proyecto, ya establecida en Sprint 0).
- Solo se actualizan campos presentes explícitamente en el body de un PATCH (patrón `hasOwn`, igual que `updatePublicProfileAsAdmin` en `profiles.controller.ts`).
- Lectura siempre con `deleted_at IS NULL` (regla de soft delete del proyecto, sección 5.5 de `docs/MUNET_DOCUMENTACION_TECNICA.md`).
- Acciones importantes quedan en `audit_logs` con el actor correcto (regla no negociable del proyecto).
- No se crean columnas ni tablas nuevas — todo usa columnas ya usadas en el código existente (`events`, `committees`, `walls`).
- Sin DELETE de eventos (solo cambio de `status`). Comités sí llevan soft delete, y al borrarlos se soft-elimina también su muro.
- Estados de evento: `ACTIVE | CLOSED | ARCHIVED`, cualquier transición es válida.

---

### Task 1: Nuevos tipos de auditoría

**Files:**
- Modify: `apps/api/src/utils/audit.logger.ts:4-22`

**Interfaces:**
- Consumes: nada (es la base del resto de tasks).
- Produces: `AuditActionType` incluye `'UPDATE_EVENT' | 'UPDATE_COMMITTEE' | 'DELETE_COMMITTEE'`, usados por `logAudit()` en las Tasks 3, 6 y 7.

- [ ] **Step 1: Agregar los 3 valores nuevos al union type**

En `apps/api/src/utils/audit.logger.ts`, reemplazar:

```ts
export type AuditActionType =
  | 'CREATE_POST'
  | 'DELETE_POST'
  | 'POLL_CREATED'
  | 'POLL_CLOSED'
  | 'POLL_VOTE'
  | 'CREATE_COMMENT'
  | 'DELETE_COMMENT'
  | 'CREATE_CONVERSATION'
  | 'SEND_DM_MESSAGE'
  | 'DELETE_DM_MESSAGE'
  | 'UPDATE_PROFILE'
  | 'UPLOAD_AVATAR'
  | 'ADMIN_UPDATE_PROFILE'
  | 'ADMIN_UPLOAD_AVATAR'
  | 'CREATE_EVENT'
  | 'CREATE_COMMITTEE'
  | 'CREATE_MEMBERSHIP'
  | 'CREATE_ACCOUNT';
```

por:

```ts
export type AuditActionType =
  | 'CREATE_POST'
  | 'DELETE_POST'
  | 'POLL_CREATED'
  | 'POLL_CLOSED'
  | 'POLL_VOTE'
  | 'CREATE_COMMENT'
  | 'DELETE_COMMENT'
  | 'CREATE_CONVERSATION'
  | 'SEND_DM_MESSAGE'
  | 'DELETE_DM_MESSAGE'
  | 'UPDATE_PROFILE'
  | 'UPLOAD_AVATAR'
  | 'ADMIN_UPDATE_PROFILE'
  | 'ADMIN_UPLOAD_AVATAR'
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'CREATE_COMMITTEE'
  | 'UPDATE_COMMITTEE'
  | 'DELETE_COMMITTEE'
  | 'CREATE_MEMBERSHIP'
  | 'CREATE_ACCOUNT';
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: el único error es el preexistente `tsconfig.json(5,25): error TS5107: Option 'moduleResolution=node10' is deprecated...` (ya confirmado en Sprint 0, no relacionado a este cambio). Ningún error nuevo mencionando `audit.logger.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/utils/audit.logger.ts
git commit -m "feat: add UPDATE_EVENT/UPDATE_COMMITTEE/DELETE_COMMITTEE audit action types"
```

**Nota para el usuario (no es parte de este task, es un aviso):** si `audit_logs.action_type` es un ENUM de Postgres en la base real, hace falta correr esto en Supabase para que los audit logs de estas 3 acciones se guarden (ver `docs/superpowers/specs/2026-08-21-sprint1-events-committees-crud-design.md`):

```sql
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'UPDATE_EVENT';
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'UPDATE_COMMITTEE';
ALTER TYPE <nombre_del_enum> ADD VALUE IF NOT EXISTS 'DELETE_COMMITTEE';
```

---

### Task 2: Listar y ver eventos (admin)

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (insertar después de `createEvent`, que termina en la línea 249 con `};`)

**Interfaces:**
- Consumes: `supabaseAdmin` (ya importado en el archivo), `Request`/`Response` de express (ya importados).
- Produces: `export const listEvents: (req: Request, res: Response) => Promise<Response>` y `export const getEvent: (req: Request, res: Response) => Promise<Response>`, usados por Task 8 en las rutas `GET /admin/events` y `GET /admin/events/:eventId`.

- [ ] **Step 1: Insertar `listEvents` y `getEvent`**

En `apps/api/src/controllers/admin.controller.ts`, ubicar el final de la función `createEvent` (línea 249):

```ts
    return res.json({
      message: 'Evento creado correctamente',
      event
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateMembershipBody = {
```

Reemplazar por (agrega las 2 funciones nuevas entre el cierre de `createEvent` y `type CreateMembershipBody`):

```ts
    return res.json({
      message: 'Evento creado correctamente',
      event
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Lista todos los eventos no eliminados para vista de administrador.
export const listEvents = async (_req: Request, res: Response) => {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select(
        'id, name, slug, description, start_date, end_date, status, is_read_only, created_at'
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ events: events ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve el detalle de un evento por id para vista de administrador.
export const getEvent = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select(
        'id, name, slug, description, start_date, end_date, status, is_read_only, created_at'
      )
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    return res.json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateMembershipBody = {
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`, nada nuevo sobre `admin.controller.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: add listEvents and getEvent admin controllers"
```

---

### Task 3: Editar evento (PATCH)

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (agregar helper `hasOwn` + constante `EVENT_STATUSES` cerca del inicio del archivo, y la función `updateEvent` junto a `getEvent` de Task 2)

**Interfaces:**
- Consumes: `getEvent`/`listEvents` de Task 2 solo por ubicación en el archivo (sin dependencia funcional). `logAudit` (ya importado), con el nuevo `actionType: 'UPDATE_EVENT'` de Task 1.
- Produces: `export const updateEvent: (req: Request<{ eventId: string }, {}, UpdateEventBody>, res: Response) => Promise<Response>`, y el helper `hasOwn(payload: Record<string, unknown>, key: string): boolean` que reutiliza Task 6.

- [ ] **Step 1: Agregar el helper `hasOwn` después de los imports**

En `apps/api/src/controllers/admin.controller.ts`, ubicar el inicio del archivo:

```ts
import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import bcrypt from 'bcrypt';

type CreateAccountBody = {
```

Reemplazar por:

```ts
import { Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../utils/audit.logger';
import bcrypt from 'bcrypt';

// Helper para detectar si una propiedad viene explicitamente en el payload.
const hasOwn = (payload: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(payload, key);

type CreateAccountBody = {
```

- [ ] **Step 2: Agregar `updateEvent` después de `getEvent` (de Task 2)**

Ubicar el final de `getEvent` (agregado en Task 2):

```ts
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    return res.json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateMembershipBody = {
```

Reemplazar por:

```ts
    if (!event) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    return res.json({ event });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type UpdateEventBody = {
  name?: string;
  slug?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
};

const EVENT_STATUSES = ['ACTIVE', 'CLOSED', 'ARCHIVED'] as const;

// Actualiza campos parciales de un evento existente. Cualquier transicion
// de status es valida (sin maquina de estados).
export const updateEvent = async (
  req: Request<{ eventId: string }, {}, UpdateEventBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { eventId } = req.params;
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const { data: existing } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', eventId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    if (hasOwn(payload, 'slug')) {
      const { data: slugConflict } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('slug', payload.slug as string)
        .neq('id', eventId)
        .is('deleted_at', null)
        .maybeSingle();

      if (slugConflict) {
        return res.status(400).json({ error: 'El slug ya existe' });
      }
    }

    if (
      hasOwn(payload, 'status') &&
      !EVENT_STATUSES.includes(payload.status as (typeof EVENT_STATUSES)[number])
    ) {
      return res.status(400).json({
        error: `status debe ser uno de: ${EVENT_STATUSES.join(', ')}`
      });
    }

    const update: Record<string, unknown> = {
      updated_by_user_id: actorUserId,
    };

    (['name', 'slug', 'description', 'start_date', 'end_date', 'status'] as const).forEach(
      (field) => {
        if (hasOwn(payload, field)) {
          update[field] = payload[field];
        }
      }
    );

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .update(update)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const changedFields = Object.keys(update).filter((key) => key !== 'updated_by_user_id');

    await logAudit({
      eventId,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'UPDATE_EVENT',
      entityType: 'EVENT',
      entityId: eventId,
      outcome: 'SUCCESS',
      reason: `Evento actualizado: ${changedFields.join(', ') || 'sin cambios'}`,
    });

    return res.json({
      message: 'Evento actualizado correctamente',
      event
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

type CreateMembershipBody = {
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: add updateEvent admin controller with status transitions"
```

---

### Task 4: Muro automático al crear comité

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (dentro de la función `createCommittee` existente, líneas ~446-485 antes de las tasks previas — la ubicación exacta se localiza por el texto ancla, no por número de línea, ya que Tasks 2-3 insertaron código antes de este punto)

**Interfaces:**
- Consumes: nada nuevo (usa `supabaseAdmin` y `logAudit` ya importados, y `actionType: 'CREATE_COMMITTEE'` que ya existe).
- Produces: la respuesta de `POST /admin/committees` ahora incluye `wall` además de `committee`. Task 6 (update) y Task 7 (delete) dependen de que todo comité tenga una fila en `walls` con `committee_id` igual al `id` del comité — invariante que esta task establece.

- [ ] **Step 1: Insertar la creación del wall dentro de `createCommittee`**

En `apps/api/src/controllers/admin.controller.ts`, ubicar dentro de la función `createCommittee` el bloque:

```ts
    // 4. crear comité
    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .insert({
        event_id,
        name,
        code,
        description,
        sort_order: sort_order ?? 0,
        status: 'ACTIVE',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committee.id,
      outcome: 'SUCCESS',
      reason: `Comite creado: ${name} (${code})`,
    });

    return res.json({
      message: 'Comité creado correctamente',
      committee
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve eventos/memberships pendientes de activación para un participant_code.
```

Reemplazar por:

```ts
    // 4. crear comité
    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .insert({
        event_id,
        name,
        code,
        description,
        sort_order: sort_order ?? 0,
        status: 'ACTIVE',
        created_by_user_id: actorUserId,
        updated_by_user_id: actorUserId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // 5. crear muro asociado automaticamente; si falla, revertir el comite
    // para no dejarlo huerfano sin muro donde publicar.
    const { data: wall, error: wallError } = await supabaseAdmin
      .from('walls')
      .insert({
        event_id,
        name,
        wall_type: 'COMMITTEE',
        committee_id: committee.id,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (wallError) {
      await supabaseAdmin
        .from('committees')
        .update({
          deleted_at: new Date().toISOString(),
          updated_by_user_id: actorUserId,
        })
        .eq('id', committee.id);

      return res.status(400).json({
        error: `No se pudo crear el muro del comite: ${wallError.message}`
      });
    }

    await logAudit({
      eventId: event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'CREATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committee.id,
      outcome: 'SUCCESS',
      reason: `Comite creado: ${name} (${code}), muro ${wall.id} creado automaticamente`,
    });

    return res.json({
      message: 'Comité creado correctamente',
      committee,
      wall
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve eventos/memberships pendientes de activación para un participant_code.
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: auto-create wall when a committee is created"
```

---

### Task 5: Listar y ver comités (admin)

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (insertar al final del archivo, después de `getEventsByParticipantCode`)

**Interfaces:**
- Consumes: `supabaseAdmin` (ya importado).
- Produces: `export const listCommittees: (req: Request, res: Response) => Promise<Response>` y `export const getCommittee: (req: Request, res: Response) => Promise<Response>`, usados por Task 8 en `GET /admin/committees` y `GET /admin/committees/:committeeId`.

- [ ] **Step 1: Insertar `listCommittees` y `getCommittee` al final del archivo**

En `apps/api/src/controllers/admin.controller.ts`, ubicar el cierre de `getEventsByParticipantCode` (última función del archivo, termina con `};` seguido del fin de archivo). Agregar después de ese cierre:

```ts

// Lista comites de un evento para vista de administrador (sin requerir
// membership del actor en ese evento, a diferencia del endpoint de participantes).
export const listCommittees = async (req: Request, res: Response) => {
  try {
    const eventId = typeof req.query.event_id === 'string' ? req.query.event_id : null;

    if (!eventId) {
      return res.status(400).json({ error: 'event_id es requerido' });
    }

    const { data: committees, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, sort_order, status')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ committees: committees ?? [] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// Devuelve el detalle de un comite por id para vista de administrador.
export const getCommittee = async (req: Request, res: Response) => {
  try {
    const { committeeId } = req.params;

    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .select('id, event_id, name, code, description, sort_order, status')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!committee) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    return res.json({ committee });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: add listCommittees and getCommittee admin controllers"
```

---

### Task 6: Editar comité (PATCH) con sincronización de muro

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (insertar después de `getCommittee`, de Task 5)

**Interfaces:**
- Consumes: helper `hasOwn` de Task 3, `actionType: 'UPDATE_COMMITTEE'` de Task 1, invariante "todo comité tiene wall con `committee_id` propio" de Task 4.
- Produces: `export const updateCommittee: (req: Request<{ committeeId: string }, {}, UpdateCommitteeBody>, res: Response) => Promise<Response>`, usado por Task 8 en `PATCH /admin/committees/:committeeId`.

- [ ] **Step 1: Insertar `updateCommittee` después de `getCommittee`**

En `apps/api/src/controllers/admin.controller.ts`, ubicar el final de `getCommittee` (agregado en Task 5, es el final del archivo). Agregar después:

```ts

type UpdateCommitteeBody = {
  name?: string;
  code?: string;
  description?: string;
  sort_order?: number;
};

// Actualiza campos parciales de un comite y sincroniza el nombre de su muro.
export const updateCommittee = async (
  req: Request<{ committeeId: string }, {}, UpdateCommitteeBody>,
  res: Response
) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { committeeId } = req.params;
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const { data: existing } = await supabaseAdmin
      .from('committees')
      .select('id, event_id')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    if (hasOwn(payload, 'name')) {
      const { data: nameConflict } = await supabaseAdmin
        .from('committees')
        .select('id')
        .eq('event_id', existing.event_id)
        .eq('name', payload.name as string)
        .neq('id', committeeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (nameConflict) {
        return res.status(400).json({
          error: 'Ya existe un comité con ese nombre en este evento'
        });
      }
    }

    if (hasOwn(payload, 'code')) {
      const { data: codeConflict } = await supabaseAdmin
        .from('committees')
        .select('id')
        .eq('event_id', existing.event_id)
        .eq('code', payload.code as string)
        .neq('id', committeeId)
        .is('deleted_at', null)
        .maybeSingle();

      if (codeConflict) {
        return res.status(400).json({
          error: 'Ya existe un comité con ese código en este evento'
        });
      }
    }

    const update: Record<string, unknown> = {
      updated_by_user_id: actorUserId,
    };

    (['name', 'code', 'description', 'sort_order'] as const).forEach((field) => {
      if (hasOwn(payload, field)) {
        update[field] = payload[field];
      }
    });

    const { data: committee, error } = await supabaseAdmin
      .from('committees')
      .update(update)
      .eq('id', committeeId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (hasOwn(payload, 'name')) {
      await supabaseAdmin
        .from('walls')
        .update({ name: payload.name as string })
        .eq('committee_id', committeeId);
    }

    const changedFields = Object.keys(update).filter((key) => key !== 'updated_by_user_id');

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'UPDATE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committeeId,
      outcome: 'SUCCESS',
      reason: `Comite actualizado: ${changedFields.join(', ') || 'sin cambios'}`,
    });

    return res.json({
      message: 'Comité actualizado correctamente',
      committee
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: add updateCommittee admin controller, syncs wall name"
```

---

### Task 7: Eliminar comité (soft delete + muro)

**Files:**
- Modify: `apps/api/src/controllers/admin.controller.ts` (insertar después de `updateCommittee`, de Task 6)

**Interfaces:**
- Consumes: `actionType: 'DELETE_COMMITTEE'` de Task 1, invariante de Task 4.
- Produces: `export const deleteCommittee: (req: Request, res: Response) => Promise<Response>`, usado por Task 8 en `DELETE /admin/committees/:committeeId`.

- [ ] **Step 1: Insertar `deleteCommittee` después de `updateCommittee`**

En `apps/api/src/controllers/admin.controller.ts`, agregar al final del archivo (después del cierre de `updateCommittee` de Task 6):

```ts

// Elimina logicamente un comite y su muro asociado.
export const deleteCommittee = async (req: Request, res: Response) => {
  try {
    const actorUserId = req.auth?.userId ?? null;
    const { committeeId } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('committees')
      .select('id, event_id')
      .eq('id', committeeId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existing) {
      return res.status(404).json({ error: 'Comité no encontrado' });
    }

    const deletedAt = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('committees')
      .update({ deleted_at: deletedAt, updated_by_user_id: actorUserId })
      .eq('id', committeeId);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { error: wallError } = await supabaseAdmin
      .from('walls')
      .update({ deleted_at: deletedAt })
      .eq('committee_id', committeeId);

    if (wallError) {
      // El comite ya quedo eliminado; el muro huerfano se loguea para revision manual.
      console.error(
        `No se pudo eliminar el muro del comite ${committeeId}: ${wallError.message}`
      );
    }

    await logAudit({
      eventId: existing.event_id,
      actorUserId: actorUserId ?? undefined,
      actorRole: undefined,
      actionType: 'DELETE_COMMITTEE',
      entityType: 'COMMITTEE',
      entityId: committeeId,
      outcome: 'SUCCESS',
      reason: 'Comite eliminado (soft delete) junto con su muro asociado',
    });

    return res.json({ message: 'Comité eliminado correctamente' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno' });
  }
};
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/controllers/admin.controller.ts
git commit -m "feat: add deleteCommittee admin controller, soft-deletes wall too"
```

---

### Task 8: Conectar las rutas nuevas y actualizar el catálogo de endpoints

**Files:**
- Modify: `apps/api/src/routes/admin.routes.ts`
- Modify: `docs/MUNET_DOCUMENTACION_TECNICA.md:615-620`

**Interfaces:**
- Consumes: `listEvents`, `getEvent`, `updateEvent` (Tasks 2-3), `listCommittees`, `getCommittee`, `updateCommittee`, `deleteCommittee` (Tasks 5-7), todos exportados desde `../controllers/admin.controller`.
- Produces: nada — es la task final del plan.

- [ ] **Step 1: Reemplazar `admin.routes.ts` completo**

```ts
import { Router } from 'express';
import {
  createAccount,
  createCommittee,
  createEvent,
  createMembership,
  deleteCommittee,
  getCommittee,
  getEvent,
  listCommittees,
  listEvents,
  updateCommittee,
  updateEvent,
} from '../controllers/admin.controller';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rutas de administración para catálogos y altas operativas.
// Protegidas con requireAuth (sesión válida) + requireAdmin (al menos una
// membership activa con rol admin en cualquier evento).

// Eventos
router.get('/events', requireAuth, requireAdmin, listEvents);
router.get('/events/:eventId', requireAuth, requireAdmin, getEvent);
router.post('/events', requireAuth, requireAdmin, createEvent);
router.patch('/events/:eventId', requireAuth, requireAdmin, updateEvent);

// Comités
router.get('/committees', requireAuth, requireAdmin, listCommittees);
router.get('/committees/:committeeId', requireAuth, requireAdmin, getCommittee);
router.post('/committees', requireAuth, requireAdmin, createCommittee);
router.patch('/committees/:committeeId', requireAuth, requireAdmin, updateCommittee);
router.delete('/committees/:committeeId', requireAuth, requireAdmin, deleteCommittee);

// Memberships y cuentas
router.post('/memberships', requireAuth, requireAdmin, createMembership);
router.post('/create-account', requireAuth, requireAdmin, createAccount);

export default router;
```

- [ ] **Step 2: Actualizar el catálogo de endpoints en la documentación técnica**

En `docs/MUNET_DOCUMENTACION_TECNICA.md`, reemplazar:

```
## 7.6 Admin operativo

- `POST /admin/events`
- `POST /admin/committees`
- `POST /admin/memberships`
- `POST /admin/create-account`
```

por:

```
## 7.6 Admin operativo

- `GET /admin/events`
- `GET /admin/events/:eventId`
- `POST /admin/events`
- `PATCH /admin/events/:eventId`
- `GET /admin/committees?event_id=<uuid>`
- `GET /admin/committees/:committeeId`
- `POST /admin/committees` (crea también el muro del comité automáticamente)
- `PATCH /admin/committees/:committeeId`
- `DELETE /admin/committees/:committeeId` (soft delete, incluye su muro)
- `POST /admin/memberships`
- `POST /admin/create-account`
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && ../../node_modules/.bin/tsc --noEmit`
Expected: mismo único error preexistente de `tsconfig.json`. Ningún error sobre imports faltantes en `admin.routes.ts` (confirma que los 7 nombres importados existen y están exportados).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/admin.routes.ts docs/MUNET_DOCUMENTACION_TECNICA.md
git commit -m "feat: wire admin events/committees CRUD routes"
```

- [ ] **Step 5: Verificación manual (requiere `.env` real, la corre el usuario)**

Con el dev server corriendo (`cd apps/api && npm run dev`) y credenciales reales de
Supabase, seguir la sección "Verificación" del spec
(`docs/superpowers/specs/2026-08-21-sprint1-events-committees-crud-design.md`):

1. `GET /admin/events` con token admin → 200 con lista de eventos.
2. `PATCH /admin/events/:id` con `{"status":"CLOSED"}` → 200; luego `POST /admin/committees`
   sobre ese evento debe seguir devolviendo 400 "no se pueden crear comités en un evento
   cerrado o archivado" (regla preexistente, no debe romperse).
3. `POST /admin/committees` con un evento `ACTIVE` → 200, respuesta incluye `committee` y
   `wall`. Confirmar con `GET /events/:eventId/committees` (ruta de participantes) que el
   comité aparece.
4. `PATCH /admin/committees/:id` con `{"name":"Nuevo nombre"}` → 200; confirmar que el
   muro también se renombró (vía `GET /admin/committees/:id` o revisando el feed).
5. `DELETE /admin/committees/:id` → 200; confirmar que el comité ya no aparece en
   `GET /events/:eventId/committees` ni su muro en `GET /events/:eventId/walls`.
6. Repetir cualquiera de los endpoints nuevos con un token sin membership admin activa →
   403 (confirma que `requireAdmin` sigue aplicando).
