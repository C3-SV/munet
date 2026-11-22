# ADR-007 — Selección de evento, ciclo del evento y moderación mínima

- **Estado:** aceptada; no implementada
- **Fecha de la decisión:** 2026-11-21
- **Relacionada con:** [ADR-002](ADR-002-api-como-frontera-de-datos.md) (Realtime como excepción), [ADR-003](ADR-003-identidad-por-membresia.md) (identidad por membresía) y [ADR-005](ADR-005-autorizacion-administrativa-por-evento.md) (administración por evento)
- **Resuelve parcialmente:** B14 (W07), la fila 4 (ciclo del evento) y la fila 5 (moderación mínima) del [orden propuesto](../PENDIENTES.md#1-orden-propuesto), y los puntos de la [sección 2](../PENDIENTES.md#2-decisiones-de-producto) que citan esas decisiones

## Contexto

Estas decisiones estaban pendientes en [pendientes](../PENDIENTES.md). Bloqueaban W07 (selección de evento según B14), el ciclo del evento y la moderación mínima para MUN ESEN.

Las reglas existentes solo cubren parte del asunto. [Reglas de negocio](../01-producto/reglas-de-negocio.md) y [REQ-01](../01-producto/requerimientos.md) exigen que el evento cerrado sea de solo lectura, pero no definen la reapertura ni un estado de archivo. El panel de moderación ya elimina con motivo, retira adjuntos, fija, suspende y reactiva, pero no oculta contenido sin borrarlo.

## Decisión

### 1. Selección de evento (B14)

- Un participante con varias membresías activas entra al evento según un orden determinista: primero el último evento usado y, si no hay ninguno, el más reciente.
- Si tiene varias membresías, la web muestra un selector de evento.
- Puede cambiar de evento desde el sidebar.

El login sigue identificando a la persona y el selector elige la membresía, como ya establece el [plan condicionado](../04-desarrollo/plan-web/04-condicionadas.md). Toda acción usa el evento seleccionado ([RN-02](../01-producto/reglas-de-negocio.md)).

### 2. Ciclo del evento

- **Cerrado:** visible y de solo lectura para todos. Se rechazan las escrituras de participantes y moderadores. Un administrador del evento puede reabrirlo. Esta decisión completa la sección «Estados y transiciones» de las reglas de negocio, que no definía la reapertura.
- **Archivado:** oculto del selector de eventos y visible para los administradores.

La guarda de solo lectura debe aplicarse de forma central en la API.

### 3. Moderación mínima para MUN ESEN

- **Ocultar sin borrar:** el contenido deja de mostrarse, puede restaurarse y la acción queda auditada. Exige motivo, como indica [RN-18](../01-producto/reglas-de-negocio.md). Corresponde al concepto de `OCULTO_MODERACION` del vocabulario de contenido; el mapeo aprobado de estados sigue pendiente.
- **Consulta de auditoría, con alcance por rol (decidido el 21 de noviembre de 2026):** el registro completo queda para Admin técnico (`ADMIN_TECH`), de acuerdo con REQ-24 y la matriz; Admin MUN (`ADMIN_MUN`) ve una vista acotada a su evento con lo necesario para el cuidado general (acciones de moderación, suspensiones, reactivaciones y denegaciones de su evento), sin lo técnico ni lo de otros eventos. La matriz de reglas de negocio y REQ-24 se actualizan al implementar.
- **Suspensión que corta la sesión activa y Realtime:** al suspender una membresía, sus sesiones abiertas y sus suscripciones Realtime pierden acceso. Realtime sigue siendo el único canal directo del navegador ([ADR-002](ADR-002-api-como-frontera-de-datos.md)), así que la revocación debe alcanzarlo. Desarrolla [RN-06](../01-producto/reglas-de-negocio.md), cuyo efecto aún no está verificado.

Esta decisión no cambia quién puede ejecutar cada acción, salvo en lo indicado para la consulta de auditoría.

## Pendiente

Este ADR no decide:

- **Expulsión** de participantes y **moderación de DM** (B15).
- **Colisión de códigos de ingreso** (B07), que sigue pendiente de confirmar con MUN ESEN.
- **Criterio de «más reciente»** en el orden de selección y dónde se guarda el último evento usado. Se concretan al implementar W07.
- **Borrador del evento** y **borrado de comités**.
- **Escrituras sobre un evento archivado.**
- **Estado de desactivación.** Las reglas de negocio mencionan un estado para desactivar que no se definió. Hay que confirmar si el archivado lo cubre.

## Alternativas descartadas

No se registraron alternativas al tomar estas decisiones y este ADR no las reconstruye.

## Consecuencias

- W07 puede implementarse con el orden y el selector descritos. La colisión de códigos (B07) no bloquea esa parte.
- Al implementar, hay que actualizar primero los documentos especializados y después la matriz de trazabilidad, según [AGENTS.md](../../AGENTS.md): las reglas de negocio (estados del evento, moderación y matriz de permisos) y [requerimientos](../01-producto/requerimientos.md) (REQ-01, REQ-21 y REQ-24).
- Ocultar sin borrar y la consulta de auditoría requieren diseño de datos y de API que este ADR no fija.
- La revocación de Realtime depende de verificar los pendientes Q01 y Q02 de la [sección 4 de pendientes](../PENDIENTES.md#4-api-base-de-datos-y-seguridad).

## Evidencia

Decisiones de producto tomadas el 21 de noviembre de 2026. Se revisaron [pendientes](../PENDIENTES.md), [reglas de negocio](../01-producto/reglas-de-negocio.md) (estados del evento, RN-02, RN-06, RN-18, RN-20 y matriz de permisos), [requerimientos](../01-producto/requerimientos.md) (REQ-01, REQ-21 y REQ-24) y el [plan condicionado](../04-desarrollo/plan-web/04-condicionadas.md) de W07. No se revisó código.
