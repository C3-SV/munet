# Criterios de aceptación funcional

Estos escenarios validan los requerimientos de [02-requerimientos.md](02-requerimientos.md). Cada criterio debe probarse con datos de al menos dos eventos, dos comités y cuentas con roles y estados diferentes cuando corresponda. «Rechazar» implica no cambiar datos, mostrar una respuesta comprensible y registrar el intento si es una acción sensible. No se infiere que estas pruebas ya se hayan ejecutado.

## Eventos y membresías

### CA-01 · REQ-01 · Ciclo del evento

- Dado un Admin MUN autorizado, al crear un evento con nombre y fechas válidas, el evento queda en BORRADOR con autor y hora auditados; fechas inconsistentes se rechazan.
- Al activar el evento, los miembros habilitados pueden operar según sus permisos; al cerrarlo, pueden consultar lo que les corresponde, pero no crear, editar, votar, enviar DM ni moderar contenido del evento.
- Un usuario sin permiso de administración no puede crear ni cambiar el evento.

### CA-02 · REQ-02 · Estructura

- Al configurar un evento se crea o consulta un único muro general, uno de anuncios y un muro por cada comité registrado.
- No se puede asociar a un muro un comité de otro evento ni crear un post sin muro válido.

### CA-03 · REQ-03 · Aislamiento

- Un miembro del evento A no obtiene posts, comentarios, DMs, perfiles restringidos, adjuntos, reportes ni notificaciones del evento B aunque modifique URL, identificadores o peticiones.
- Una búsqueda o lectura administrativa de un evento usa el contexto seleccionado y no mezcla resultados del otro.
- Los intentos bloqueados quedan registrados sin exponer contenido ajeno.

### CA-04 · REQ-04 · Roles y contexto

- El cambio de rol de un miembro afecta solo a la membresía del evento objetivo y deja actor, rol anterior, rol nuevo y hora en auditoría.
- Un moderador o Admin MUN con dos eventos debe elegir uno antes de una acción administrativa; cambiar el contexto no traslada permisos al otro.
- Un participante no puede agregarse como participante de un segundo evento mientras conserve la primera membresía de ese tipo.

## Acceso y perfiles

### CA-05 · REQ-05 · Habilitación

- Una alta válida crea una cuenta PENDIENTE_ACTIVACION ligada al evento y comité, con código único dentro del evento y auditoría de quién la habilitó.
- Códigos duplicados dentro del evento o con formato inválido se rechazan antes de crear la cuenta.
- Cambiar o reasignar un código ya emitido está prohibido.

### CA-06 · REQ-06 · Activación

- Con código y contraseña temporal correctos, el participante establece una contraseña nueva, pasa a ACTIVA y se audita la fecha de activación.
- La contraseña de un solo uso no funciona por segunda vez; una credencial inválida no activa la cuenta.

### CA-07 · REQ-07 · Sesión

- Una cuenta ACTIVA con credenciales válidas entra al evento correcto; cada intento exitoso o fallido queda registrado.
- PENDIENTE_ACTIVACION, BLOQUEADA_SEGURIDAD, SUSPENDIDA y EXPULSADA no obtienen sesión operativa.
- Después de cerrar sesión, la credencial de sesión revocada no permite leer ni escribir recursos protegidos.

### CA-08 · REQ-08 · Bloqueo y suspensión

- Al alcanzar el umbral configurado de fallos, la cuenta pasa a BLOQUEADA_SEGURIDAD y deja de poder autenticarse; se audita la transición.
- Suspender o rehabilitar requiere autoridad, motivo, responsable y hora; una cuenta suspendida no publica ni envía DM con una sesión antigua.
- Un desbloqueo de seguridad no rehabilita una suspensión disciplinaria.

### CA-09 · REQ-09 · Recuperación

- El flujo «Olvidé mi contraseña» permite solicitar ayuda sin conceder acceso a quien solo conoce el código.
- Tras una verificación de identidad definida institucionalmente, la credencial nueva invalida la anterior y audita el cambio.
- Si el estado era BLOQUEADA_SEGURIDAD puede pasar a ACTIVA; si era SUSPENDIDA o EXPULSADA mantiene su estado.

### CA-10 · REQ-10 · Perfil

- El usuario ve campos permitidos de un miembro del mismo evento y puede modificar solo su nombre a mostrar, bio y foto.
- El participante no modifica comité, delegación, rol, código o estado por UI ni API.
- Una edición administrativa permitida registra actor, campos afectados, hora y evento.

## Foro y adjuntos

### CA-11 · REQ-11 · Muros

- Un participante ve el general, anuncios y su comité; no ve un muro de otro comité por enlace directo ni por consulta manipulada.
- Cada post recuperado conserva un único `wall_id` válido del mismo evento.

### CA-12 · REQ-12 · Publicación y anuncio

- Un participante activo publica contenido válido en general o su comité y lo ve tras confirmación de persistencia; no puede publicar en anuncios.
- Una etiqueta válida en general no restringe la audiencia global; una etiqueta de otro evento o inexistente se rechaza.
- Solo un rol coordinador autorizado publica un anuncio, con autor y hora visibles.

### CA-13 · REQ-13 · Retiro de post

