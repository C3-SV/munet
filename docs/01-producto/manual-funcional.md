# Manual funcional de MUNET para MUN ESEN

**Revisión del 18 de noviembre de 2026** · Commit de `main` `a76cb837d428c9c450824b83a88208dfbffab338`

## 1. Qué es MUNET y quién lo usa

MUNET reúne el acceso de delegados, la organización de comités y la comunicación de un Modelo de Naciones Unidas. Una misma persona puede tener acceso a varios eventos. En cada uno, su membresía determina qué puede hacer, qué comité tiene asignado y qué muros puede usar.

| Rol operativo | Responsabilidades y alcance |
|---|---|
| Participante o delegado | Activa su cuenta, ingresa al evento, consulta muros, publica donde se le permite y usa perfiles y chat. |
| Moderador o mesa | Puede figurar como moderador. Su rol por sí solo no habilita herramientas especiales ni acceso a otros comités. |
| Administrador, coordinador u organizador | Configura los eventos donde tiene permiso, administra comités y cuentas, publica anuncios y retira contenido desde los muros. |

En este manual, **implementado** significa visible en el código. **Parcial** indica que falta una parte, como la pantalla web. **Pendiente** indica que falta el recorrido. **No verificado** indica que el resultado completo debe comprobarse con Supabase en un entorno aislado. [Funcionalidades y estado](funcionalidades.md) · [Roles y permisos](roles-y-permisos.md)

## 2. Preparar y administrar el evento

### Crear y configurar un evento — parcial, alta no verificada

1. Entra con una membresía administrativa. Abre **Eventos y Comités → Nuevo evento**.
2. Completa el nombre y el identificador corto del evento, llamado *slug*. Añade descripción y fechas si corresponde. Pulsa **Crear evento**.
3. Si el alta se completa, se abre la ficha. Desde ella puedes cambiar esos datos y guardar un estado, como **Activo**, **Cerrado** o **Archivado**.
4. Vuelve a **Cambiar evento** si necesitas trabajar en el evento recién creado. Comprueba que tienes acceso y que aparecen los muros general y de anuncios antes de incorporar participantes.

