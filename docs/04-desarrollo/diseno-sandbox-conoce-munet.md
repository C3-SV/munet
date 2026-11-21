# Diseño: modo práctica de MUNET («Conoce MUNET»)

Estado: aprobado el 21 de noviembre de 2026. Reemplaza al primer borrador, que planteaba un sandbox en el servidor con inscripción automática, límites en la base y reinicio semanal. Parte de [evento-de-entrenamiento.md](evento-de-entrenamiento.md), el evento sembrado con 40 cuentas ficticias que ya existe.

## Intención y por qué

Que cualquier persona con cuenta en MUNET pueda **probar todo lo que hace la plataforma sin publicar nada de verdad**. Un sandbox en el servidor obliga a meter a todos los usuarios reales en un espacio compartido, con riesgos reales: desconocidos que se escriben entre sí, menores expuestos, nombres de otros eventos a la vista, moderación y costo de almacenamiento. Si **todo ocurre en el navegador de cada persona**, esos riesgos desaparecen y no hace falta migración, cron ni reinicio en el servidor.

El evento de entrenamiento del servidor se queda, pero con otro propósito: **entrenar a organizadores** en el panel de administración y en el ciclo de cuentas.

## Metas

1. **Un modo práctica** al que se entra desde el menú, disponible para cualquier persona con sesión, donde se puede probar lo que hace un participante: el muro (publicar, encuestas, votar, comentar, adjuntos), mensajes directos, directorio y perfil.
2. **Nada sale del navegador**: no se escribe en la base, ni en R2, ni se suscribe a tiempo real.
3. **Usa la misma interfaz que el producto real**, para que se practique lo que existe de verdad.
4. **Límites locales** que protegen el almacenamiento del navegador (por ejemplo, pocos adjuntos).
5. **Reiniciar la práctica** con un botón que borra los datos locales.
6. **Entrenamiento de organizadores** con el evento del servidor reducido de 40 a unas 12 cuentas.

## No metas

- Practicar el panel de administración dentro del modo práctica (eso es el evento del servidor).
- Acceso sin sesión (queda como mejora futura).
- Ver publicaciones de otras personas reales.
- Sincronizar la práctica entre dispositivos.
- Definir el «evento cerrado = solo lectura» del resto de eventos (sigue pendiente en [PENDIENTES.md](../PENDIENTES.md)).
- Cambiar el comportamiento de los eventos reales.

## Anti-metas (fallos aunque «funcione»)

- **Que una acción de práctica llegue a la API real**, aunque sea una. Si falta algo simulado, debe fallar cerrado.
- Que la práctica y la cuenta real se mezclen: datos de una persona visibles para otra en el mismo navegador.
- Que la práctica sea el evento por defecto de alguien con un evento real.
- Que los cambios de la API rompan en silencio el simulador (deriva).
- Que llenar el almacenamiento del navegador rompa la aplicación real.

## Decisiones ya tomadas por la persona dueña

- Todo queda simulado en el navegador, solo para este modo.
- Se conserva el evento sembrado del servidor, reducido, para entrenar a organizadores.
- Camino 1: una capa de API simulada que reutiliza la interfaz.

## Enfoques considerados

- **Capa de API simulada (elegido):** cuando el contexto activo es la práctica, las llamadas que hoy van a la API las atiende un almacén local sembrado con contenido de ejemplo. Reutiliza la interfaz completa. Costo: mantener el simulador al día con cada función nueva.
- Service worker que intercepta las llamadas de red: menos cambios en la web, pero más frágil y difícil de depurar.
- Pantallas aparte para la práctica: lo más rápido, pero se aleja del producto y se aprende algo distinto.

## Hallazgos que guían el diseño

Revisión del código de la web (21 de noviembre de 2026):

- **Punto de entrada único:** todos los módulos de `apps/web/lib/api/` llaman a una sola función, `requestApi` (`client.ts`). Ahí se decide si una llamada es de práctica.
- **Lo que usa un participante:** `feed` (publicar, listar, votar, cerrar encuesta, borrar, adjuntos), `comments`, `chat` (conversaciones y mensajes), `directory`, `profiles`, y de `events` los muros y comités. Es un conjunto acotado.
- **Dos fugas a cerrar a mano:** la subida de adjuntos hace un `fetch` directo a R2 (no pasa por `requestApi`), y el muro, los comentarios y el chat se suscriben a **tiempo real** con `supabaseBrowser`.
- **Contexto de evento:** el contexto activo es un evento y una membresía guardados en `localStorage`; los delegados con una sola membresía entran directo.

