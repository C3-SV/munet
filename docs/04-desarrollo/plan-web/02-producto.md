# Plan de implementación para producto participante

> **Para agentes:** usar superpowers:executing-plans o superpowers:subagent-driven-development tras revisar el plan. Cada casilla describe trabajo futuro.

**Objetivo** · Incorporar el directorio y su filtro en chat, completar la presentación del código de delegación y preparar las mejoras de identidad y perfil pedidas por MUN.

**Arquitectura** · Un contrato participante autenticado sirve el directorio y se reutiliza en el selector de destinatarios. Los endpoints de perfiles conservan el contexto de membresía y evento. Cada tarea conserva sus criterios de aprobación.

**Tecnología** · Next.js App Router, React, cliente HTTP web, Express/TypeScript, servicios Supabase desde API y pruebas Node.

**Especificación** · [Alcance web e insumos](README.md), [reglas](../../01-producto/reglas-de-negocio.md) y [contratos vigentes](../../03-referencia/api.md).

## Restricciones

- P1 tras iniciar estabilización. W02 precede a W03. W01, A03 y W04 se habilitan con los insumos de su ID y pueden revisarse por separado.
- Usar el contexto autenticado de la API para cada lectura. La búsqueda participante expone campos autorizados de perfil, sin credenciales ni datos de administración.
- Preservar `GET /dm/participants` y su respuesta para consumidores existentes hasta que se acuerde una transición. El panel administrativo y sus contratos quedan fuera del diff.

## Casos prioritarios de revisión

| Caso | Cobertura |
| --- | --- |
| Logo ausente en un evento y logo aprobado con ambos temas | W01 |
| Resultado posterior al límite histórico de 80, con alias con tilde y nombre repetido | W02 |
| Cambiar filtro/evento mientras llega una respuesta y abrir un DM existente | W03 |
| Identificador de delegación ausente en una cuenta previa | A03 web |
| Dos lectores con permisos distintos frente a contenido retirado o de comité restringido | W04 |

## W01 · Identidad de MUN

**Dependencia** · B01, PNG HD y ubicación de MUN ESEN. **Rutas y archivos propuestos** · `/guia`, `apps/web/app/guia/page.tsx`, `apps/web/public/mun-esen.png`. Si el logo identifica a un evento, acordar cómo condicionar su presentación al evento antes de agregarlo a una pantalla compartida.

- [ ] Registrar quién aprobó el asset, dónde debe verse y el texto alternativo. Preparar la vista objetivo con y sin asset aplicable.
- [ ] Añadir el asset en la ubicación aprobada conservando la proporción, la paleta azul/blanco y las marcas MUNET y C3. Mantener el encabezado funcional para eventos sin ese logo.
- [ ] Revisar el contraste en ambos temas, tamaño móvil y escritorio, rutas sin identidad MUN y resultado de `npm run check-types -w web`. Documentar la ubicación y cerrar con `feat(web): mostrar el logotipo oficial de MUN ESEN`.

## A03 · Código de delegación en superficies participantes

**Dependencia** · Entrega admin/API de la 001/002 comprobada en QA con fixtures y confirmación de las superficies que exponen el código. **Rutas y archivos** · `/profile`, `/profile/[membershipId]`, `apps/web/lib/api/profiles.ts`, `apps/web/components/profile/UserHoverCard.tsx` y, si se autoriza en el directorio, el contrato de W02. Perfil propio y público ya muestran el campo `delegationCode` cuando está presente.

- [ ] Pedir evidencia de formato y estabilidad por evento. Comprobar perfiles con código y cuentas anteriores donde falte. Confirmar qué tarjeta y búsqueda deben exponerlo según S2-13.
- [ ] Conectar únicamente superficies participantes que falten al campo confirmado `delegationCode: string | null`. Omitir la insignia o resultado de código si el valor es nulo. Conservar código de inicio de sesión fuera de esas superficies.
- [ ] Validar el mismo código en los puntos autorizados, sin duplicados en las fixtures de QA, desde otra membresía del mismo evento y con valor ausente. Derivar inconsistencias de asignación al equipo propietario de la RPC. Ejecutar tipos web, actualizar perfiles/referencia y cerrar con `feat(web): mostrar el código de delegación en tarjetas autorizadas` si se requiere un cambio.

