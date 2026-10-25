# Modelos de datos

Referencia de dominio inferida del código; no sustituye el esquema SQL ausente.

## Núcleo de identidad

| Entidad | Campos usados conceptualmente | Responsabilidad |
|---|---|---|
| `users` | id, identidad/auth, estado | Persona global vinculada a Supabase Auth |
| `events` | id, name, slug, status, read-only, fechas | Frontera organizativa |
| `event_memberships` | id, user_id, event_id, role, account_status, participant_code, committee_id | Identidad contextual y permisos |
| `profiles` | membership_id, display_name, bio, imagen | Presentación pública en el evento |
| `committees` | event_id, name, code, description, sort_order, status | Agrupación dentro del evento |

## Contenido

| Entidad | Relación/uso |
|---|---|
| `walls` | Evento; tipos general, anuncios y comité |
| `posts` | Muro y autor-membresía; texto/encuesta; estado y borrado |
| `post_committee_tags` | Etiquetas de comité observadas al leer contenido |
| `post_comments` | Post, autor y padre opcional de primer nivel |
| `polls` | Extensión uno a uno de un post encuesta |
| `poll_options` | Opciones ordenadas de encuesta |
| `poll_votes` | Opción y membresía votante |

## Mensajería y control

| Entidad | Relación/uso |
|---|---|
| `dm_conversations` | Evento y pareja de membresías |
| `dm_messages` | Conversación, remitente, contenido y estado de borrado |
| `audit_logs` | Intentos de auditoría de acciones |
| `auth_attempts` | Intentos de autenticación |

## Estados encontrados o esperados

- Evento histórico: `DRAFT`, `ACTIVE`, `CLOSED`; el código de alta usa `ACTIVE`.
- Membresía/cuenta: al menos pendiente y `ACTIVE`; los nombres exactos completos dependen del esquema.
- Contenido: `VISIBLE`, `DELETED` y variantes inferidas.
- Mensajes: el valor de borrado es configurable porque los entornos pueden tener enums distintos.

## Fuente de verdad necesaria

Antes de una migración o cambio de contrato deben incorporarse al repositorio:

1. DDL/migraciones de todas las tablas y enums.
2. Índices y restricciones únicas.
3. Funciones, triggers y cascadas.
4. Políticas RLS y grants.
5. Buckets y políticas de Storage.

Hasta entonces, todo campo no visible en las consultas debe marcarse como no verificado.
