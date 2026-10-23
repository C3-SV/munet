# MUNET — Contexto general del proyecto (Frontend + Backend)

> Documento de contexto para trabajar en MUNET, cubriendo tanto el sitio de participantes como el panel administrativo, frontend y backend por igual.

---

## 1. Qué es MUNET

MUNET es una plataforma web desarrollada en colaboración entre **MUN ESEN** y **C3**. Digitaliza la comunicación y operación de los eventos de Modelo de Naciones Unidas organizados por MUN ESEN, con una dinámica tipo red social / foro (similar a Reddit).

En vez de depender de varios grupos, documentos o canales separados, MUNET centraliza todo en un mismo espacio.

Los participantes pueden:
- Consultar el muro general (comunicación entre participantes de distintos comités).
- Revisar el muro de avisos (indicaciones del equipo organizador).
- Acceder a los muros de sus comités.
- Crear publicaciones, comentarios y encuestas.
- Compartir archivos relacionados al evento.
- Ver perfiles de otros participantes.
- Comunicarse por mensajes directos (DM).

MUNET también incluye un **panel administrativo** para que el equipo organizador cree y configure eventos, registre participantes, gestione comités, asigne usuarios y modere contenido.

**Objetivo general:** que la organización y comunicación de cada evento sea más clara, ordenada y fácil de manejar tanto para participantes como para el equipo organizador.

---

## 2. Stack técnico

Monorepo con **Turborepo**, dos apps:

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS
- Zustand

**Backend**
- Node.js
- Express
- TypeScript

**Servicios (Supabase)**
- Supabase PostgreSQL → base de datos
- Supabase Auth → autenticación
- Supabase Storage → archivos
- Supabase Realtime → mensajes y actualizaciones en tiempo real

**Regla importante:** todo acceso a Supabase debe pasar por la API del backend — nunca directo desde el frontend, **excepto** las llamadas realtime.

---

## 3. Estado actual del sistema

### 3.1 Sitio de participantes (ya funcional — FE y BE)
- Login con código de participante.
- Activación de cuenta por primera vez.
- Acceso al evento al que pertenecen.
- Consulta de muro general, muro de avisos y muros de comité.
- Crear y eliminar publicaciones.
- Comentar y responder publicaciones.
- Crear encuestas y votar.
- Ver perfil propio y de otros; editar perfil e imagen.
- Iniciar conversaciones privadas (DM); enviar y eliminar mensajes.
- Actualizaciones en tiempo real.
- Registro básico de auditoría de algunas acciones del sistema.

### 3.2 Sitio administrativo (en construcción)
Existe parte de la lógica en el backend (endpoints), pero **no hay interfaz administrativa todavía**:
- Crear eventos.
- Crear comités.
- Crear membresías (vincular una cuenta de usuario a un evento específico con su rol y comité correspondiente).
- Crear cuentas de participantes.

> ⚠️ Estas funciones existen como endpoints backend, pero falta toda la UI para que el equipo organizador las use.

---

## 4. Roadmap por sprint (FE + BE, según board de Notion)

**Sprint 0 — Base**
- Reunión introductoria.
- FE (admin): construir el flujo de la interfaz administrativa (layout, navegación, login admin).
- BE (admin): proteger endpoints administrativos con middleware de roles/autorización.

**Sprint 1 — Eventos y comités**
- FE (admin): UI para crear/configurar eventos; UI para crear y editar comités.
- BE (admin): endpoints/lógica para crear y configurar eventos; endpoints para crear/editar comités + creación automática del muro al registrar un comité nuevo.

**Sprint 2 — Participantes**
- FE (admin): UI para crear participante individual; UI para importar participantes vía CSV; UI para consultar/editar participantes; UI para reiniciar contraseña.
- BE (admin): endpoint de creación individual; endpoint de importación masiva vía CSV; endpoint de consulta/edición; endpoint de reset de contraseña.

**Sprint 3 — Asignaciones, cuentas y archivos**
- FE (admin): UI para asignar participantes a comités; UI para suspender/reactivar cuentas; UI de gestión de moderadores; UI de límites y mensajes de error al subir archivos (5MB img / 20MB PDF).
- BE (admin): endpoint de asignación a comités; endpoint de suspensión/reactivación; endpoint para asignar rol de moderador; reglas de tamaño/tipo de archivo con acceso restringido por muro/DM; eliminar archivos al borrar publicación/mensaje relacionado (limpiar huérfanos).

**Sprint 4 — Moderación de contenido**
- FE (admin): UI para navegar todos los muros (vista admin); UI para eliminar contenido inapropiado; UI para fijar publicación; UI para supervisar y bloquear conversaciones.
- BE (admin): endpoint de eliminación de contenido; endpoint de fijar/desfijar publicaciones; endpoint de supervisión (bajo autorización) y bloqueo de conversaciones.

**Cierre de sprints**
- Pruebas de las funciones principales del sistema.
- Verificar que las acciones importantes queden en auditoría (usuario que actúa + afectado).
- Refactor: UUID correcto en campos de auditoría.
- Refactor: eliminar console.logs de desarrollo.
- Refactor: alinear código con la estructura real de la BD (campos, estados, tipos).
- Refactor: optimizar código, quitar componentes/dependencias no usadas.
- Refactor: rate limiting en login, publicaciones, comentarios y DMs.
- Revisión general del sistema + demo con MUN ESEN.

---

## 5. Requerimientos pendientes — detalle completo

