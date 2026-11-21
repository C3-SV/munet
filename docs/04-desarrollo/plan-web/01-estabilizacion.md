# Plan de implementación web para estabilización y demo

> **Para agentes:** usar superpowers:executing-plans o superpowers:subagent-driven-development tras revisar el plan. Cada casilla describe trabajo futuro.

**Objetivo** · Completar los accesos a la guía y la orientación de activación, y verificar los recorridos existentes de la demo participante.

**Arquitectura** · Conservar sesión y autorización en los contratos vigentes. Las suscripciones Realtime notifican a la vista para releer la API con el contexto vigente. El checklist integra la entrega de fixtures de D01/D02.

**Tecnología** · Next.js App Router, React, Zustand, Express, Supabase Auth/Storage/Realtime en QA, scripts de tipos y pruebas Node.

**Especificación** · [Alcance web y restricciones](README.md), [reglas](../../01-producto/reglas-de-negocio.md) y [flujos vigentes](../../03-referencia/flujos-funcionales.md).

## Restricciones

- Ámbito público y participante. El flujo administrativo existente se comprueba solo en los puntos de entrada compartidos.
- Los ensayos con escritura se hacen únicamente con fixtures en un Supabase independiente y autorizado. Los HTML, capturas y registros de evidencia deben omitir contraseñas, tokens y datos personales.
- Mantener los contratos públicos de activación/login y la selección de evento vigente en esta fase. La selección participante multi-evento se trata en [W07](04-condicionadas.md#w07--selección-multi-evento).

## Casos prioritarios de revisión

| Caso | Cobertura |
| --- | --- |
| Visitante y participante pueden volver al flujo desde cada acceso de la guía | D06 |
| Cuenta activa y pendiente con el mismo código en eventos distintos | D07 |
| A y B comparten evento, pertenecen a comités distintos y todavía pueden ver perfiles mutuos | D03/D05 |
| Reconexión o cambio de contexto con solicitudes pendientes | D04 |
| Encuesta larga o chat con teclado móvil abierto | D08 |

## D06 · Guía pública y atribución C3

**Rutas y archivos** · `/guia`, `/login`, `apps/web/app/guia/page.tsx`, `apps/web/app/(auth)/login/page.tsx` y `apps/web/components/layout/Footer.tsx`. Reutilizar `BrandAttribution` sin modificar el componente compartido con admin. En `main` ya existe la guía. El footer participante tiene dos enlaces con `href="#"` y la guía aún carece de la atribución C3.

- [ ] Comprobar con navegador local que se puede llegar desde login y desde el footer participante. Registrar qué enlaces carecen de destino y verificar las anclas internas de la guía.
- [x] Añadir un enlace visible a `/guia` desde login y el footer participante. Usar el componente existente para mostrar C3 en la guía. Retirar enlaces vacíos de soporte/términos hasta disponer de sus destinos oficiales. Mantener anclas internas con destino.
- [ ] Repetir navegación anónima y autenticada a la guía, retorno a login, navegación por teclado, foco visible, tema claro/oscuro y comprobación del nombre accesible del enlace C3. Ejecutar `npm run check-types -w web`.
- [ ] Actualizar la guía/registro que corresponda y cerrar con `fix(web): enlazar la guía y completar la atribución C3`.

## D07 · Orientación de cuenta pendiente

**Rutas y archivos** · `/login`, `apps/web/app/(auth)/login/page.tsx`, `apps/web/lib/api/auth.ts`, `apps/web/stores/auth.store.ts`. Contratos existentes `POST /auth/login`, `GET /auth/events-by-code/:participant_code` y `POST /auth/activate`. Login busca solo membresías `ACTIVE`; el paso de activación es el que identifica las pendientes.

- [ ] Preparar casos locales con respuestas simuladas para código sin membresía activa, credenciales inválidas, colisión 409, respuesta de preactivación vacía o con uno/varios eventos, y fallo de red.
- [x] En login diferenciar “No pudimos encontrar una cuenta activa con este código” de “Credenciales inválidas”. Dar una acción explícita para abrir la activación y precargar el código escrito. Confirmar que hay una cuenta pendiente cuando el flujo existente devuelve un evento elegible. Preservar el estado HTTP en el cliente y usar el par actual 400/`Membership no encontrado` para orientar el siguiente paso. Ese par también puede aparecer si falla la búsqueda, por lo que la UI ofrece revisar el código o intentar de nuevo. Otros 400, el 409 y los fallos de red conservan sus mensajes propios. Mantener el login activo cuando el código también tenga una pendiente en otro evento y conservar la selección que ya ofrece el modal.
- [ ] Verificar inicio de sesión con credenciales válidas, activación y entrada posterior, errores sin superposición y aviso accesible. Comprobar que el formulario no inicia una consulta automática de estado ni registra credenciales. Ejecutar `npm run check-types -w web` y `node --test apps/web/lib/api/base-url.test.mjs`.
- [ ] Actualizar [autenticación](../../03-referencia/autenticacion.md), [flujos](../../03-referencia/flujos-funcionales.md) y la trazabilidad cuando corresponda. Cerrar con `fix(web): orientar el ingreso de cuentas pendientes`.

## D03 y D05 · Muros, permisos y perfiles

**Rutas y archivos** · `/feed/[muro]`, `/profile`, `/profile/[membershipId]`, `apps/web/components/layout/Sidebar.tsx`, clientes web `lib/api/events.ts`, `feed.ts` y `profiles.ts`; en API, `routes/events.routes.ts`, `controllers/events.controller.ts`, `controllers/posts.controller.ts`, `utils/walls.utils.ts` y `controllers/profiles.controller.ts`. El listado de muros filtra por `canAccess` en el controlador. El catálogo de comités devuelve metadatos del evento con esa bandera. La autorización de perfil público usa el evento de la membresía activa.

- [ ] Confirmar D01/D02 en QA y aprovisionar el escenario de [calidad](03-calidad.md#entorno-y-registro-de-evidencia).
- [ ] Con A y B en comités distintos del mismo evento, comprobar general, avisos y muro propio en ambas sesiones. Confirmar denegación en la vista de comité ajeno, en la API de contenido y para una sesión de otro evento. Verificar que el delegado no pueda escribir en avisos y que la cuenta autorizada sí pueda.
- [ ] Cambiar alias y avatar de A desde su perfil. Recargar, abrir el perfil de A desde B y verificar que el estado persiste y coincide. Confirmar que el alias aparece al publicar, el límite de evento, el tratamiento de avatar inválido según la API y el estado de perfil sin avatar.
- [ ] Registrar resultados por ID. Si un permiso falla, coordinar corrección con el dueño de la capa y repetir Q01. Si falla un recorrido existente, acotar el fix a la capa responsable y repetir el caso primero fallido. Cerrar evidencia con `docs(web): registrar validación de muros y perfiles`.

## D04 · Realtime de posts, comentarios, encuestas y DM

**Rutas y archivos** · `apps/web/app/(main)/feed/[muro]/page.tsx`, `apps/web/components/feed/PostComments.tsx`, `apps/web/app/(main)/chat/page.tsx`, `apps/web/app/(main)/chat/[id]/page.tsx` y `apps/web/lib/supabase.ts`. Chat establece auth explícita. Feed y comentarios carecen de ese paso explícito; las suscripciones de votos y listado DM requieren confirmar el alcance efectivo de las políticas en QA.

- [ ] Con la línea base D03, registrar en dos sesiones el envío visible de post, comentario, voto/reemplazo/cierre y DM/respuesta/borrado lógico sin recarga manual. Confirmar que un tercero en otro evento, comité restringido o fuera de la conversación no reciba el contenido ni eventos privados.
- [x] Si aparece una brecha del cliente, asegurar que el JWT de la sesión activa esté establecido antes de suscribirse. Limpiar canales al cambiar evento, recurso o sesión. Mantener la relectura autorizada por API. Ante una brecha de RLS/publicación, coordinar la resolución en Q03 y repetir el caso con la política de QA aprobada.
- [ ] Repetir en reconexión y cambio de contexto, verificando ausencia de canales o respuestas del contexto anterior, duplicados y datos ajenos. Ejecutar tipos web, suites de API si cambia el contrato y registrar evidencia separada para entrega, autorización y reconexión.
- [x] Cerrar el ajuste de cliente si hubo cambios con `fix(web): estabilizar suscripciones del participante`. Si el recorrido ya pasaba, registrar únicamente la evidencia.

## D08 y D09 · Responsive y guion de demo

**Rutas y archivos** · `/login`, `/guia`, `/feed/[muro]`, `/profile`, `/profile/[membershipId]`, `/chat` y `/chat/[id]`. Revisar primero los componentes participantes de la pantalla afectada. Evitar estilos globales que repercutan en admin.

- [ ] D08. Fijar como matriz de ensayo propuesta 360×800 y 1440×900, tema claro/oscuro y navegación por teclado. Recorrer login/activación, guía, perfil, feed, encuesta y chat. Incluir textos largos, estados de error/vacío, teclado móvil y operación al 200 % de zoom en escritorio. Registrar navegador y viewport.
- [ ] D08. Corregir desbordes, controles inaccesibles o errores confirmados en el componente de origen y repetir el caso. Verificar tipos web y guardar resultados. Cerrar cada arreglo comprobado con un commit acotado, por ejemplo `fix(web): mantener accesible el compositor de chat en móvil`.
- [ ] D09. Con D01–D08 comprobados o con limitaciones registradas, consolidar el guion participante: ingresar/activar A y B, navegar muros, publicar y comentar, votar, abrir perfil/editar avatar, conversar, revisar guía y repetir la prueba de aislamiento. Admin aporta sus pasos y el inventario de fixtures. Una persona que no intervino en la preparación debe poder repetir el recorrido en QA.
- [ ] D09. Registrar resultados frente al **Checklist demo**, pasos 05–15 y 18, y referenciar la evidencia admin de los pasos restantes. Cerrar con `docs(web): guardar guion y evidencia de la demo`.

## Registro de avance

**Estado al 18 de noviembre de 2026.** Ejecución parcial en `feat/web-improvements`. Las casillas marcadas describen cambios implementados y verificados de forma estática o local; el resto queda pendiente.

| Commit | Alcance |
| --- | --- |
| `b304f88` `fix(web): enlazar la guía y completar la atribución C3` | D06: enlaces a `/guia` desde login y footer, retirada de enlaces vacíos, C3 con el componente compartido. |
| `fb08810` `fix(web): orientar el ingreso de cuentas pendientes` | D07: estado HTTP en el cliente, orientación de login, documentación de autenticación. |
| `37518e7` `fix(web): estabilizar suscripciones del participante` | D04: `setAuth` antes de suscribir en feed y comentarios, relectura al reconectar, limpieza de publicaciones al cambiar de contexto. |
| `91468cc` `fix(web): acotar la escucha de votos de encuesta al muro` | D04: una suscripción `poll_votes` por encuesta del muro en lugar de todas las filas visibles. |

**Evidencia registrada**

- Estática: `npm run check-types -w web` sin errores; `node --test apps/web/lib/api/base-url.test.mjs` pasa 2/2; `git diff --check` sin hallazgos.
- Lint: sin errores. Quedan advertencias preexistentes: 30 de `no-img-element` y 2 de `exhaustive-deps` en `PostComments.tsx`, por `loadComments` sin memorizar. No se añadieron advertencias nuevas en los archivos tocados.
- Navegador local, sin API: `/login` enlaza a `/guia`; `/guia` muestra la atribución C3 y el retorno a login.

**Pendiente o no verificado**

- Footer y navegación desde una sesión autenticada.
- Flujo de cuenta pendiente con API: casos simulados, activación posterior y errores sin superposición.
- Teclado, foco, tema oscuro y viewport 360×800 en D06, D07 y D08.
- Suscripciones `poll_votes` y `posts`: entrega real, aislamiento por evento y reconexión en QA. El filtro `poll_id` requiere que `poll_votes` esté en la publicación de Realtime del entorno de QA, que no está versionada.
- D03/D05 y D09: dependen de fixtures de QA (D01/D02) y del guion participante.

**Limitaciones conocidas**

- La suscripción `poll_votes` abre un filtro por encuesta. Si el muro tiene muchas encuestas, crece el número de vinculaciones del canal.
- Las eliminaciones de votos no llegan con filtro por `poll_id` si la réplica no incluye la columna. El flujo actual de la API solo elimina votos heredados duplicados.
- `PostComments` abre un canal y una consulta por publicación; el coste crece con el número de publicaciones visibles.
