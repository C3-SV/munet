# Pruebas y validación

## Comandos locales

| Comando | Alcance |
|---|---|
| `npm test -w api` | Suites Node de `apps/api/src`, ejecutadas desde la raíz por el script del workspace. Incluyen utilidades y pruebas con sustitutos de Supabase y bcrypt. |
| `npm run check-types -w api` | TypeScript de la API sin emitir archivos. `npm run build -w api` hace la misma comprobación. |
| `node --test apps/web/lib/api/base-url.test.mjs` | Normalización y composición de URL base de la API en web. |
| `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs` | Suites Node de utilidades de `apps/web`: fecha y hora (`format-datetime`), etiqueta de persona (`person-label`), navegación de muros (`wall-nav`), agrupación de mensajes (`chat-groups`) y las de `lib/api`. |
| `npm run check-types -w web` | TypeScript de la web (genera tipos de rutas y compila sin emitir). |
| `npx eslint .` dentro de `apps/web` | Lint de la web. Debe dar 0 errores; la línea base tenía 32 advertencias y no puede subir. |
| `npm run build` y `npm run check-types` | Turbo ejecuta los scripts disponibles en workspaces, incluida la API. |
| `npm run lint` | Turbo ejecuta los scripts disponibles. La API carece de lint propio. El script de la web usa `--max-warnings 0`, por lo que falla mientras queden advertencias. |

El root y la web carecen de script `test`. `npm run format` escribe archivos. Las reglas visuales y de interacción de la web están en la [especificación de la mejora de UX pública](../superpowers/specs/2026-11-19-web-publica-critica-ux-design.md); este documento no las repite.

## Evidencia del 18 de noviembre de 2026

Sobre [el commit de referencia](../README.md), con Node 22.20.0 y las dependencias fijadas instaladas sin scripts:

- `npm test -w api` terminó con 110 pruebas correctas, cero fallos. Incluye autorización administrativa, catálogos, altas, búsqueda, CSV, cambio de comité, perfiles y permisos de muros.
- `npm run check-types -w api` terminó con código 0.
- `node --test apps/web/lib/api/base-url.test.mjs` terminó con dos pruebas correctas, cero fallos.

Las pruebas usan sustitutos o funciones aisladas. No hubo ejecución de migraciones, builds web ni recorridos con Auth, Storage, Realtime o una base real.

## Recorrido en un entorno aislado

Usar datos ficticios, dos eventos, dos comités y perfiles administrativos y de delegado.

1. Crear un evento, confirmar acceso del creador y comprobar general y anuncios. Guardar fechas válidas e inválidas, editar el evento y comprobar qué acciones se permiten al cerrarlo.
2. Crear un comité y comprobar su muro. Editar su nombre y verificar el cambio en el muro. Verificar que administración de otro evento y participantes no puedan administrar sus registros.
3. Dar de alta una cuenta y probar la previsualización CSV sin escritura, lotes con resultados parciales y duplicados. Comprobar la asignación y estabilidad del código `#`.
4. Activar con contraseña inicial, entrar y seleccionar evento. Probar un código repetido entre eventos, restablecimiento antes y después de activar, y suspensión/reactivación de una cuenta pendiente.
5. Cambiar de comité desde la ficha y volver a cargar la sesión del delegado. Confirmar pérdida de acceso al muro anterior y acceso al nuevo. Probar además un comité archivado y un comité de otro evento.
6. Probar alias/avatar, anuncios, publicaciones, comentarios, voto y cierre, chat 1:1 y borrado lógico. Observar actualización entre dos sesiones y el efecto de suspender una membresía con sesión abierta.

## Evidencia de la mejora de UX pública del 20 de noviembre de 2026

Sobre la base `cab6daa` de la rama `rework-visual`, sin migraciones, sin cambios en `apps/api` y sin dependencias nuevas:

- `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs` terminó con 48 pruebas correctas, cero fallos.
- `npm test -w api` terminó con 129 pruebas correctas, cero fallos.
- `npm run check-types -w web` terminó con código 0.
- `npx eslint .` dentro de `apps/web` terminó con 0 errores y 4 advertencias (`@next/next/no-img-element`), por debajo de la línea base de 32.
- `npm run lint -w web` y `npm run lint` terminaban con código 1 por las 4 advertencias restantes, porque el script usa `--max-warnings 0`. Resuelto en la ronda 1 (ver abajo).
- `impeccable detect --json app components` encontró un hallazgo `side-tab` en `components/ui/Card.tsx:29`. No está entre los antipatrones que exige la especificación.
- Búsquedas por texto en `app`, `components` y `lib`: cero coincidencias de `font-black`, `font-extrabold`, `text-[10px]` y `text-[11px]`. Dos coincidencias de `#b91c1c` en `app/(main)/profile/[membershipId]/page.tsx` (líneas 499 y 660) incumplían la regla de cero hexadecimales de estado en `.tsx`. Resuelto en la ronda 1.

