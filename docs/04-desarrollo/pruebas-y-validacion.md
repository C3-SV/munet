# Pruebas y validación

## Comandos locales

| Comando | Alcance |
|---|---|
| `npm test -w api` | Suites Node de `apps/api/src`, ejecutadas desde la raíz por el script del workspace. Incluyen utilidades y pruebas con sustitutos de Supabase y bcrypt. |
| `npm run check-types -w api` | TypeScript de la API sin emitir archivos. `npm run build -w api` hace la misma comprobación. |
| `node --test apps/web/lib/api/base-url.test.mjs` | Normalización y composición de URL base de la API en web. |
| `npm run build` y `npm run check-types` | Turbo ejecuta los scripts disponibles en workspaces, incluida la API. |
| `npm run lint` | Turbo ejecuta los scripts disponibles. La API carece de lint propio. |

El root y la web carecen de script `test`. `npm run format` escribe archivos.

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

Registrar comando o pasos, datos de prueba, resultado y limitaciones. Para cambios documentales, verificar enlaces y referencias, ejecutar `git diff --check` y revisar `git status --short`.
