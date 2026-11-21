# Plan de implementación para mejoras sujetas a decisión

> **Para agentes:** usar superpowers:executing-plans o superpowers:subagent-driven-development tras aprobar el alcance de la tarea. Cada casilla describe trabajo futuro.

**Objetivo** · Dejar listos para decisión el selector multi-evento, las fotos en general, el tour y las mejoras posteriores.

**Arquitectura** · El selector extiende la entrada participante existente. Los adjuntos pasan por API y Storage privado, con visibilidad del muro. La documentación y el tour siguen los recorridos comprobados.

**Tecnología** · Next.js, Zustand, Express, Supabase Storage privado y pruebas Node.

**Especificación** · [Alcance web e insumos](README.md), [reglas](../../01-producto/reglas-de-negocio.md) y [pendientes de producto](../../07-auditoria/pendientes.md).

## Restricciones

- W07 P2 depende de B14. W05 P2 depende de B03/B04 y Q03. W06 y Q04 son P3 posteriores a la demo.
- Distinguir el login, que identifica a una persona, del selector, que elige su membresía activa. Preservar el flujo administrativo.
- Los adjuntos siguen el menor alcance aprobado. El criterio histórico de RN-11 incluye PDF, cuya incorporación requiere B04.
- La revisión de datos, la verificación de Storage y la captura audiovisual usan fixtures en QA independiente.

## Casos prioritarios de revisión

| Caso | Cobertura |
| --- | --- |
| La selección recordada fue suspendida mientras estaba abierta | W07 |
| Persona con membresías participante y admin | W07 |
| Una carga se interrumpe antes de asociar el archivo | W05 |
| Un lector pierde acceso después de abrir el contenido | W05 |
| El tour enseña una pantalla que ya cambió | W06 |

## W07 · Selección multi-evento

**Dependencia** · B14 y coordinación de B07 si se reproduce colisión entre usuarios. **Rutas y archivos** · `/login`, `/select-event`, `apps/web/app/(auth)/login/page.tsx`, `apps/web/app/select-event/page.tsx`, `apps/web/app/(main)/layout.tsx`, `apps/web/stores/auth.store.ts` y `apps/web/components/layout/Sidebar.tsx`. Hoy login y el store pueden elegir la primera membresía participante cuando hay varias.

- [ ] Pedir a MUN ejemplos para cero, una y varias membresías, incluida selección previa válida/caducada y cambio voluntario. Proponer entrada directa con una membresía, selector con varias y sin contexto válido, y conservar una selección previa solo si continúa autorizada. Confirmar si el cambio se ofrece desde el sidebar participante.
- [ ] Preparar pruebas para hidratación, sesión recién iniciada, selección recordada vigente, cambio de evento, suspensión y cuenta con roles mixtos. Separar colisión 409 en login como dependencia de admin/API.
- [ ] Aplicar la regla aprobada tanto en login como en restauración de contexto (hidratación y `refreshContext`). Usar la selección existente de membresía y limpiar resultados/canales del evento anterior al cambiar de contexto. Mantener el destino actual del flujo administrativo.
- [ ] Comprobar que feed, perfil y chat consultan solo el evento elegido, que las rutas directas respetan el límite de evento y que el flujo mixto conserva sus entradas. Ejecutar tipos web y repetir Q01. Actualizar autenticación, flujos y REQ-04/07. Cerrar con `feat(web): elegir el evento participante activo`.

## W05 · Fotos en el muro general

**Dependencia** · B03/B04 y Q03 para Storage/RLS. **Ámbito propuesto** · JPG/PNG en posts del muro general, con tipo, tamaño y cantidad aprobados por MUN. **Rutas y archivos** · `apps/web/components/feed/PostEditor.tsx`, `PostCard.tsx`, `apps/web/lib/api/feed.ts`, `apps/api/src/routes/posts.routes.ts`, `controllers/posts.controller.ts`, `services/posts.service.ts` y tabla `attachments` de la 001. La tabla existe en los archivos versionados y el recorrido de API/UI sigue pendiente.