No se verificó en esta entrega, porque requiere sesión con Supabase o un navegador con datos ficticios:

- El recorrido 6 y el resto de flujos autenticados: login, selección de evento, feed, publicación, comentarios, votación, chat entre dos sesiones, perfil y administración.
- El detector sobre `/login`, `/guia` y `/select-event` en 390×844 y 1440×900, y la revisión visual en claro y oscuro.
- La crítica con `/impeccable critique` sobre el muro, por lo que el puntaje de 20/40 no se ha vuelto a medir.

Registrar comando o pasos, datos de prueba, resultado y limitaciones. Para cambios documentales, verificar enlaces y referencias, ejecutar `git diff --check` y revisar `git status --short`.

## Ronda 1 de corrección de la Tarea 13 (20 de noviembre de 2026)

Sobre el commit `3c8feb6`, con cambios solo en `apps/web` y sin cambios en `apps/api`, migraciones ni dependencias:

- Lint: los logos estáticos de `public/` (`/logo-munet.png`, `c3-logo-*.png`, `mun-esen-*.jpg`) pasan de `<img>` a `next/image` con `unoptimized`, que sirve el mismo archivo sin optimización nueva. Los avatares de URL dinámica conservan `<img>` con una justificación en el `eslint-disable-next-line`: `next/image` exigiría configurar hosts remotos en `next.config`, cambio fuera de esta ronda.
- Color: `#b91c1c` en `app/(main)/profile/[membershipId]/page.tsx` pasa a `var(--danger)`. En modo oscuro el rojo de peligro pasa a `#f87171`, igual que en el resto de la interfaz.
- Transiciones: los 20 usos de `transition-all` pasan a `transition-[opacity,transform,background-color,border-color,color]`, con la duración por defecto de Tailwind (150 ms). Las propiedades fuera de esa lista, como sombra o ancho, cambian ahora sin animación.
- Comandos, con la salida final:
  - `npm run lint -w web` (incluye `eslint --max-warnings 0`): código 0, sin advertencias.
  - `npm run check-types -w web`: código 0, tipos de rutas generados.
  - `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs`: 48 pruebas correctas, cero fallos.
  - `npm test -w api`: 129 pruebas correctas, cero fallos.
  - `impeccable detect --json app components`: un único hallazgo `side-tab` en `components/ui/Card.tsx:29`, ya registrado arriba.

Pendiente, sin ejecutar: los pasos 3 a 5 de la Tarea 13 (detector sobre `/login`, `/guia` y `/select-event` a 390×844 y 1440×900; recorrido manual en claro y oscuro; `/impeccable critique` sobre el muro). Requieren navegador y una sesión con datos ficticios. Los puntos 1 a 6 de Review Focus del plan no tienen evidencia. Siguen abiertos hasta que el dueño acepte formalmente su diferimiento y se registren como deuda en `docs/07-auditoria/pendientes.md`.

## Ronda 2 de corrección de la Tarea 13 (20 de noviembre de 2026)

Sobre la base `cbc5724`, con cambios solo en documentación. No se modificó código de `apps/web` ni `apps/api`, ni migraciones ni dependencias, por lo que no se repitieron las pruebas de código de la ronda 1.

Paso 3 del plan (detector), ejecutado contra el servidor de desarrollo ya en marcha en `http://localhost:3000`, sin sesión iniciada:

```
impeccable detect --json --viewport 390x844 http://localhost:3000/<ruta>
impeccable detect --json --viewport 1440x900 http://localhost:3000/<ruta>
```

| Ruta | 390×844 | 1440×900 |
|---|---|---|
| `/login` | sin hallazgos | sin hallazgos |
| `/select-event` | sin hallazgos | sin hallazgos |
| `/guia` | `overused-font` (advertencia, aceptada por la especificación) y 12 `straggler` (advertencias informativas) | `overused-font` (advertencia), `line-length` (advertencia: unos 110 caracteres en párrafos de tarjeta) y 6 `straggler` (informativas) |

Ninguna de las reglas que el paso 3 exige ausentes (`low-contrast`, `undersized-ui-text`, `hero-eyebrow-chip`, `numbered-section-labels`, `bounce-easing`) aparece en las cuatro mediciones. `/select-event` sin sesión solo muestra su estado de entrada; su vista autenticada no fue medida. El `line-length` de `/guia` a 1440 px no pertenece a la lista de la especificación y queda registrado en `docs/07-auditoria/pendientes.md` sin corregirse en esta ronda.

Pasos no ejecutados, con su motivo:

