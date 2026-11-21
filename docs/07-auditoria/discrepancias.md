# Discrepancias entre requisitos, código y entorno

El estado corresponde a la [revisión de main](../README.md). Las decisiones históricas se conservan en sus fuentes.

## D-01 — Autorización administrativa por evento

El comportamiento transversal de ADR-004 fue reemplazado por [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md). Las rutas con recurso objetivo verifican membresía administrativa activa en su evento. Las dos rutas de colección de eventos usan `requireAdmin` y el listado filtra por eventos administrados. Corroborar con dos eventos en un entorno aislado.

## D-02 — Ciclo del evento y muros iniciales

El requisito histórico pide borrador y cierre con solo lectura. El alta empieza en `ACTIVE`. La edición permite cerrar o archivar, pero no hay guarda general de escritura. El alta de comités sí rechaza eventos cerrados o archivados. La creación de evento tampoco inserta muros general y de anuncios. Los índices de la 001 no los aprovisionan. Falta verificar si existe un mecanismo adicional en la base del entorno. El feed abre inicialmente `/feed/general`, por lo que la ausencia de ese muro impide cargar la vista inicial.

## D-03 — Credenciales en logs del navegador

Las trazas de payload y respuesta de login se retiraron del cliente. La revisión actual confirma ausencia de esas trazas en `apps/web/lib/api/auth.ts`.

## D-04 — Auditoría sin garantía

Los loggers intentan registrar las acciones e intentos. Un error de auditoría puede coexistir con una operación exitosa. Falta consulta administrativa y la cobertura varía según la acción.

## D-05 — Compatibilidad entre API y esquema

- El alta de evento intenta insertar `role: 'ADMIN'`. El [snapshot](../../supabase/schema.sql) enumera `ADMIN_MUN` y `ADMIN_TECH` como valores administrativos. Si el enum efectivo coincide, falla la membresía y el controlador intenta revertir el evento.
- Resuelta el 20 de noviembre de 2026: el alta y la edición usan un select con los cuatro roles del enum y la API valida el valor. El CSV normaliza a `PARTICIPANT` o `MODERATOR`.
- Participantes, perfiles y borrado de contenido dependen de columnas de la 001. La API invoca una función de la 002 al dar de alta y conserva la cuenta con un aviso si la RPC devuelve error. Estado de aplicación y permisos efectivos pendientes de verificar.
- El snapshot y las dos migraciones no describen todas las políticas, triggers, publicación Realtime ni buckets. Véase [base de datos](../02-arquitectura/base-de-datos.md).

## D-06 — Funciones postergadas

Reportes y notificaciones persisten como requisitos históricos. Los planes recientes postergan su desarrollo. Adjuntos y fijado tienen soporte de esquema. Los adjuntos tienen además interfaz web, API y cliente de almacenamiento implementados en la rama (ADR-006), pendientes de aplicar la migración 003, crear el bucket en uso y verificar; el fijado carece de UI.

## D-07 — Diferencias entre API y panel

CSV, búsqueda de participantes por texto, borrado de comités y el endpoint dedicado de cambio de comité carecen de controles web propios. La ficha sí cambia comité mediante la edición general y el listado ofrece filtros. Las páginas generales de asignaciones y moderación son marcadores.

## D-08 — Escrituras compuestas

Alta de evento, comités, cuentas, encuestas y edición de varios datos ejecutan escrituras separadas. Algunas intentan compensación. Se requiere comprobar recuperación ante fallos y reintentos, en particular CSV y credenciales devueltas una sola vez. El borrado de comité responde éxito aunque falle la actualización de su muro.

## D-09 — Atribución de borrado

Posts conservan `AUTHOR` o `ADMIN` en el campo histórico, cuyo nombre sugiere un identificador. Posts y comentarios también escriben el UUID del actor en campos de la 001. DM usa `DELETED` y la membresía autora. El requisito histórico de ocultación sin marcador no está satisfecho en todos los casos.

## D-10 — Cobertura de pruebas y pipeline

La API tiene `build`, `check-types` y `test`. Turbo incluye la API en build y tipos. Faltan lint de API, tarea general de test y recorridos integrados. Véase [verificación](../04-desarrollo/pruebas-y-validacion.md).

## D-11 — Realtime y Storage no verificados

Chat establece explícitamente el JWT de Realtime. Feed y comentarios no lo establecen en sus suscripciones revisadas. Confirmar entrega y permisos con dos sesiones y un entorno aislado, además de la subida y lectura de avatares.

## D-12 — Código de ingreso y activación

La unicidad de `participant_code` documentada es por evento. El login no recibe evento y devuelve 409 ante códigos activos vinculados a usuarios diferentes. La activación usa un correo derivado del código si el usuario interno todavía no tiene correo. La colisión en el flujo completo debe reproducirse en una base aislada y resolverse como decisión de producto.

## D-13 — Versión de Node

El root declara `>=18`, mientras que Next.js 16.1.5 requiere `>=20.9.0` según el lockfile. Consulta [configuración local](../04-desarrollo/configuracion-local.md).

## D-14 — Reactivación de cuentas sin activar

Suspender puede aplicarse a una cuenta pendiente. Reactivar establece `ACTIVE` sin comprobar si existe identidad de Supabase Auth. La persona podría quedar sin poder activar ni restablecer la contraseña desde la ficha. Verificar la transición de extremo a extremo y distinguir el estado previo.
