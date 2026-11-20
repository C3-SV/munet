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
- `npm run lint -w web` y `npm run lint` terminan con código 1 por las 4 advertencias restantes, porque el script usa `--max-warnings 0`. Queda pendiente.
- `impeccable detect --json app components` encontró un hallazgo `side-tab` en `components/ui/Card.tsx:29`. No está entre los antipatrones que exige la especificación.
- Búsquedas por texto en `app`, `components` y `lib`: cero coincidencias de `font-black`, `font-extrabold`, `text-[10px]` y `text-[11px]`. Dos coincidencias de `#b91c1c` en `app/(main)/profile/[membershipId]/page.tsx` (líneas 499 y 660) incumplen la regla de cero hexadecimales de estado en `.tsx`. Quedan pendientes.

No se verificó en esta entrega, porque requiere sesión con Supabase o un navegador con datos ficticios:

- El recorrido 6 y el resto de flujos autenticados: login, selección de evento, feed, publicación, comentarios, votación, chat entre dos sesiones, perfil y administración.
- El detector sobre `/login`, `/guia` y `/select-event` en 390×844 y 1440×900, y la revisión visual en claro y oscuro.
- La crítica con `/impeccable critique` sobre el muro, por lo que el puntaje de 20/40 no se ha vuelto a medir.

Registrar comando o pasos, datos de prueba, resultado y limitaciones. Para cambios documentales, verificar enlaces y referencias, ejecutar `git diff --check` y revisar `git status --short`.