- Paso 4 (recorrido manual en claro y oscuro): requiere una sesión autenticada y datos ficticios en un entorno aislado. En esta ronda no se crearon cuentas ni se usó una base de prueba, y no hay autorización para hacerlo.
- Paso 5 (`/impeccable critique` sobre el muro): el muro está detrás de autenticación, así que no hay página que evaluar. El puntaje 20/40 sigue sin medirse.
- Puntos 1 a 6 de Review Focus del plan: sin evidencia en navegador. Siguen abiertos.

El diferimiento de estos pasos queda registrado como deuda en `docs/07-auditoria/pendientes.md`, marcado como pendiente de aceptación formal del dueño.

Comprobaciones de la ronda: `git status --short` y `git diff --check` sobre los archivos tocados.

## Ronda 3 de corrección de la Tarea 13 (20 de noviembre de 2026)

Sobre la base `1701da9`, con cambios solo en documentación. No se modificó código de `apps/web` ni `apps/api`, ni migraciones ni dependencias.

Hallazgo T13-R0-1: los pasos 4 y 5 de la Tarea 13 siguen sin ejecutarse, y no hay aceptación formal del dueño del diferimiento. El paso 3 quedó medido en la ronda 2. Esta ronda añade evidencia a nivel de pruebas unitarias y de código para los puntos 1 a 6 de Review Focus del plan. Ninguno está verificado en navegador.

Comandos ejecutados:

- `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs`: 48 pruebas correctas, cero fallos.
- `git diff --check`: sin salida.
- Contraste: cálculo WCAG 2.x sobre los tokens de `apps/web/app/globals.css`.

| Punto de Review Focus | Evidencia | Límite |
|---|---|---|
| 1. Fecha `null`, vacía o inválida | `lib/format-datetime.test.mjs`: `formatDateTime` y `formatTime` devuelven `—` para `null`, `""` y `"no-fecha"`. | No se ha visto en un post o mensaje real. |
| 2. Medianoche y zona horaria | Mismo archivo, zona `America/El_Salvador`: `isSameLocalDay` separa 23:50 del 18 y 01:00 del 19 (05:50Z y 07:00Z), y `formatTime` da `00:00` a medianoche. | Sin prueba en la interfaz. |
| 3. Persona sin comité, sin alias, alias igual al nombre, nombre largo | `lib/person-label.test.mjs`: sin comité usa el rol o no tiene línea secundaria, sin texto `SIN ASIGNAR`; alias vacío o igual al nombre queda en `null`; nombre de 80 caracteres sin espacios se devuelve íntegro. | El recorte visual de la tarjeta depende de CSS y no se ha visto en navegador. |
| 4. Acordeón de muros con uno o cero comités | `lib/wall-nav.test.mjs`: con un solo comité accesible, `mine` lo recibe y `showCommitteeGroup` es `false`; con dos o más, el grupo aparece. `components/layout/Sidebar.tsx:407` renderiza el grupo solo con `showCommitteeGroup`. | El render del menú no se ha visto en navegador. |
| 5. Saltos de línea y palabras largas sin scroll horizontal | Código: `PostCard.tsx:226` y `ChatMessage.tsx:147` usan `whiteSpace: pre-wrap` con `overflowWrap: anywhere`; `PostComments.tsx:437` hace lo mismo en comentarios. El campo de escritura de comentarios (`PostComments.tsx:506`) usa `whitespace-pre-wrap` sin `overflowWrap`. | No se ha comprobado el desplazamiento horizontal en 390 y 1440 px. |
| 6. Contraste 4.5:1 en modo oscuro | Botón primario (`--btn-primary-fg` `#ffffff` sobre `--btn-primary-bg` `#2f6fd0`): 4.88:1. Burbuja propia (`--bubble-me-text` `#e6edf3` sobre `--bubble-me-bg` `#1f4788`): 7.68:1. | Los estados `hover` (`opacity-90`) y `focus` no se han medido. El estado deshabilitado no está sujeto al mínimo. |

Pendiente, sin cambios en esta ronda:

- Pasos 4 y 5 de la Tarea 13 y `/impeccable critique` sobre el muro: requieren sesión autenticada y datos ficticios en un entorno aislado. No hay autorización para crear cuentas (ver ronda 2).
- Verificación visual en navegador de los puntos 3 a 6, en claro y oscuro, a 390 y 1440 px.
- T13-R0-1 sigue abierto hasta que el dueño acepte formalmente el diferimiento registrado en `docs/07-auditoria/pendientes.md`.

## Ronda 4 de corrección de la Tarea 13 (20 de noviembre de 2026)

Sobre la base `ac94140`, con cambios solo en documentación. No se modificó código de `apps/web` ni `apps/api`, ni migraciones ni dependencias, por lo que no se repitieron las pruebas de código (`check-types` y `eslint` sobre archivos tocados no aplican a esta ronda).