El alta parte en estado activo e intenta dar permisos de administración a quien lo creó. El rol usado puede ser incompatible con el esquema de referencia. Tampoco está confirmado que se aprovisionen los muros iniciales. Guardar **Cerrado** no impide todas las escrituras. [Flujos de eventos y comités](../03-referencia/flujos-funcionales.md#eventos-y-comités)

### Crear y editar comités — parcial

1. Desde el listado de eventos, abre **Comités** del evento correcto y elige **Nuevo comité**.
2. Indica nombre, código y, si aplica, descripción y orden. Al guardar, la API crea el comité y su muro. Por ejemplo, un comité con código `CS` puede tener un muro en `/feed/comite-cs`.
3. Usa **Editar** en el listado para cambiar sus datos. Al cambiar el nombre del comité, la API intenta cambiar también el nombre de su muro.

El alta de comité se rechaza en eventos cerrados o archivados. La pantalla de comités ofrece alta, edición y «Eliminar» (borrado lógico del comité y su muro; los participantes quedan sin comité). Desde la página del evento, «Cerrar evento» y «Reabrir evento» cambian su estado con confirmación. [Referencia administrativa](../03-referencia/api.md#administración)

### Incorporar participantes individualmente — implementado

1. Abre **Participantes** del evento y pulsa **Nuevo participante**.
2. Indica el código de participante, el rol y el nombre y apellido. Si corresponde, elige comité y completa delegación e institución. Para un delegado, el valor que figura en el esquema es `PARTICIPANT`. El campo de rol de la pantalla es de texto libre.
3. Pulsa **Crear participante**. Si se completa, se crea la cuenta pendiente de activación y aparece la contraseña inicial. Guarda y entrega en privado el código de ingreso y la contraseña a la persona.
4. Comprueba que la cuenta está en el listado y que tiene el comité previsto. Usa códigos distintos para personas diferentes, incluso entre eventos. El inicio de sesión solicita el código sin pedir un evento.

La contraseña inicial solo se muestra al emitirla. El código de ingreso figura como dato de la cuenta. El **código de delegación**, por ejemplo `#042`, es otro dato y aparece en el perfil si fue asignado. Depende de una función de base sin verificación de extremo a extremo. [Modelos y códigos](../03-referencia/modelos-de-datos.md#dos-códigos-con-usos-distintos)

### Incorporar participantes por CSV — parcial

1. Prepara un CSV con `nombre,apellido,codigo_participante,comite,delegacion,rol,alias`. Los primeros tres encabezados son obligatorios. Usa el nombre o código de un comité vigente del evento. Un rol vacío se interpreta como participante.
2. Pide a desarrollo que ejecute la previsualización por API con una sesión administrativa del evento. Revisa filas válidas, errores y duplicados antes de autorizar el alta.
3. Desarrollo confirma solo las filas válidas por API, hasta 50 por solicitud. Revisa altas y fallos y guarda las contraseñas devueltas para distribuirlas en privado. Si se interrumpe el proceso, comprueba qué cuentas quedaron creadas antes de reintentar.

El panel carece de carga de archivos, previsualización, confirmación y descarga de resultados. La API admite hasta 1.000 filas de datos por previsualización. [Contrato CSV](../03-referencia/api.md#contrato-csv)

### Asignar y administrar participantes durante el evento — parcial

1. Abre **Participantes**. Aplica filtros por comité, rol o estado y abre la ficha de la persona.
2. Para mover a alguien, selecciona el nuevo **Comité** y pulsa **Guardar cambios**. También puedes dejarlo **Sin comité** o editar datos de delegación, institución, rol y perfil. El comité debe pertenecer al evento y estar vigente.
3. Pide al delegado que vuelva a cargar el sitio tras el cambio. Debe comprobar que puede abrir su nuevo muro y que ya no tiene acceso al anterior. La autorización de la API se vuelve a calcular en cada solicitud.
4. Para suspender temporalmente, usa **Suspender cuenta** e indica el motivo. **Reactivar cuenta** también pide motivo. Suspender una cuenta que aún no se activó puede dejarla en un estado que impida completar el primer acceso al reactivarla.
5. Usa **Restablecer contraseña** si se perdió la credencial. Para una cuenta pendiente, genera otra contraseña de activación. Para una activa, reemplaza la contraseña de inicio de sesión si ya está vinculada a Auth. La nueva credencial aparece una vez. La ficha exige reactivar una cuenta suspendida antes de restablecerla.

Las asignaciones se hacen una por una. La pantalla general de **Asignaciones** todavía no ofrece operaciones. La búsqueda por texto existe en API y el listado web ofrece filtros. [Flujos de participantes](../03-referencia/flujos-funcionales.md#alta-asignación-y-mantenimiento-de-participantes)

## 3. Entrar y participar

### Activar una cuenta e ingresar — implementado

1. Abre el sitio y selecciona **Activar Cuenta**. Introduce el código que te entregó la organización y selecciona el evento si corresponde.
2. Introduce la contraseña inicial y elige y confirma una nueva. Al completarse, la cuenta queda activa.
3. Pulsa **Iniciar sesión** e ingresa el código de participante en **Código de delegado** y la contraseña nueva. Si aparece el selector, elige el evento. Una sola membresía de participante puede abrir directamente el muro general.
4. Usa **Cambiar evento** desde la navegación si necesitas elegir otra membresía disponible. Si perdiste la contraseña, solicita un restablecimiento a administración.

### Consultar y editar perfiles — implementado

1. Abre tu perfil y pulsa **Editar mi perfil**. Cambia el nombre para mostrar, alias o biografía. Deja el alias vacío si quieres quitarlo. Para cambiar el avatar, elige un JPEG, PNG o WebP de hasta 5 MB y pulsa **Subir foto**.
2. Pulsa **Guardar perfil**. Tu perfil muestra la información permitida del evento y el código `#` si existe. Para consultar otro perfil, abre la tarjeta de un autor desde el muro y elige **Ver perfil**.
3. Si eres administrador del mismo evento y la pantalla lo permite, usa **Editar perfil** en el perfil de la otra persona. La edición de otros administradores tiene restricciones. Los delegados no pueden cambiar sus datos institucionales desde el perfil.

### Comunicarse en los muros — implementado

1. Elige el muro general, el de **Avisos** o el de tu comité en la navegación. Los delegados acceden a su comité y a los muros comunes. Administración tiene acceso a los comités del evento.
2. En un muro habilitado para publicar, escribe y pulsa **Publicar**, o elige **Encuesta**, añade entre 2 y 10 opciones y pulsa **Publicar encuesta**. Solo administración puede publicar y comentar en anuncios.
3. En **Comentarios** puedes añadir un comentario o responder a uno de primer nivel. Para votar, elige una opción. Puedes cambiarla mientras la encuesta esté abierta. El autor puede cerrar la encuesta.
4. El autor puede retirar su contenido desde el muro. Administración puede retirar contenido ajeno. El borrado es lógico y puede aparecer un marcador. Fijar publicaciones y adjuntar archivos siguen pendientes.

### Enviar un mensaje directo — implementado

1. Abre **Mensajes Directos** y busca a una persona activa del mismo evento. También puedes abrir el chat desde su perfil si está disponible.
2. Selecciona a la persona. MUNET abre la conversación individual existente o crea una. Escribe el mensaje y envíalo.
3. Regresa a la conversación para ver el historial. Puedes borrar tus propios mensajes. El chat actual admite texto individual y carece de grupos, adjuntos y bloqueo. La actualización entre sesiones depende de Realtime y queda por verificar en un entorno aislado.

### Moderar durante el evento — parcial

Desde un muro del evento, un administrador puede usar el control de eliminación de un post o un comentario. Para actuar sobre una cuenta, abre su ficha de **Participantes** y registra el motivo de suspensión o reactivación. **Moderación** aún es una pantalla de referencia. Reportes, cola de revisión, expulsión, supervisión de mensajes y auditoría consultable están pendientes.

## 4. Referencia breve para desarrollo

| Recorrido web | API y componentes principales | Dependencias funcionales |
|---|---|---|
| `/login`, `/select-event` | Cliente `lib/api/auth.ts`, store de sesión y `/auth` | Alta previa, Auth y membresía activa. |
| `/admin/events`, `/admin/events/[eventId]` y páginas de comités | Cliente `lib/api/admin.ts` y rutas `/admin/events`, `/admin/committees` | Permiso administrativo, rol válido y aprovisionamiento de muros. |
| `/admin/events/[eventId]/participants` y fichas | Cliente `lib/api/participants.ts` y rutas `/admin/create-account` y `/admin/participants` | Servicio de alta compartido con CSV, comités del evento y migraciones 001/002 para alias y código. |
| `/feed/[muro]`, `/profile`, `/profile/[membershipId]`, `/chat`, `/chat/[id]` | Componentes de feed y chat, clientes HTTP de dominio y rutas `/events`, `/posts`, `/profiles` y `/dm` | Membresía y permisos, muros existentes, Storage para avatar y Realtime para refresco. |

[Arquitectura frontend](../02-arquitectura/frontend.md) · [API completa](../03-referencia/api.md) · [Pruebas y validación](../04-desarrollo/pruebas-y-validacion.md)

## 5. Funcionalidades pendientes

| Funcionalidad | Trabajo necesario |
|---|---|
| Alta y cierre operativo del evento | Alinear el rol del creador con la base, aprovisionar los muros iniciales y aplicar solo lectura al cerrar. |
| Credenciales y código de delegación | Resolver códigos de ingreso repetidos, verificar generación del `#` y corregir el caso de suspensión antes de activar. |
| Importación y asignaciones | Conectar CSV al panel con revisión y resultados por fila. Definir si se requieren reasignaciones masivas. |
| Moderación | Completar la pantalla y acordar permisos y acciones de mesa y administración. |
| Comunicación y seguimiento | Definir alcance de adjuntos, fijado, reportes, notificaciones y consulta de auditoría. Validar primero muros y chat en un evento de ensayo. |

[Orden propuesto de implementación y criterios](../PENDIENTES.md)