## W02 · Directorio paginado

**Dependencias** · D02 y revisión del contrato con API. **Archivos** · incorporar la ruta a `apps/api/src/routes/events.routes.ts`, el controlador en `apps/api/src/controllers/events.controller.ts`, el servicio en `apps/api/src/services/participant-directory.service.ts` y su prueba en `apps/api/src/services/participant-directory.service.test.cjs`. En web, crear `apps/web/lib/api/directory.ts` y `apps/web/app/(main)/directory/page.tsx`, con enlace desde `apps/web/components/layout/Sidebar.tsx`. El buscador actual de DM aplica un límite de 80 antes de filtrar.

**Contrato propuesto** · `GET /events/:eventId/participants?q=&committee_id=&page=&limit=`, con bearer token y membresía activa del evento de ruta. Si se envía `x-event-id`, debe coincidir con el evento de ruta. `page` empieza en 1, `limit` por defecto 20 y máximo 100. Respuesta `{ participants, page, limit, hasMore }`. Cada fila contiene `membershipId`, `firstName`, `lastName`, `alias` y `committee` con `id` y `name` cuando corresponda. El contrato base usa alias y comité anulables. Los roles incluidos y la política de comités archivados o ausentes se confirman antes de fijar la prueba. W03 consume el cliente común `listParticipantDirectory(context, filters)`.

- [ ] Fijar el contrato y los campos con API. Preparar casos con búsqueda vacía, nombre y alias con/sin tildes, nombres repetidos en dos páginas, página final vacía, IDs o paginación inválidos, comité ajeno al evento y actor sin membresía activa. Añadir datos suficientes para que la coincidencia buscada esté fuera de las primeras 80 filas. Esperar solo perfiles autorizados de ese evento y un orden estable.
- [ ] Probar primero el servicio y el controlador con sustitutos. Implementar búsqueda por nombre/alias y filtro por comité sobre el conjunto autorizado antes de paginar. Ordenar por apellido, nombre e ID de membresía como desempate. Si la semántica aprobada exige normalizar en API, recorrer lotes acotados en orden estable hasta completar y confirmar la página; medir ese coste en Q03. Mantener el contrato administrativo de búsqueda aparte.
- [ ] Implementar la vista de directorio y estados de carga/error/sin resultados. Reiniciar la página al cambiar consulta o comité, descartar respuestas de un contexto anterior y abrir `/profile/[membershipId]` desde cada resultado.
- [ ] Ejecutar `npm test -w api`, `npm run check-types -w api` y `npm run check-types -w web`. En QA, verificar búsqueda más allá de 80, navegación de páginas sin omisiones con fixtures estables y límites de evento. Actualizar [API](../../03-referencia/api.md), [frontend](../../02-arquitectura/frontend.md) y trazabilidad. Cerrar con `feat(web): incorporar directorio paginado de delegados`.

## W03 · Filtro por comité en mensajes directos

**Dependencia** · W02 con contrato publicado. **Rutas y archivos** · `/chat`, `/chat/[id]`, `apps/web/app/(main)/chat/page.tsx`, `apps/web/components/chat/ChatSearch.tsx`, `apps/web/lib/api/directory.ts`, `events.ts` y `chat.ts`.