- [ ] Cerrar con producto el tamaño, unidad de límite, cantidad, tipos, moderación, retiro/retención y condiciones de entrega. Confirmar cómo se comportan lectores que pierden membresía y qué vigencia de URL admite la regla. Fijar request, respuesta y errores de carga/lectura/retiro en [API](../../03-referencia/api.md) al aprobar el contrato.
- [ ] Escribir pruebas para tipo/tamaño inválido, muro no permitido, lectura de otro evento, reintento, interrupción entre carga y asociación y retiro de publicación. Usar sustitutos para API y Storage inicialmente.
- [ ] Añadir selección, vista previa y estados de progreso/error al editor. Validar el archivo y el permiso del muro en API. Guardar en bucket privado y autorizar cada entrega según evento y visibilidad vigente. Acordar una estrategia de entrega que cumpla el retiro aprobado. Mantener consistentes fila y objeto al fallar o reintentar.
- [ ] Verificar en QA carga y lectura autorizadas, rechazo de accesos fuera de ámbito, caducidad o retiro de acceso según el contrato aprobado, y ausencia de objetos activos huérfanos en los casos de error/retiro. Ejecutar pruebas/tipos de API y tipos web. Actualizar reglas, modelos, API y REQ-16. Cerrar con `feat(web): permitir fotos autorizadas en el muro general`.

## W06 · Tour del producto

**Dependencia** · D06/D09 estables y B11. **Superficie propuesta** · `/guia` en `apps/web/app/guia/page.tsx`, solo si MUN confirma que allí debe aparecer el enlace.

- [ ] Aprobar formato, audiencia, guion y ubicación. Proponer una captura real breve de activación, muros, perfil y chat con fixtures ficticias.
- [ ] Revisar guion y grabación contra las rutas vigentes. Aportar subtítulos o transcripción, excluir credenciales y solicitar aprobación del contenido y del destino antes de compartirlo.
- [ ] Si se incorpora el enlace a la guía, verificar reproducción y alternativa textual, y cerrar con `docs(web): incorporar el tour aprobado a la guía` si solo cambia documentación o `feat(web): enlazar el tour aprobado en la guía` si cambia la ruta.

## Q04 · Mantenimiento y solicitudes posteriores

**Dependencia** · Demo terminada, producto estable y aprobación del listado de trabajo. **Candidatos** · S3-11 (código/configuración), reportes REQ-20, notificaciones REQ-22 y propuestas del backlog histórico.

- [ ] Registrar evidencia del problema y priorizar cada mejora posterior con web/MUN. Abrir un plan propio si cambia un contrato o una regla, con la decisión que lo habilita.
- [ ] Para limpieza, reproducir la comprobación afectada, acotar el cambio a web participante y repetir las verificaciones. Para reportes/notificaciones, confirmar alcance, permisos y entregables antes de estimar. B15 exige una decisión expresa de privacidad, permisos y auditoría antes de planear la supervisión o bloqueo de DM.
- [ ] Registrar el resultado de cada tarea cerrada y actualizar su documento especializado. Los commits se nombran por el ajuste comprobado.

## Registro de inventario estático

**Estado al 19 de noviembre de 2026.** Inventario de solo lectura sobre `7d57fa1` en `feat/web-improvements`. No hay tareas cerradas: todas las casillas siguen sin marcar porque dependen de decisiones de producto (B03/B04, B11, B14, B15) o de Q03.