### 5.1 Sitio de participantes (FE + BE)
- Agregar archivos en publicaciones y mensajes directos.
- Aplicar accents amarillos en el frontend.
- Verificar permisos de acceso a muros y comités (no se debe poder ver un muro del que no se es parte).
- Revisar que los perfiles públicos funcionen correctamente.
- Asegurar tiempo real en chat y foro (posts y DMs sin necesidad de recargar).
- Definir un único estado para mensajes eliminados (hoy hay varios estados inconsistentes usados como solución temporal).
- Revisar que no quede ningún acceso directo a Supabase desde el front (todo por API salvo realtime).

### 5.2 Sitio de administración (FE + BE)
- Crear la interfaz administrativa.
- Crear participantes individualmente.
- Importar participantes mediante CSV.
- Consultar y editar participantes.
- Reiniciar contraseña de un participante.
- Asignar participantes a comités.
- Suspender y reactivar cuentas.
- Crear y configurar eventos.
- Crear y editar comités.
- Crear automáticamente el muro correspondiente al registrar un nuevo comité.
- Gestionar moderadores.
- Navegar por todos los muros.
- Eliminar contenido inapropiado.
- Fijar publicaciones en muros.
- Supervisar conversaciones bajo autorización.
- Bloquear conversaciones cuando sea necesario.
- Proteger los endpoints administrativos para que solo los usen roles autorizados.

### 5.3 Archivos (compartido, impacta ambos sitios)
- Almacenar archivos en Supabase Storage.
- Permitir imágenes JPG/PNG hasta 5 MB y PDFs hasta 20 MB.
- Cada archivo solo debe verse desde el muro o DM donde fue compartido, y solo por usuarios con acceso a ese espacio.
- Evitar que personas no autorizadas abran archivos por enlace directo.
- Eliminar archivos correctamente al borrar el post/mensaje relacionado.
- Evitar archivos huérfanos (sin post/mensaje asociado).

### 5.4 General (ambos sitios)
- Agregar pruebas para las funciones principales del sistema.
- Garantizar que acciones importantes queden en la tabla de auditoría, con el usuario que actuó y, cuando aplique, el usuario afectado/destinatario.

### 5.5 Refactors (ambos sitios)
- Corregir campos de auditoría para guardar correctamente el UUID de quien hizo la acción.
- Eliminar console.logs de desarrollo/debugging.
- Alinear el código con la estructura real de la BD (mismos campos, estados y tipos de datos).
- Optimizar código; eliminar componentes/dependencias/funciones no usadas.
- Implementar límites de uso (rate limiting) para evitar intentos/envíos excesivos en login, publicaciones, comentarios y DMs.

---

## 6. Fuera de alcance (no implementar en ningún sprint)
- Sistema completo de reportes.
- Centro de notificaciones.
- Métricas y dashboard administrativo.
- Presencia en línea.
- Chat grupal.
- Notificaciones por correo, SMS o push.
- Moderación automatizada.

---

## 7. Criterios de finalización del sprint
- Flujos principales del sitio de participantes y del panel admin probados.
- Permisos por usuario, evento y comité funcionando correctamente.
- Endpoints administrativos protegidos.
- Acciones importantes registradas en auditoría.
- Sin errores críticos conocidos.
- Plataforma lista para demo completa con MUN ESEN.

### Diseño / Figma
No hay diseño completo en Figma. Para vistas nuevas, apoyarse en IA usando como referencia el estilo/componentes ya existentes. No es necesario rediseñar todo — prioridad: consistencia visual y experiencia simple.

---

## 8. Git, despliegue y flujo de trabajo

- Repo: monorepo (frontend + API separados como dos proyectos en Vercel).
- Rama de producción: `main`.
- Cada equipo trabaja en su propia rama y envía PR hacia `main` cuando esté revisado y listo.
- Antes de mergear, verificar:
  - Funcionalidad completa.
  - Cambios probados.
  - No se afectan otras partes del sistema.
  - No se incluyen variables, contraseñas o info sensible en el repo.
- Despliegue en Vercel bajo la cuenta de **Tecnología C3** (cuenta gratuita) — los despliegues automáticos a veces requieren un commit en `main` desde esa cuenta asociada; si es necesario, se puede hacer un cambio pequeño y válido (ej. corregir comentario o doc) desde ahí.
- Si un despliegue falla o no corre correctamente, avisar de inmediato a **Fiore** o **Rober**.

### Próximos pasos (post-demo)
Una vez aprobado el proyecto con MUN ESEN, se harán pruebas de carga con muchos usuarios interactuando a la vez, para validar que el sistema es seguro de usar en el MUN de este año.

---

## 11. Resumen rápido de desarrollo

Cuando trabajes en este proyecto, ten en cuenta:

1. Monorepo Turborepo: frontend en Next.js/React/TS/Tailwind/Zustand, backend en Node/Express/TS, todo sobre Supabase (Postgres, Auth, Storage, Realtime).
2. Dos sitios: **participantes** (mayormente funcional, con pendientes de archivos, permisos, perfiles públicos y consistencia de tiempo real) y **administrativo** (backend con endpoints sueltos, falta toda la UI y varias reglas de negocio).
3. Nunca acceso directo a Supabase desde el frontend (salvo realtime) — todo pasa por la API.
4. Seguir la estructura real de la base de datos (ver DER v1) en vez de inventar campos/estados nuevos.
5. Cualquier endpoint admin debe estar protegido por rol antes de exponer su lógica de negocio.
6. Todo archivo compartido en muros/DMs debe respetar límites de tamaño/tipo y visibilidad restringida al espacio donde se compartió; borrarse en cascada con su post/mensaje.
7. Acciones importantes del sistema deben quedar en auditoría con UUID correcto del usuario que actuó (y el afectado, si aplica).
8. Está fuera de alcance: reportes, notificaciones, dashboard de métricas, presencia en línea, chat grupal, moderación automatizada.