## Diseño

### 1. El contexto «práctica» en la web

- Una membresía **ficticia solo en el cliente** (`id` y `eventId` reservados, rol participante, nombre «Práctica») que se agrega a las membresías reales **sin persistirse en ellas**. El resto de la aplicación la trata como un evento más.
- **Acceso:** un enlace «Modo práctica» en el menú lateral y, cuando el selector de evento ya aparezca (personas con rol de administración), una tarjeta «Modo práctica» más, visible para cualquier rol con sesión. No es una membresía de la base y **no cuenta** para decidir si alguien entra directo: quien tiene un solo evento real sigue entrando directo a ese evento.
- **Nunca por defecto:** entrar a la práctica no se guarda como evento activo. Al salir, o al iniciar sesión otra vez, se vuelve al evento real.
- **Quién llega:** solo quien ya puede iniciar sesión (hoy se exige una membresía activa). Una cuenta pendiente o suspendida no llega a la práctica.
- **Aviso fijo** en todas las pantallas de práctica: «Modo práctica: todo se guarda solo en tu navegador». Etiqueta «Práctica» en el menú y en el selector.
- **Persona de práctica:** un perfil local («Delegación Brasil #17», editable solo con datos de práctica). Nunca se usa el nombre real.

### 2. El simulador detrás de `requestApi`

- Si la llamada lleva el evento reservado de práctica, `requestApi` la entrega a un **enrutador local** que implementa los mismos caminos y formas de respuesta que la API para las superficies de arriba. Si no, sigue como hoy.
- **Falla cerrado:** si un camino de práctica no tiene simulación, responde un error «no disponible en práctica» y **jamás** reenvía la llamada a la API. Nunca se envía el token a nada en modo práctica. Capa extra: el evento reservado no existe en la base, así que aunque algo se escapara, la API lo rechazaría.
- **Adjuntos:** en práctica no se pide URL de subida ni se llama a R2. El archivo se guarda como binario local y «abrir» o «vista previa» usan una URL local temporal.
- **Tiempo real:** en práctica no se crean suscripciones; el almacén local avisa a la propia pantalla cuando algo cambia.
- **Mensajes directos:** se puede escribir a **cualquiera de las ~8 personas de ejemplo** del directorio de práctica, o continuar las 2 conversaciones sembradas. Cada mensaje que la persona envía recibe **una** respuesta preparada, tomada en orden de una lista corta por cada persona de ejemplo (sin lógica por palabras clave), con un tope de respuestas por conversación para que no se vuelva un bucle.

### 2.1 Qué reglas aplica la práctica

El simulador no copia toda la API: devuelve las mismas formas de respuesta **y aplica la lista corta de reglas que una persona participante tropieza al usar la plataforma**, con los mismos mensajes de error de la API real:

- **Muros:** en «Avisos» solo se lee (la participante no publica); en General y en el muro de su comité sí; los demás comités no son accesibles.
- **Publicaciones:** contenido obligatorio de hasta 500 caracteres; un solo adjunto por publicación (JPG o PNG, o PDF) con los límites locales de la sección 4.
- **Encuestas:** de 2 a 10 opciones; el voto se puede cambiar mientras esté abierta; solo la autora la cierra; cerrada no admite votos.
- **Borrado:** solo se borra lo propio; lo borrado deja el marcador «eliminada por su autor».
- **Comentarios:** un nivel de respuesta; no se comenta en una publicación borrada.
- **Mensajes directos:** solo entre dos personas del directorio de práctica; solo se borran los propios; no se escribe a una misma.
- **Fuera de la lista** (por ejemplo, suspensiones o cualquier regla de administración) la práctica no simula nada: el camino responde «no disponible en práctica». Cada regla de la lista tiene su prueba.

### 3. El almacén local

- **IndexedDB** (los adjuntos son binarios y `localStorage` no alcanza), con una base **por usuario** (clave con el identificador de la cuenta) para que dos cuentas en el mismo navegador no vean la práctica de la otra.
- **Versionado:** cada cambio del contenido de ejemplo o de la estructura sube una versión; al detectar una versión distinta, la práctica se reinicia sola con aviso.
- **Contenido inicial:** el mismo contenido de ejemplo del evento de entrenamiento (avisos fijados, publicaciones en General y comités, una encuesta con votos, comentarios, conversaciones y dos adjuntos). Cómo compartir ese contenido entre la API y la web (paquete común o copia) lo decide quien construye; hay que evitar que diverjan.
- **Reiniciar práctica:** botón con confirmación que borra el almacén y vuelve a sembrarlo.

### 4. Límites locales

Protegen el navegador, no un servidor. Valores iniciales propuestos:
- Adjuntos: máximo 2 en total, imágenes hasta 2 MB y PDF hasta 5 MB (los reales siguen en 5 y 20 MB).
- Tope total de datos de práctica (por ejemplo 25 MB) y un máximo de publicaciones y comentarios creados por la persona.
- Si el navegador rechaza escribir por falta de espacio, se muestra un mensaje claro y la aplicación real no se ve afectada.
Un límite solo endurece lo oficial: nunca permite más que RN-11.

### 5. Evitar la deriva del simulador

- **Tipos compartidos:** el simulador devuelve los tipos que ya usa la interfaz (`Post`, comentarios, conversaciones…), así que el compilador marca los cambios.
- **Pruebas de forma:** una prueba por camino simulado comprueba que la respuesta tiene la forma esperada por la interfaz.
- **Pruebas de aislamiento:** modo práctica no llama a `fetch`, no abre tiempo real y falla cerrado en caminos sin simular; dos usuarios no comparten datos.
- **Lista de revisión:** un cambio de contrato de la API que afecte a una superficie de participante debe actualizar el simulador (queda en la guía del equipo).

### 6. Entrenamiento de organizadores (evento del servidor)

El evento sembrado se mantiene solo para organizadores, con **12 cuentas** que son un subconjunto de las que ya existen: `CON-ADM` (instructor), `CON-MOD1` y `CON-MOD2` (moderadores), `CON-001` a `CON-006` (participantes activos que dan vida al contenido), `CON-023` y `CON-024` (pendientes) y `CON-033` (suspendida). El contenido de ejemplo se reasigna a esos 6 participantes.

**Retiro de las 28 sobrantes** (`CON-007` a `CON-022`, `CON-025` a `CON-032` y `CON-034` a `CON-037`): es un borrado **lógico** de la membresía (queda `deleted_at`, así la auditoría se conserva y el código queda libre), más borrar su usuario de acceso en Auth. Solo toca membresías con prefijo `CON-` del evento de entrenamiento, nunca personas reales ni otros eventos. Es una operación sobre la base de producción, así que el script **simula primero** y lista exactamente qué retiraría; solo se aplica con `--apply` y con la autorización expresa de la persona dueña en ese momento. El Excel se regenera con las 12. Ya no se inscribe a nadie automáticamente.

## Restricciones

- La práctica no puede escribir en la base de producción ni en R2 bajo ninguna circunstancia.
- Cada evento real conserva sus reglas; el modo práctica no altera su comportamiento.
- Sin contraseñas ni secretos en el repositorio.
- Sin migraciones de base de datos para esta parte.
- El navegador impone sus límites de almacenamiento y puede borrar los datos; la práctica debe tolerarlo.

## Entregas (un PR por cada una)

1. **Núcleo:** contexto de práctica, enrutador local detrás de `requestApi` con falla cerrada, almacén en IndexedDB por usuario con versionado, cierre de las fugas (subida a R2 y tiempo real), aviso, acceso en el menú y botón de reiniciar.
2. **Superficies:** muro (publicaciones, encuestas, comentarios, adjuntos locales con límites), directorio, perfil y mensajes directos con respuestas simuladas.
3. **Entrenamiento de organizadores:** reducir el evento del servidor a unas 12 cuentas, retirar las sobrantes, regenerar el Excel y actualizar la guía.

### Estado de la entrega 1

Entrega 1 implementada el 21 de noviembre de 2026 (rama `feat/modo-practica-nucleo`, sin publicar). Plan: [plan-modo-practica-entrega-1.md](plan-modo-practica-entrega-1.md). Código en `apps/web/lib/practice/` (constantes, catálogo, almacén con versión, IndexedDB con respaldo en memoria, enrutador local con falla cerrada, pasarela y membresía), el desvío en `requestApi` y la interfaz en `components/practice/PracticeBanner.tsx`, el menú lateral y el layout `(main)`.

Verificado el 21 de noviembre de 2026: 61 pruebas de `lib/practice`, `tsc` y `eslint --max-warnings 0` sin errores, 326 pruebas de la API. Recorrido real en el navegador con la web apuntando a la API local y la cuenta de un participante demo: «Modo práctica» muestra el aviso, los muros Avisos, General y el del comité de la persona (vacíos); durante la práctica no salió ninguna petición a la API ni a R2 y no se abrió ningún WebSocket; al recargar se vuelve al evento real y `localStorage` no contiene ids de práctica; «Reiniciar práctica» borra y re-siembra el estado; «Salir de la práctica» restaura el evento real; existe la base `munet-practice-<id>` en IndexedDB con los almacenes `state` y `blobs`.

Límites conocidos de esta entrega, para las siguientes:

- Las superficies que escriben (publicar, encuestas, comentarios, adjuntos, mensajes directos, directorio, perfil editable) responden «No disponible en modo práctica» (501) hasta la entrega 2. El formulario de publicar sí se ve; al publicar, la persona lee ese mismo texto en el aviso del muro. Comentar, votar, eliminar y cerrar encuestas ya muestran el mensaje del error tal cual. Los borradores del editor no se guardan en la práctica.
- El reinicio automático por versión «con aviso» (sección 3) no existe: la pasarela descarta el indicador `wasReset`. Es requisito de la entrega 2: cuando suba `PRACTICE_STATE_VERSION` debe avisarse en el banner de la práctica.
- Rutas que no pasan por el desvío porque no llevan el evento en `requestApi`: `lib/api/admin.ts`, `moderation.ts` y `participants.ts` (el id va en la ruta) y `lib/api/auth.ts` (`fetch` directo). Hoy no son alcanzables desde la interfaz de práctica; la entrega 2 debe cerrarlas o comprobarlo de nuevo.
- `hydrateAuth` pone `practice: false` y lo llaman los layouts `(admin)`, login y selector de evento: abrir esas rutas (por ejemplo con el botón «atrás») sale de la práctica. El layout `(main)` solo hidrata si aún no está hidratado.
- `setPracticeStorageFactory` (solo para pruebas) queda exportada en el paquete de producción.
- El store de autenticación y el desvío de `client.ts` no tienen pruebas automáticas dentro del repositorio (solo verificación manual y guiones fuera del repositorio).

## Qué queda a criterio de quien construye

- Estructura exacta de las tablas del almacén local y su migración entre versiones.
- Cómo compartir el contenido de ejemplo entre la API y la web.
- Textos de los avisos, de los errores y de las respuestas simuladas de los mensajes directos.
- Estilo de la etiqueta «Práctica», del aviso fijo y del botón de reinicio.
- Valores finales de los límites locales.

## Decisiones de quien diseña, a revisar

- La práctica aplica la lista corta de reglas de la sección 2.1; todo lo demás responde «no disponible».
- La práctica no se guarda como evento activo ni cuenta para entrar directo.
- Retiro de las 28 cuentas sobrantes: borrado lógico más borrar su acceso, solo con simulación previa y autorización expresa al aplicar.
- Los mensajes directos aceptan a cualquiera de las ~8 personas de ejemplo, con una respuesta por mensaje de una lista corta.

- El acceso es solo con sesión; el acceso sin sesión queda como mejora futura.
- La práctica no es una membresía de la base: es una membresía solo del cliente.
- Se usa IndexedDB con una base por usuario.
- Los mensajes directos tienen respuestas simuladas fijas; no hay tiempo real.

## Preguntas abiertas para la persona dueña

Ninguna por ahora; el revisor puede traer alguna.