- [ ] Preparar el caso de delegados de comités distintos. Comprobar “Todos los comités”, búsqueda sin texto, búsqueda más filtro, estado vacío, cambio de evento con respuesta pendiente y selección de una conversación existente.
- [ ] Mostrar el catálogo participante de comités del evento según la política confirmada en W02. Aplicar `committee_id` y consulta por medio de `listParticipantDirectory` en el buscador de destinatarios, excluyendo a la propia membresía del conjunto en modo DM antes de informar página disponible. Acordar con API este modo como extensión de W02 (por ejemplo, `exclude_self=true`); la exclusión se calcula a partir de la membresía autenticada. Mantener la creación/reutilización en `POST /dm/conversations` y la pantalla de mensajes vigente.
- [ ] Verificar que filtrar destinatarios permite abrir el DM de un delegado de otro comité autorizado del mismo evento, no modifica el historial y no abre un recurso de otro evento. Ejecutar los tipos web y, si se añadió el modo, las pruebas y los tipos API. Actualizar API y flujos. Cerrar con `feat(web): filtrar destinatarios del chat por comité`.

## W04 · Conteo de publicaciones en perfiles

**Dependencia** · B02 con ejemplos aprobados. **Rutas y archivos** · lectura desde `GET /profiles/me` y `GET /profiles/:membershipId`, `apps/api/src/controllers/profiles.controller.ts`, tipos `MyProfile` y `PublicProfile` en `apps/web/types/common.ts`, su cliente `apps/web/lib/api/profiles.ts` y páginas de perfil. Confirmar si el conteo depende de la visibilidad del lector.

- [ ] Convertir los ejemplos aprobados en casos de perfil propio/público: cero, texto, encuesta, eliminado/moderado, comité permitido/restringido y publicaciones de otro evento.
- [ ] Añadir a las dos respuestas de lectura un campo propuesto `publicationCount: number`; calcularlo en API por membresía y evento con la regla aprobada de tipo, estado y visibilidad. Mostrar cero como valor válido y mantener el estado de error si falla la carga. Evitar contar con el conjunto parcial del feed web.
- [ ] Confirmar resultados exactos en fixtures desde dos contextos y que la nueva propiedad no agrega información sobre contenido restringido fuera de lo aprobado. Ejecutar pruebas y tipos API/web. Actualizar las reglas pertinentes, API y matriz antes de cerrar con `feat(web): mostrar publicaciones contabilizadas en perfiles`.

## Registro de avance

**Estado al 19 de noviembre de 2026.** Ejecución en `feat/web-improvements`. Las casillas siguen sin marcar porque la verificación en QA no se ha hecho; este registro describe lo implementado y su evidencia.

| Commit | Alcance |
| --- | --- |
| `9ba0c46` | W01: logotipo provisional de MUN ESEN en `/guia`, según tema claro u oscuro. Los archivos finales siguen pendientes de aprobación de MUN ESEN. |
| `a9b85dd` | W02 API: `GET /events/:eventId/participants`, con búsqueda sin tildes, filtro por comité, paginación posterior al filtrado y 19 pruebas con sustitutos. |
| `629af92` | W02 web: página `/directory`, cliente `listParticipantDirectory` y enlace en la barra lateral. |
| `c6766bc` | W03: selector de comité en el buscador de destinatarios y corrección de estado al cambiar de evento, término o comité. |

**Evidencia:** `npm test -w api` pasa 129/129; `check-types` pasa en api y web; `node --test` pasa 14/14 en web.

**Decisiones tomadas y por confirmar:**
- Roles: el directorio incluye a todos los miembros activos, según el contrato de sprint 1.
- Comités archivados: se muestran y se pueden filtrar; pendiente de confirmar.
- Coste de búsqueda: filtrado en memoria por lotes de 500; se mide en Q03.
- Exclusión propia en W03: se hace en cliente, sin parámetro nuevo en la API.

**Pendiente:**
- W02 y W03 sin prueba en QA ni en navegador; la búsqueda más allá de 80 filas y la paginación sin omisiones requieren fixtures.
- Documentación de traza y matriz de trazabilidad.
- A03 en directorio: el código ya se muestra cuando existe; las superficies de DM y chat requieren la decisión S2-13.
- W04: bloqueado por B02 (regla de conteo de publicaciones).
- W01: sustituir los logos provisionales cuando MUN ESEN apruebe los archivos finales.
