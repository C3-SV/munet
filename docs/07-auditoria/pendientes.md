# Pendientes y decisiones abiertas

Orden propuesto para el siguiente incremento funcional de MUNET. Las decisiones de negocio siguen abiertas donde se indican.

El [plan del equipo web](../04-desarrollo/plan-web/README.md) detalla la secuencia para participantes e integraciones y las entregas que requiere del equipo admin.

| Prioridad | Trabajo | Resultado verificable |
|---|---|---|
| 1 | Preparar una base aislada reproducible y completar el alta de evento. Alinear el rol automático con el enum vigente y garantizar los muros general y anuncios junto con el acceso del creador. | Un organizador crea un evento, vuelve a seleccionarlo y ve los muros. Un segundo evento sirve para comprobar límites de acceso. |
| 2 | Completar el alta, activación y mantenimiento de cuentas. Resolver la unicidad o desambiguación del código de ingreso entre eventos, alinear los roles de los formularios y manejar la reactivación de una cuenta que nunca se activó. | El organizador entrega credenciales. El delegado activa, inicia sesión y recupera acceso con ayuda de administración. Las colisiones tienen una resolución clara. |
| 3 | Verificar y completar código de delegación, CSV y asignaciones. Comprobar migraciones 001/002 en pruebas, habilitar una recuperación de códigos faltantes y conectar plantilla, previsualización, confirmación y resultados al panel. Definir si se necesita asignación masiva. | Un lote con filas válidas y fallidas devuelve resultados y credenciales de las altas. Cada delegado ve su código y su comité. |
| 4 | Completar el ciclo del evento. Definir borrador, cierre, archivo y reapertura. Aplicar la regla de solo lectura de manera uniforme y decidir si el borrado de comités se ofrece en el panel. | El evento cerrado sigue visible a quien corresponda y se rechazan las escrituras definidas por la regla. |
| 5 | Validar el recorrido de un evento de ensayo. Probar delegados en comités distintos, anuncios, votos, comentarios, perfiles, chat y actualización entre sesiones. | El equipo ejecuta el [recorrido de validación](../04-desarrollo/pruebas-y-validacion.md#recorrido-en-un-entorno-aislado) con datos ficticios y registra resultados. |
| 6 | Definir el mínimo de moderación para MUN ESEN. Completar la pantalla y acordar responsabilidades de mesa, motivos y acciones sobre contenido y cuentas. | El equipo identifica y resuelve un caso de moderación con los permisos y la trazabilidad acordados. |

## Decisiones de producto

- Definir recuperación autónoma y verificación de identidad, así como efectos de suspensión sobre sesiones y Realtime.
- Acordar la necesidad de reportes, notificaciones, adjuntos, fijado, reapertura de encuestas y exportación masiva.
- Acordar si se requieren supervisión de DM, bloqueo, expulsión y consulta de auditoría. Definir permisos, motivo, retención y privacidad antes de implementarlos.
### P-01 Modelo de autorización administrativa

La administración por evento se decidió el 29 de octubre de 2026 en [ADR-005](../06-decisiones/ADR-005-autorizacion-administrativa-por-evento.md). Un rol transversal, si se pide, requerirá una decisión nueva.

## Trabajo técnico y operativo posterior

Completitud del DDL, políticas RLS y Storage, transacciones e idempotencia, auditoría y logging, paginación, contratos compartidos, cobertura de CI, accesibilidad, rendimiento, observabilidad, respaldos y preparación de producción. Los objetivos históricos se conservan en [requerimientos](../01-producto/requerimientos.md).