**W07 · Selección multi-evento (evidencia estática).** El plan describe bien el comportamiento actual: para participantes con varias membresías, login, el store, `select-event` y el layout eligen `memberships[0]` sin mostrar selector. Hallazgos:
- `docs/03-referencia/flujos-funcionales.md:9` describe un selector para elegir evento cuando hay varias membresías. El código solo muestra el selector a administradores; `manual-funcional.md:69` coincide con el flujo documentado, no con el código.
- El orden de `memberships[0]` depende de una consulta sin `ORDER BY` (`apps/api/src/services/auth-context.service.ts:70-99`; `auth.controller.ts:232-239`), así que la selección automática puede cambiar entre sesiones.
- `refreshContext` (`apps/web/stores/auth.store.ts:273-304`) no tiene llamadas en `apps/web`: la ruta de restauración que el plan quiere cambiar no la ejecuta ninguna pantalla.
- La hidratación solo comprueba que la membresía recordada siga en la lista local (`auth.store.ts:212-215`); no revalida suspensión ni cierre de evento.
- `setActiveMembership` no limpia estado del evento anterior (`auth.store.ts:256-270`). El sidebar conserva los muros previos hasta que termina la nueva carga (`Sidebar.tsx:97-128`); el plan pide esa limpieza y no existe.
- El sidebar no ofrece cambio de evento a participantes (`Sidebar.tsx:167, 294-302`). La pregunta abierta del plan se responde con "no" en el código actual.
- El 409 por colisión de código no se mapea en login (`apps/web/app/(auth)/login/page.tsx:131-136`).

**W05 · Fotos en el muro general (evidencia estática).** No hay implementación de adjuntos en posts: el editor solo admite texto y encuesta (`PostEditor.tsx:3-7, 62-66`), el cliente API y las rutas no tienen campos ni endpoints de archivos (`feed.ts:26-67`; `posts.routes.ts:18-25`), y `createPostService` no toca Storage (`posts.service.ts:489-501`). Storage solo se usa para avatares de perfil (`profiles.controller.ts:85-86, 379`). La tabla `attachments` existe en la migración 001 (`001_alias_codigo_fijados_archivos.sql:44-61`), con RLS sin políticas; el bucket privado no está versionado. Hallazgos:
- `RN-11` (`docs/01-producto/reglas-de-negocio.md:46`) fija JPG/PNG ≤ 5 MB **o PDF ≤ 20 MB**. El plan propone solo JPG/PNG y dice "menor alcance aprobado" (`04-condicionadas.md:17`); ningún documento de decisión respalda ese alcance.
- B03 y B04 no aparecen en `pendientes.md` ni en `reglas-de-negocio.md`: no hay registro de decisión.

**W06 · Tour (evidencia estática).** `apps/web/app/guia/page.tsx` tiene cuatro secciones (primeros pasos, participantes, organizadores, FAQ) sin video, iframe ni reproductor. No hay guion, subtítulos ni archivos de video en `apps/web/public`. B11 vive en la planilla externa `MUNET_Plan_Maestro_Unificado_2026-11-18.xlsx`, que no está en el repositorio.

**Q04 · Mantenimiento posterior (evidencia estática).** REQ-20 (reportes) y REQ-22 (avisos persistentes) figuran como "documentado, no implementado; postergado" (`requerimientos.md:26, 28`; `matriz-de-trazabilidad.md:26, 28`). S3-11 y S3-08 no tienen definición en el repositorio. Ninguna condición previa de Q04 (demo terminada, producto estable, listado aprobado) consta como cumplida. B15 no tiene ID en `pendientes.md`; su equivalente es la decisión sobre supervisión, bloqueo y expulsión de DM, sin ADR.

**IDs de decisión sin registro en el repositorio:** B03, B04, B07, B11, B14, B15, S2-13, S3-08 y S3-11. Aparecen solo en los planes o en la planilla externa. Esto impide cerrar W05, W07 y W06 hasta que MUN ESEN o el equipo admin las registren.

**Lo que no se ejecutó:** pruebas de W07 con varias membresías reales, carga de adjuntos, recorrido del tour. Requieren cuentas de prueba, decisiones de producto y el proyecto de QA independiente.
