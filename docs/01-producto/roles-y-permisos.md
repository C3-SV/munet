# Roles y permisos

## Modelo conceptual

Los permisos pertenecen a la membresía en un evento. Los documentos históricos hablan de participante/delegado, moderación/mesa y administración. No existe en el repositorio un catálogo canónico versionado de roles.

## Comportamiento implementado

`apps/api/src/utils/rbac.utils.ts` y el frontend consideran administrativo cualquier rol cuyo texto normalizado contenga `ADMIN`, `COORDINADOR` u `ORGANIZADOR`. Esta heurística puede aceptar nombres no previstos y debe tratarse como deuda, no como definición normativa.

| Capacidad | Participante activo | Rol administrativo detectado | Estado |
|---|---:|---:|---|
| Acceder al evento | Sí, con membresía | Sí | Implementado parcialmente |
| Leer muros autorizados | Sí | Sí | Implementado parcialmente |
| Publicar en muro general/comité | Según banderas y contexto | Sí | Implementado parcialmente |
| Publicar/comentar anuncios | No | Sí | Implementado |
| Eliminar contenido propio | Sí | Sí | Implementado |
| Eliminar contenido ajeno | No | Sí | Implementado |
| Editar perfil propio | Sí | Sí | Implementado |
| Editar perfil ajeno | No | Sí, salvo objetivo admin ajeno | Implementado parcialmente |
| Mensaje directo | Sí, mismo evento | Sí, mismo evento | Implementado |
| Crear eventos/comités/membresías/cuentas | No | Sí, con rol admin en cualquier evento | Divergente |
| Supervisar mensajes, sancionar, gestionar reportes | No | No módulo completo | No implementado |

## Dos controles administrativos distintos

- **Frontend:** `apps/web/app/(admin)/layout.tsx` exige que la membresía actualmente seleccionada sea administrativa.
- **Backend:** `requireAdmin` en `apps/api/src/middleware/auth.middleware.ts` acepta cualquier membresía administrativa activa del usuario.

Por ello la UI puede negar una vista que la API aceptaría, y un administrador de un evento podría enviar altas dirigidas a otro evento. El backend debe considerarse la evidencia de autorización efectiva.

## Controles que no deben asumirse

- No hay prueba local de políticas RLS.
- `requireEventMembership` y `requireRole` existen, pero las rutas no los montan directamente; la autorización fina está dispersa en controladores/servicios.
- El estado `ACTIVE` de una membresía sí se filtra durante la construcción del contexto, pero no sustituye comprobaciones del evento objetivo.
- No se verificó un rol exclusivo de superadministrador global.

Antes de añadir o cambiar permisos, resolver [P-01](../07-auditoria/pendientes.md#p-01-modelo-de-autorización-administrativa) y actualizar esta matriz.
