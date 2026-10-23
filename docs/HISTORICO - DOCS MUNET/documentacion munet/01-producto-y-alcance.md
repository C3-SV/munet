# Producto y alcance de MUNET

## Propósito

MUNET es una plataforma web cerrada para MUN ESEN, el Modelo de las Naciones Unidas de la Escuela Superior de Economía y Negocios. Centraliza la comunicación oficial y la interacción académica durante los eventos: muros del evento y de comités, anuncios, comentarios, encuestas y mensajes directos entre dos personas. La organización habilita a los usuarios y supervisa el entorno con permisos y trazabilidad. Fuente: `Munet - IdeaProyecto.docx`; `Arquitectura MUNET.pdf`, pp. 4–11 y anexo 1.

## Resultados buscados

- Delegados y personal encuentran información del evento en un mismo lugar y conversan dentro del contexto autorizado.
- Cada comité dispone de un espacio propio; el muro general permite intercambio transversal sin exponer los muros privados de otros comités.
- El equipo coordinador difunde avisos oficiales, administra participantes y atiende reportes.
- MUN ESEN conserva evidencia de acciones críticas, especialmente accesos administrativos a mensajes privados, moderación y sanciones.
- La aplicación soporta varios eventos sin mezclar sus datos.

## Actores

| Actor | Necesidad y ámbito |
| --- | --- |
| Participante o delegado | Consultar muros y anuncios, publicar y comentar donde tenga permiso, crear y votar encuestas, enviar DM y reportar contenido. Pertenece a un evento y a un comité dentro de él. |
| Organizador o moderador | Operar y moderar contenido del evento asignado y publicar anuncios. Puede tener membresía en varios eventos. |
| Admin MUN | Configurar el evento, gestionar membresías y estados de cuenta, revisar reportes y aplicar sanciones. Puede administrar varios eventos, siempre en un contexto seleccionado. |
| Admin técnico | Operar la plataforma global y consultar la auditoría según permisos. Su acceso a DMs está pendiente de definición y no se presupone. |

## Capacidades previstas

1. Crear, activar y cerrar eventos; configurar comités y muros; aislar sus datos.
2. Habilitar usuarios mediante código de participante y contraseña de un solo uso, importar participantes con CSV y gestionar cuentas.
3. Mostrar y editar los campos de perfil permitidos.
4. Publicar en muro general o del comité y emitir anuncios oficiales; comentar y responder con un nivel de réplica.
5. Crear encuestas en muros autorizados, votar una vez por usuario y permitir cambiar el voto mientras estén abiertas.
6. Adjuntar a un post **una imagen o un PDF**, sujeto a formato, tamaño y permisos del muro.
7. Abrir conversaciones DM 1:1 dentro del mismo evento, enviar texto y enlaces, mantener historial y ocultar mensajes eliminados.
8. Reportar contenido, moderar, suspender o expulsar cuentas y registrar las decisiones.
9. Mostrar notificaciones dentro de la aplicación para DMs y anuncios, con historial.

El plan de la propuesta de arquitectura distingue un MVP de comunicación y acceso, una iteración de operación y moderación, y una de calidad. Esa división es una propuesta de secuencia, no evidencia de que alguna iteración esté terminada (`Arquitectura MUNET.pdf`, pp. 73–74).

## Fuera del alcance documentado

- Registro libre; la organización habilita cada cuenta.
- Conversaciones grupales, llamadas, videollamadas y aplicaciones móviles nativas.
- Edición de publicaciones, comentarios y mensajes; reacciones o «likes».
- Adjuntos en DM y notificaciones externas por correo, SMS o push.
- Filtro del muro general por etiquetas de comité (RF-39 lo marca explícitamente fuera de alcance). Las etiquetas opcionales del post sí se contemplan.
- Dashboard administrativo integral y métricas del sistema (RF-31–35), sin eliminar por ello las operaciones administrativas exigidas por otras RF.
- Integraciones con sistemas externos no especificados.

## Qué no se puede afirmar con estas fuentes

Los documentos describen intención y arquitectura. Un informe de despliegue de clase muestra URLs y credenciales de prueba, pero no hay aquí código fuente MUNET ni pruebas ejecutadas sobre el producto. Por tanto, estos textos no describen funcionalidad ya entregada ni estado de producción.

## Glosario breve

| Término | Significado |
| --- | --- |
| Evento | Instancia de MUN con fechas, comités, miembros y estado propio. |
| Membresía | Relación de una persona con un evento; contiene su rol, comité, código y estado de cuenta. |
| Muro | Espacio donde vive exactamente una publicación: general, comité o anuncios. |
| `participant_code` | Código de participante inmutable, único dentro de cada evento, usado como identificación de acceso. |
| DM | Conversación privada entre dos miembros del mismo evento. |
| Eliminación lógica | El contenido desaparece para participantes, pero queda registro restringido para auditoría. |
