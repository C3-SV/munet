# Modelos de datos

Las entidades siguientes reflejan el contrato usado por el código. Consulta el [estado del SQL versionado](../02-arquitectura/base-de-datos.md) para el alcance del snapshot y las migraciones.

## Identidad y organización

| Tabla | Campos relevantes | Función |
|---|---|---|
| `users` | `id`, `supabase_auth_user_id`, `email`, `system_status` | Identidad interna que se vincula a Supabase Auth en la activación. |
| `events` | `id`, `name`, `slug`, fechas, `status`, `is_read_only` | Contexto de organización. El alta usa `ACTIVE`. La API de edición permite `ACTIVE`, `CLOSED` y `ARCHIVED`. |
| `event_memberships` | `id`, `event_id`, `user_id`, `role`, `account_status`, `participant_code`, `delegation_code`, `committee_id`, `delegation_name`, `institution_name`, `initial_password_hash` | Identidad contextual. El comité puede quedar vacío. Alta, activación y suspensión usan `PENDING_ACTIVATION`, `ACTIVE` y `SUSPENDED`. |
| `profiles` | `event_membership_id`, nombres, `display_name`, `bio`, `profile_image_path`, `alias` | Identidad visible en el evento. Alias opcional de hasta 60 caracteres. |
| `committees` | `event_id`, `name`, `code`, `description`, `sort_order`, `status` | Agrupación del evento y referencia del muro de comité. |

### Dos códigos con usos distintos

- `participant_code` lo proporciona la administración y sirve para activar e ingresar. El snapshot describe unicidad por evento. El CSV comprueba duplicados sin distinguir mayúsculas y minúsculas. El alta individual busca coincidencia exacta. El login no recibe evento y devuelve conflicto para coincidencias activas de usuarios distintos.
- `delegation_code` es un identificador visible, como `#042`. La migración 001 agrega una columna nullable y un índice único por evento para códigos presentes. La 002 define el contador `event_delegation_counters`, la RPC idempotente `assign_delegation_code`, el trigger de inmutabilidad y la asignación a membresías existentes sin código. El contador asigna números atómicamente por evento, con al menos tres dígitos y posibles huecos. El código puede quedar vacío si falla la RPC de alta.

## Comunicación y trazabilidad

| Tablas | Relación y uso |
|---|---|
| `walls`, `posts`, `post_committee_tags` | Muros `GENERAL`, `ANNOUNCEMENTS` o `COMMITTEE` y publicaciones de una membresía. El código lee los tags. SQL contiene columnas para fijar posts. |
| `post_comments` | Post, autor y comentario padre opcional, con un nivel de respuesta. |
| `polls`, `poll_options`, `poll_votes` | Encuesta de un post, opciones ordenadas y voto por membresía. El snapshot documenta unicidad por encuesta y votante. |
| `dm_conversations`, `dm_messages` | Pareja de membresías del evento y mensajes. El borrado usa `DELETED`. |
| `attachments` | Tabla definida por migración 001. Carga, lectura y retiro todavía pendientes en la aplicación. |
| `audit_logs`, `auth_attempts` | Registro de acciones e intentos cuando la inserción se completa. |

En `posts.deleted_by_membership_id` el valor histórico es la categoría `AUTHOR` o `ADMIN`. Posts y comentarios escriben además `deleted_by_membership_uuid`. DM guarda directamente la membresía en `deleted_by_membership_id`.
