# Visión y alcance

## Qué es MUNET

MUNET busca centralizar la operación digital de un Modelo de Naciones Unidas: acceso de participantes, pertenencia a eventos y comités, comunicación pública por muros, perfiles, mensajería directa y tareas administrativas.

El sitio participante ofrece comunicación y acceso por evento. El panel incorpora gestión de eventos, comités y cuentas individuales. Consulta el [manual funcional](manual-funcional.md) para los recorridos disponibles.

## Actores

- **Participante/delegado:** activa su cuenta, selecciona evento, consulta muros y perfiles, publica según permisos y usa mensajes directos.
- **Moderador/mesa:** actor histórico destinado a moderación y supervisión; el código no ofrece un módulo específico completo.
- **Administrador/coordinador/organizador:** gestiona altas y modera contenido. Actualmente la aplicación reconoce estos roles por coincidencia textual.
- **Organización del evento:** responsable de reglas, catálogos y decisiones que el repositorio no puede resolver por sí solo.

## Alcance funcional vigente comprobable

- Activación inicial, inicio de sesión y recuperación del contexto autenticado.
- Selección de una membresía/evento activo.
- Muros general, anuncios y comités; publicaciones de texto y encuestas.
- Comentarios de un nivel, voto y cierre de encuestas, eliminación lógica de contenido.
- Perfil propio y público; carga de avatar.
- Mensajería directa individual dentro del evento.
- Listado y configuración de eventos, alta y edición de comités, alta y mantenimiento individual de participantes y cambio de comité. CSV disponible en API.

La [matriz de trazabilidad](../07-auditoria/matriz-de-trazabilidad.md) detalla cuánto de cada requisito está implementado.

## No demostrado como operativo

- Alta utilizable de un evento nuevo con sus muros, cierre integral, importación desde el panel y asignaciones masivas.
- Reportes de contenido, sanciones, bloqueo de conversaciones y supervisión de mensajes.
- Centro de notificaciones, exportación CSV, recuperación autónoma de contraseña y auditoría consultable.
- Políticas RLS, restricciones e integridad de la base desplegada.
- Despliegue y comportamiento en producción.

## Fuera del alcance del incremento administrativo reciente

El archivo de contexto incorporado con la rama administrativa posterga reportes, notificaciones, métricas de panel, presencia, chat grupal, notificaciones externas y moderación automática. Algunas de esas capacidades sí eran requisitos históricos; por tanto, “postergado” no equivale a “descontinuado”. Véase [discrepancias](../07-auditoria/discrepancias.md).

## Principios recuperados

1. El evento es la frontera funcional principal.
2. La membresía representa la identidad y los permisos del usuario en un evento.
3. El backend es la frontera de acceso a datos, excepto Realtime.
4. La moderación y la auditoría deben dejar evidencia; la implementación actual solo lo cumple parcialmente.
5. Una intención histórica no se presenta como funcionalidad disponible sin evidencia.

## Fuentes

Esta visión consolida las seis especificaciones históricas migradas, `munet-context-general.md` y el código en `apps/web` y `apps/api`. La procedencia se conserva en [migración histórica](../07-auditoria/migracion-historica.md).