- El autor o moderador autorizado retira el post; desaparece del feed y detalle para participantes sin marcador de eliminación.
- Un tercero sin permiso no puede retirarlo; la eliminación conserva la información y una auditoría accesible solo a roles autorizados.

### CA-14 · REQ-14 · Comentarios

- Solo quien puede ver el post agrega un comentario no vacío o responde a un comentario principal del mismo post.
- Una respuesta a un subcomentario se rechaza mientras rija el límite provisional de un nivel.
- Autor o moderación puede retirar un comentario; deja de mostrarse y queda auditable. Editarlo no se ofrece.

### CA-15 · REQ-15 · Encuestas

- Un participante crea una encuesta en un muro donde puede publicar; no la crea en anuncios ni en comité ajeno.
- Un usuario tiene un voto por encuesta; cambiar de opción mientras está abierta sustituye el voto anterior sin duplicarlo.
- El creador puede cerrar la encuesta y se audita; después del cierre no se aceptan votos ni cambios. La reapertura no se ofrece hasta definirla.

### CA-16 · REQ-16 · Adjuntos

- Un post acepta **una** imagen JPG/PNG de hasta 5 MB **o** un PDF de hasta 20 MB; rechaza otros tipos, tamaños superiores y un segundo adjunto.
- El archivo y su URL de descarga solo son accesibles para quien puede ver el post, incluso si conoce la ruta de almacenamiento.
- Retirar u ocultar un archivo deja el post disponible, oculta el archivo y conserva metadata y auditoría sin referencias huérfanas.

## Mensajería, reportes y avisos

### CA-17 · REQ-17 · Conversación

- Entre dos miembros activos del mismo evento se abre o reutiliza una conversación 1:1 que aparece en sus bandejas.
- No se crea conversación consigo mismo, con un tercer integrante o con un usuario de otro evento.
- Al volver a entrar, el historial persistido conserva el orden y la asociación al evento.

### CA-18 · REQ-18 · Mensaje

- Uno de los dos integrantes envía texto o enlace válido; el sistema confirma solo tras persistir autor, hora y conversación, y el receptor lo ve en su historial.
- Un tercero no lee ni inserta mensajes aun con el identificador de conversación.
- Solo el autor elimina su mensaje; se oculta a ambos participantes, queda trazado y no admite edición ni adjuntos.

### CA-19 · REQ-19 · Supervisión

- Un Admin MUN autorizado del evento escribe un motivo antes de abrir un DM; el sistema registra actor, conversación, evento, hora y motivo **antes** de mostrar el contenido.
- Sin permiso, motivo o registro de auditoría disponible, no se abre la conversación; la vista de supervisión no permite editar o borrar.
- Una persona administradora de otro evento no obtiene el DM.

### CA-20 · REQ-20 · Reporte

- Un miembro reporta un post visible indicando motivo; quedan reportante, objetivo, evento y hora, con estado ABIERTO.
- No se acepta un segundo reporte suyo sobre el mismo contenido bajo la política provisional; un contenido invisible o de otro evento no puede reportarse.
- El personal autorizado lo mueve a EN_REVISION y luego RESUELTO o DESCARTADO, registrando responsable y resolución.

### CA-21 · REQ-21 · Moderación y sanción

- El moderador autorizado oculta contenido o retira adjunto con motivo; el contenido ya no es accesible a participantes y la acción queda auditada.
- Una suspensión o expulsión bloquea de inmediato el acceso, incluso con sesión previa, y registra actor, motivo, objetivo y hora.
- Un rol sin permiso no modifica estados de reportes, contenidos ni cuentas.

### CA-22 · REQ-22 · Avisos internos

- Un nuevo DM o anuncio autorizado crea un aviso persistente para los destinatarios del mismo evento y actualiza el contador dentro de la aplicación.
- Si falla la entrega en tiempo real, el aviso sigue disponible en el historial tras recargar; no se duplica por reintento.
- No se envían correo, SMS ni push externos por estos eventos.

## Operación y auditoría

### CA-23 · REQ-23 · CSV

- Antes de confirmar se muestran columnas esperadas, total de filas válidas, inválidas y duplicadas, con error por fila; ninguna cuenta se crea durante la previsualización.
- Una fila sin comité existente o con código repetido en el archivo o evento no se importa; al confirmar se crean solo las filas válidas y se asigna el comité correcto.
- Cancelar no crea cuentas. El resultado final y los errores de persistencia se informan con conteos y un registro auditable del lote.

### CA-24 · REQ-24 · Auditoría

- Habilitaciones, activaciones, accesos, bloqueos, cambios de rol/estado, publicaciones retiradas, moderación, sanciones, importaciones, cambios de evento y supervisión de DM dejan actor, evento, objetivo, fecha y motivo cuando aplica.
- Solo Admin técnico consulta el registro completo bajo la regla detallada vigente; un rol no autorizado recibe denegación auditada.
- Una falla al auditar una acción que exige rastro previo, en especial la supervisión de DM, impide completar esa acción.

## Pruebas no funcionales

Los tiempos, disponibilidad, recuperación y trazabilidad medibles se especifican en [05-arquitectura-y-calidad.md](05-arquitectura-y-calidad.md). El umbral de DM requiere resolver D-02 antes de aprobar una prueba de rendimiento definitiva.
