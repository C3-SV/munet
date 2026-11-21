# Funcionalidades y estado

Base de la clasificación: [revisión de main](../README.md). Para operar la plataforma, consulta el [manual funcional](manual-funcional.md).

| Área | Estado | Alcance observado |
|---|---|---|
| Activación e inicio de sesión | Implementado | Búsqueda de cuentas pendientes, activación con contraseña inicial y login por código. Recuperación autónoma pendiente. |
| Selección de evento | Implementado | Selección entre membresías activas, con entrada al panel o al feed según rol. |
| Administración de eventos | Parcial / no verificado | Listado acotado, alta y edición. El alta intenta crear una membresía con un rol ausente del esquema de referencia y no inserta los muros general y de anuncios. Cerrar no impone solo lectura. |
| Comités | Parcial | Listado, alta con muro y edición en web. El borrado lógico de comité y muro existe en API. |
| Administración de participantes | Implementado | Listado filtrado y paginado, alta individual, edición, suspensión, reactivación y restablecimiento. Búsqueda por texto (`q`) en API y panel, con acciones por fila. |
| Importación CSV | Implementado, no verificado E2E | API de previsualización y confirmación por lotes. Pantalla con plantilla descargable, revisión de filas y descarga de credenciales. |
| Asignaciones | Parcial | Alta, ficha y menú de cada fila permiten asignar, mover o quitar comité. API dedicada con motivo opcional. Pantalla general y cambios masivos pendientes. |
| Código de delegación | No verificado | El backend pide un código por evento a una función de la migración 002. Los perfiles lo muestran si existe. El alta puede completarse con aviso si falta el código. |
| Perfiles | Implementado | Perfil propio y de miembros del evento, alias, avatar y edición administrativa con restricciones. |
| Muros, publicaciones y encuestas | Implementado | Muros existentes del evento, publicaciones de texto o encuesta, voto reemplazable, cierre por autor y borrado lógico. La interfaz de adjuntos (elegir y validar un archivo) existe en el editor y en la tarjeta, pero el archivo no se guarda. Fijado y guardado de adjuntos pendientes. |
| Comentarios | Implementado | Comentarios, un nivel de respuesta y borrado lógico. En anuncios, escritura reservada a administración. |
| Mensajes directos | Implementado | Texto individual dentro del evento, historial y borrado lógico por el autor. Grupos, adjuntos y bloqueo ausentes. |
| Moderación | Parcial | Pantalla `/admin/events/:eventId/moderation` para administradores y moderadores: selector de muro con contadores, pestañas Visibles, Eliminados y Todos, fijar (máximo 3 por muro) y desfijar, y eliminación de posts y comentarios con motivo obligatorio. Rol `MODERATOR` asignable desde la ficha y el listado de participantes. Retiro desde los muros por administradores y suspensión desde la ficha. Falta la marca «Fijado» en el feed de participantes. Sin reportes ni sanciones. |
| Modo práctica | Implementado, salvo el entrenamiento de organizadores | Sandbox local de «Conoce MUNET» que corre solo en el navegador y no toca el servidor: contexto «Práctica» (entrada desde el menú lateral y el selector de evento), aviso fijo, reinicio, almacén local por usuario en IndexedDB y un simulador que aplica las reglas del participante: muro (publicaciones, encuestas, comentarios, adjuntos locales con límites), directorio, perfil y mensajes directos con respuestas preparadas. Lo que no está simulado responde «No disponible en modo práctica». Pendiente: reducir el evento de entrenamiento del servidor (entrega 3). Diseño y estado: [diseño del modo práctica](../04-desarrollo/diseno-sandbox-conoce-munet.md). |
| Reportes, notificaciones y consulta de auditoría | Pendiente | Realtime refresca vistas y el backend intenta registrar acciones. Faltan reportes y bandejas de notificaciones y auditoría. |

La [referencia de API](../03-referencia/api.md) señala qué rutas tienen cliente web. Los casos que requieren confirmación en un entorno aislado figuran en [discrepancias](../07-auditoria/discrepancias.md).
