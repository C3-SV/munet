# Decisiones del Sprint 1 (tarea S1-03)

Fuente: reunión de la junta del C3 con la junta de MUN ESEN y las respuestas de la coordinadora del proyecto.

## Decisiones tomadas

| # | Decisión | Detalle |
|---|---|---|
| 1 | Muros de comité privados | Un delegado solo ve el muro general, el de avisos y el de su comité. No hay comités secretos |
| 2 | Búsqueda de delegados de otros comités | Los delegados pueden buscar a delegados de cualquier comité del evento. Eso no da acceso a los muros de esos comités |
| 3 | El alias lo elige el delegado | Es un dato aparte del nombre: el delegado se ve con su nombre completo **y** su alias. El admin puede corregirlo |
| 4 | El código `#` de delegación se genera al registrar al usuario | No lo elige el delegado ni lo puede editar |
| 5 | Sin comité de crisis | Esos delegados no usan computadoras. Verificado: no existe ese comité en la base (solo Asamblea General, Justicia y Seguridad) |

## Supuestos adoptados mientras no se indique lo contrario

| Tema | Supuesto | Dónde se aplicó |
|---|---|---|
| ¿El alias es único por evento? | No: se puede repetir (su función es distinguir nombres iguales) | Columna `profiles.alias` sin restricción de unicidad |
| Formato del código `#` | `#` seguido de un número con ceros (por ejemplo `#042`), por orden de registro | Columna `event_memberships.delegation_code varchar(20)` con unicidad por evento; la generación automática es la tarea S2-03 |

## Pendientes de decidir (Sprint 2)

- Entrega de credenciales a los delegados y recuperación de contraseña.
- Permisos del rol moderador.
- Qué implica suspender una cuenta.
- Adjuntos en mensajes directos.
- Supervisión de mensajes directos.
