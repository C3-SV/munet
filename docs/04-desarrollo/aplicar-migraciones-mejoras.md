# Aplicar las migraciones de «Mejoras y correcciones» (004 a 009)

Las mejoras 2 a 10 del documento «MUNET — Mejoras y correcciones» (24 de noviembre de 2026) necesitan cambios en la base de datos. Las migraciones están escritas como borrador en `supabase/migrations/` y **no están aplicadas**. Se ejecutan en el SQL Editor de Supabase, una por una y en este orden, **antes** de desplegar o probar el código de cada mejora.

> La base es compartida y de producción. Avisa a Rober y al equipo antes de ejecutar, y no lo hagas mientras alguien importa participantes.

## Qué pasa si el código corre sin su migración

El código nuevo lee las columnas y tablas nuevas. Sin la migración correspondiente fallan, sobre todo:

| Sin aplicar | Efecto |
|---|---|
| 004 | La sala de mensajes directos no carga ni envía (lee `read_at`). |
| 005 | Los avisos nuevos no se cuentan; los mensajes sí. No rompe nada más. |
| 006 | Las reacciones no funcionan; el feed sigue (los contadores quedan en cero). |
| 007 | El feed falla (lee `attachments.position`) y no se pueden subir varios archivos. |
| 009 | La sala de mensajes directos no carga (lee `edited_at`). |

Por eso el orden es: aplicar la migración → desplegar el código.

## Orden y propósito

| # | Archivo | Mejora | Qué hace |
|---|---|---|---|
| 004 | `004_lectura_mensajes_directos.sql` | 8 y 2 | `dm_messages.read_at` + índice; marca como leído el historial existente |
| 005 | `005_notificaciones_avisos.sql` | 2 | Tabla `wall_reads` (última lectura de avisos); marca como leídos los avisos existentes |
| 006 | `006_reacciones_publicaciones.sql` | 4 | Tabla `post_reactions` (una reacción por persona y publicación) |
| 007 | `007_adjuntos_multiples.sql` | 10 | Quita el índice de un adjunto por post, agrega `attachments.position`, sube el tope de subida a 30 MB |
| 009 | `009_edicion_mensajes_directos.sql` | 9 | `dm_messages.edited_at` |

No existe la 008: el número quedó libre. Las migraciones 001 a 003 ya están aplicadas.

## Antes de empezar

La 007 solo requiere que no haya publicaciones con más de un adjunto (no puede haberlas: hasta hoy se limitaba a uno). Comprobación de solo lectura:

```sql
select post_id, count(*) from public.attachments group by 1 having count(*) > 1;  -- debe dar 0 filas
```

## Verificación después de aplicar (solo lectura)

```sql
-- 004 y 009: deben aparecer las dos columnas
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'dm_messages' and column_name in ('read_at', 'edited_at');

-- 004: justo tras aplicarla no queda ningún mensaje sin leer del historial
select count(*) from public.dm_messages where read_at is null;

-- 005 y 006: tablas nuevas con seguridad de filas activa
select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('wall_reads', 'post_reactions');

-- 007: ya no existe uq_attachments_post y sí idx_attachments_post_position
select indexname from pg_indexes where schemaname = 'public' and tablename = 'attachments' order by 1;
```

## Variables de entorno opcionales

- `STORAGE_QUOTA_BYTES` (API): cuota de almacenamiento de adjuntos en bytes. Con ella se alerta al 90 % y se bloquean las cargas nuevas al 95 %. Sin ella no hay protección. Ver `apps/api/.env.example`.

## Cómo deshacer

Cada archivo trae al final sus líneas de reversión comentadas. La 004 y la 009 pierden las marcas de lectura o de edición; la 007 solo se puede deshacer si ninguna publicación tiene más de un adjunto.

## Comprobación hecha

Las cinco migraciones se ejecutaron dos veces seguidas en un Postgres de prueba (esquema mínimo más las migraciones 001 y 003): sin errores, sin efectos al repetirlas y con el comportamiento esperado (tres adjuntos en un post, tope de 30 MB, una reacción por persona y publicación, rechazo de reacciones desconocidas). No se ejecutaron contra la base real.
