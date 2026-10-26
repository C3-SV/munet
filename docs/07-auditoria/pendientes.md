# Pendientes y decisiones abiertas

Los ítems requieren decisión, evidencia externa o implementación futura. No son cambios ejecutados por esta auditoría.

## Prioridad crítica

### P-01 — Modelo de autorización administrativa

Definir superadministrador global frente a administración por evento; separar capacidad de crear un evento de administrar uno existente. Alinear frontend y backend.

### P-02 — Esquema y seguridad de datos

Versionar DDL, migraciones, enums, índices, constraints, triggers, RLS y Storage. Confirmar aislamiento con pruebas negativas.

### P-03 — Datos sensibles en logs

Los logs de autenticación del frontend fueron retirados. Falta definir una política de logging y revisar los registros del backend.

### P-04 — Auditoría confiable

Decidir si acciones críticas deben fallar cuando no puede registrarse la auditoría; definir consulta, retención y acceso.

## Producto y reglas

- ¿Quién puede supervisar DM y bajo qué causa/consentimiento?
- ¿Se puede reabrir una encuesta cerrada?
- ¿Cómo se deduplican reportes y qué estados tienen?
- ¿Cómo se recupera una cuenta o contraseña?
- ¿Qué implica suspender una cuenta en sesiones, contenido y chat?
- ¿Puede desactivarse un evento y cómo difiere de `CLOSED`?
- ¿Cuál es el alcance final del panel administrativo?
- ¿Reportes y notificaciones siguen aprobados o solo postergados?
- ¿“código de participante” identifica login globalmente o requiere evento?
- Resolver contradicciones históricas sobre adjuntos y notificaciones.

## Panel administrativo

El roadmap reciente se conserva como **propuesta**, no como compromiso completado:

| Tramo | Intención registrada | Estado observado |
|---|---|---|
| Sprint 0 | Base visual admin y protección de endpoints | Implementado parcialmente |
| Sprint 1 | UI/backend de eventos y comités; muro automático | Parcial; listado/configuración de eventos y listado/alta/edición de comités; automatismo de muro no demostrado |
| Sprint 2 | Participantes, CSV y restablecimiento | No implementado |
| Sprint 3 | Asignaciones, suspensión, moderadores y archivos | No implementado |
| Sprint 4 | Moderación, fijado, supervisión y bloqueo de conversación | No implementado |
| Cierre | Pruebas, auditoría con UUID, retirar logs, alinear DB y rate limits | No implementado o no demostrado |

Participantes, asignaciones y moderación existen como marcadores; queda revisar accesibilidad y los flujos de esas secciones.

## Calidad técnica

- Incorporar API a build/lint/typecheck/test.
- Contratos compartidos u OpenAPI y validación de schemas.
- Transacciones e idempotencia en altas compuestas.
- Paginación de feeds, participantes, conversaciones y mensajes.
- Rate limiting, request ID, métricas y alertas.
- Pruebas unitarias, integración, autorización y E2E.
- Alinear nombres/enum de borrado y unicidad de conversaciones/votos.

## Operaciones y cumplimiento

- Ambientes, dominios y responsables de despliegue.
- CI/CD, rollback y health checks.
- Backups, RTO/RPO, retención y borrado de datos.
- Política de privacidad y tratamiento de perfiles/mensajes.
- Navegadores, rendimiento (las cifras históricas 250/300 y 500/800 son contradictorias) y accesibilidad.