Hallazgo T13-R0-1: sin cambios de evidencia. Los pasos 4 y 5 siguen sin ejecutarse por estas razones:

- Requieren una sesión autenticada con Supabase y datos ficticios en un entorno aislado. Crear cuentas exige autorización expresa del dueño, que no se ha dado para este fin.
- La aceptación formal del diferimiento corresponde al dueño del proyecto. Esta ronda no la registra.

Decisión pendiente del dueño, una de dos opciones:

1. Autorizar un entorno aislado con datos ficticios para ejecutar los pasos 4 y 5 y registrar sus resultados.
2. Aceptar formalmente el diferimiento y confirmarlo en la sección «Verificación diferida de la Tarea 13» de `docs/07-auditoria/pendientes.md`.

Hasta que se resuelva una de las dos, la Tarea 13 no se considera cerrada.

Comprobaciones de la ronda: `git diff --check` y `git status --short` sobre los archivos tocados.

## Ronda 5 de corrección de la Tarea 13 (20 de noviembre de 2026)

Sobre la base `d29437b`, con cambios solo en documentación. No se modificó código de `apps/web` ni `apps/api`, ni migraciones ni dependencias, por lo que `check-types` y `eslint` no aplican a esta ronda. Como control, `node --test apps/web/lib/*.test.mjs apps/web/lib/api/*.test.mjs` terminó con 48 pruebas correctas, cero fallos.

Hallazgo T13-R0-1: sin cambios de evidencia. Los pasos 4 y 5 siguen sin ejecutarse; el paso 3 conserva la medición de la ronda 2.

- Pasos 4 y 5: requieren una sesión autenticada con Supabase y datos ficticios. La base real está marcada como de producción (Q03), y crear cuentas exige autorización expresa del dueño. Esta ronda no la recibió, así que no se crearon cuentas ni se usó la base.
- Aceptación del diferimiento: no se registra en esta ronda. Corresponde al dueño confirmarla en «Verificación diferida de la Tarea 13» de `docs/07-auditoria/pendientes.md`.

Decisión de esta ronda (Ruling): el hallazgo no se marca como cerrado, porque cerrarlo sin evidencia o sin aceptación del dueño sería registrar una verificación que no ocurrió. Costo si es incorrecto: la Tarea 13 sigue abierta una ronda más; si el dueño considera que el commit de esta ronda equivale a aceptación, el diferimiento quedaría sin confirmación escrita.

Pendiente de decisión del dueño: una de las dos opciones de la ronda 4 (autorizar el entorno aislado o aceptar el diferimiento en `pendientes.md`).

Comprobaciones de la ronda: `git diff --check` y `git status --short` sobre el archivo tocado.

## Ronda 6 de la Tarea 13: ejecución de QA sin sesión (20 de noviembre de 2026)

Sobre el árbol de trabajo con el cambio de `apps/web/components/ui/Card.tsx` (variante `official` con borde de 1 px en `--signal`), sin cambios en `apps/api`, migraciones ni dependencias. Se usó el servidor de desarrollo `npm run dev -w web` en `http://localhost:3000`, reiniciado porque el proceso anterior servía un bundle obsoleto.

- Paso 3 (detector), repetido: `/login` y `/select-event` sin hallazgos a 390×844 y 1440×900. `/select-event` sin sesión redirige a `/login`, así que esa medición corresponde a la página de entrada. `/guia` mantiene los `straggler` (informativos) y, a 1440 px, `line-length` ya registrado en `docs/07-auditoria/pendientes.md`.
- Desbordamiento horizontal sin sesión (`scrollWidth` frente a `innerWidth`): `/login`, `/guia` y `/select-event` (este último redirigido a `/login`) sin desbordamiento a 375 px; `/login` y `/guia` sin desbordamiento a 1024 px. Medido en pestaña nueva.
- Consola en `/login`, pestaña nueva: sin errores. Antes del reinicio, la pestaña anterior mostraba `ReferenceError: EyeIcon is not defined` y errores 500 de HMR. El código actual importa `IconEye` e `IconEyeOff` y no contiene `EyeIcon`; el error venía de un bundle obsoleto del servidor, no del código.
- Modo oscuro: la captura de `/login` a escritorio muestra la paleta oscura sin desbordamiento.

No ejecutado en esta ronda, porque requiere sesión autenticada con Supabase, datos ficticios en entorno aislado y autorización del dueño:

- Paso 4 (recorrido manual en claro y oscuro).
- Paso 5 (`/impeccable critique` sobre el muro).
- Puntos 3 a 6 de Review Focus en navegador con datos reales de la interfaz autenticada.

T13-R0-1 sigue abierto hasta que el dueño autorice el entorno aislado o acepte formalmente el diferimiento en `docs/07-auditoria/pendientes.md`.
