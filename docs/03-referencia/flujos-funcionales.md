# Flujos funcionales

Para los pasos en pantalla, consulta el [manual funcional](../01-producto/manual-funcional.md). Los contratos HTTP están en la [referencia de API](api.md).

## Activación, sesión y selección

La búsqueda por código devuelve membresías pendientes de eventos sin borrado lógico. La activación recibe evento, código, temporal y contraseña nueva. Crea la identidad en Supabase Auth, vincula el usuario interno, activa la membresía y limpia su hash inicial. Devuelve una confirmación. El login posterior entrega token y contexto con membresías activas.

El login usa solo el código y la contraseña. Si el código activo corresponde a diferentes usuarios, devuelve conflicto. Al entrar, una sola membresía no administrativa puede ir directo al feed. Con varias membresías o con una administrativa, el selector permite elegir el evento cuando todavía no hay selección. La selección se conserva localmente.

## Eventos y comités

`POST /admin/events` inserta un evento `ACTIVE` con `is_read_only=false` e intenta insertar la membresía administrativa del creador. Si falla, intenta marcar el evento como eliminado. No crea muros general y de anuncios en el controlador. Véase [compatibilidad con el esquema](../07-auditoria/discrepancias.md#d-05--compatibilidad-entre-api-y-esquema).

La configuración guarda nombre, slug, descripción, fechas y estado (`ACTIVE`, `CLOSED`, `ARCHIVED`). El alta de comité rechaza eventos cerrados o archivados, valida nombre y código en el evento y crea el muro de comité. Un fallo al crear el muro activa una compensación. La edición sincroniza el nombre del muro si cambia el del comité. La API de borrado marca el comité como eliminado e intenta lo mismo con el muro. Un fallo de esta segunda escritura queda en el log.

## Alta, asignación y mantenimiento de participantes

El alta individual y el CSV comparten el servicio que crea usuario interno, membresía `PENDING_ACTIVATION` y perfil. La contraseña inicial se genera en servidor y solo se devuelve al crear la cuenta. Después se intenta asignar el [código de delegación](modelos-de-datos.md#dos-códigos-con-usos-distintos).

La ficha web guarda cambios de rol, comité, delegación, institución y perfil con el PATCH general. El endpoint dedicado de comité acepta un identificador del mismo evento o `null` y un motivo opcional. Ambos rechazan comités archivados. El backend relee membresías en las solicitudes posteriores. Comprueba el nuevo acceso al muro tras recargar la vista.

Suspender y reactivar exigen motivo. Reactivar establece `ACTIVE`, incluso si la cuenta nunca completó activación. Para una cuenta pendiente, restablecer reemplaza el secreto de activación. En una cuenta activa con identidad vinculada, reemplaza la contraseña en Supabase Auth. La cuenta suspendida debe reactivarse antes del restablecimiento.

## Importación CSV

1. El consumidor envía el texto del archivo con el evento a **preview**. Se devuelven filas válidas, inválidas y duplicadas. Este paso no escribe.
2. El consumidor envía las filas válidas normalizadas a **confirm**, en lotes de hasta 50. El servidor vuelve a validar comité y códigos del evento.
3. El resultado incluye altas, fallos por fila y credenciales iniciales de las altas. Un fallo individual no detiene el lote. El backend intenta registrar las altas y el resumen en auditoría.
4. Antes de reintentar ante un error, consulta las cuentas creadas. Los lotes pueden quedar parcialmente aplicados y las contraseñas ya emitidas requieren restablecimiento si se pierden.

La aplicación web todavía carece de interfaz para este recorrido.

## Perfiles, muros y chat

- **Perfil.** Con `x-event-id`, el backend devuelve el perfil propio o de una membresía del evento. El alias puede editarse o quitarse. El avatar se envía a la API como base64 y la API lo sube a Storage.
- **Muros.** El evento se selecciona con `x-event-id` y el muro mediante su slug. La API comprueba permisos de acceso y publicación. Una encuesta crea post, poll y opciones en varias escrituras. Se puede reemplazar el voto mientras siga abierta. Su autor puede cerrarla.
- **Comentarios.** Cada respuesta se vincula a un comentario raíz del mismo post. Los participantes pueden leer comentarios de anuncios. Para comentar allí se requiere administración.
- **Chat.** La búsqueda y creación limitan el interlocutor al evento y a membresías activas. La API crea o reutiliza una conversación individual y valida al integrante que lee o escribe. El autor puede borrar su mensaje lógicamente.
- **Actualización de vistas.** Feed, comentarios y chat usan suscripciones para volver a consultar la API. La entrega Realtime y Storage quedan por verificar con un entorno aislado.
