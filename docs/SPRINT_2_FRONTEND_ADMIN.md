# Plan frontend admin, Sprint 2 (para Alex)

Backend del Sprint 2 hecho por Christian en `sitio-admin` (S2-03, S2-05, S2-07, S2-08 y soporte de S2-04). Este documento es el contrato **real** de esos endpoints: puedes construir contra él desde ya. Tareas tuyas: **S2-04, S2-06, S2-07 (parte FE) y S2-09**.

Reglas que no cambian:

- Todo pasa por `apps/web/lib/api/*`. Nada de Supabase directo desde el navegador.
- Toda petición lleva `Authorization: Bearer <token>`.
- La autorización es **por evento** (ADR-005). Si el admin no es admin activo de ese evento, la API responde `403`. Toma el `eventId` de la ruta `/admin/events/[eventId]/...`.
- Las contraseñas (inicial o temporal) se muestran **una sola vez**. No guardarlas en `localStorage`, `sessionStorage`, Zustand persistido ni logs.

## Antes de empezar

| Cosa | Estado | Qué significa para ti |
|---|---|---|
| Migración 001 (`alias`, `delegation_code`) | Aplicada por Fiore el 5 nov | Los campos ya existen y vienen en las respuestas |
| Migración 002 (generar el código #) | Escrita, **sin aplicar** | Hasta que se aplique, `delegation_code` puede venir `null` y la respuesta trae un aviso en `warnings`. Muestra "Sin código" en ese caso |

## Cambios en endpoints que ya usas

### `POST /admin/create-account` (alta individual)

Body igual que antes, con un campo nuevo opcional:

```json
{
  "event_id": "uuid",
  "participant_code": "userEjemplo",
  "role": "PARTICIPANT",
  "first_name": "Nombre",
  "last_name": "Apellido",
  "committee_id": "uuid | omitido",
  "delegation_name": "opcional",
  "institution_name": "opcional",
  "display_name": "opcional",
  "bio": "opcional",
  "alias": "opcional, hasta 60 caracteres"
}
```

Respuesta `200` (campos nuevos: `delegation_code` y `warnings`):

```json
{
  "message": "Cuenta creada correctamente",
  "user": { "id": "uuid" },
  "membership": { "id": "uuid", "participant_code": "userEjemplo", "delegation_code": "#042" },
  "profile": { "first_name": "Nombre", "last_name": "Apellido", "alias": null },
  "initial_password": "Xk7#mP2qR9aB",
  "delegation_code": "#042",
  "warnings": []
}
```

| Código | Cuándo |
|---|---|
| 400 | Faltan campos, alias muy largo, comité de otro evento o archivado |
| 403 | No eres admin de ese evento |
| 404 | Comité no existe |
| **409** | `participant_code` ya existe en el evento (**antes era 400**, ajusta el mensaje) |

### `GET /admin/participants`

Query nuevo: **`q`** busca por código de login, código # (`#042` o `042`), nombre, apellido, nombre completo o alias, sin importar mayúsculas ni tildes ("perez" encuentra "Pérez"). Se combina con los filtros que ya había y la paginación funciona igual.

```
GET /admin/participants?event_id=...&q=perez&committee_id=...&status=ACTIVE&role=PARTICIPANT&page=1&limit=20
```

Cada participante ahora trae `delegation_code` y `profile.alias`:

```json
{
  "participants": [
    {
      "id": "membership-uuid",
      "participant_code": "userEjemplo",
      "delegation_code": "#042",
      "role": "PARTICIPANT",
      "committee_id": "uuid",
      "account_status": "PENDING_ACTIVATION",
      "profile": { "first_name": "Nombre", "last_name": "Apellido", "display_name": null, "alias": "Juanito" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 134, "total_pages": 7 }
}
```

Consejo: haz debounce de 300 ms en el input de búsqueda y vuelve a `page=1` cuando cambie `q` o un filtro.

### `GET /admin/participants/:membershipId`

Igual que antes, más `delegation_code` y `profile.alias`.

### `PATCH /admin/participants/:membershipId`

Ahora acepta `alias` (texto hasta 60, o `null` para borrarlo). El admin puede corregir un alias inapropiado (decisión 3 del Sprint 1). `delegation_code` y `participant_code` **no** se pueden editar.

`committee_id` todavía se acepta aquí para no romper tu pantalla de detalle, pero para cambiar de comité usa el endpoint nuevo de abajo: deja registro de auditoría específico.
## Endpoints nuevos

### `PATCH /admin/participants/:membershipId/committee` (S2-08)

```json
{ "committee_id": "uuid o null", "reason": "opcional" }
```

`null` deja al participante sin comité. Respuesta `200`:

```json
{
  "message": "Comite actualizado correctamente",
  "membership": { "id": "uuid", "event_id": "uuid", "committee_id": "uuid" },
  "committee": { "id": "uuid", "name": "Asamblea General" }
}
```

| Código | Cuándo |
|---|---|
| 400 | Falta `committee_id`, ya está en ese comité, comité de otro evento o archivado |
| 404 | Participante o comité no existe |

El delegado ve el muro nuevo en su siguiente petición, no hace falta cerrar sesión.

### `POST /admin/participants/import/preview` (S2-05, paso 1)

No escribe nada. Manda el **texto** del archivo, no un FormData:

```json
{ "event_id": "uuid", "csv": "nombre,apellido,codigo_participante,comite,delegacion,rol,alias\nAna,Pérez,ana.perez,AG,México,,Anita" }
```

Respuesta `200`:

```json
{
  "total_rows": 3,
  "valid": [
    {
      "row": 2, "first_name": "Ana", "last_name": "Pérez", "participant_code": "ana.perez",
      "committee_id": "uuid", "committee_label": "Asamblea General",
      "delegation_name": "México", "institution_name": null, "role": "PARTICIPANT", "alias": "Anita"
    }
  ],
  "invalid": [
    { "row": 3, "values": { "first_name": "", "participant_code": "x" }, "errors": ["nombre es obligatorio", "codigo_participante debe tener de 3 a 50 caracteres..."] }
  ],
  "duplicates": [
    { "row": 4, "values": { "participant_code": "ana.perez" }, "participant_code": "ana.perez", "reason": "IN_FILE" }
  ],
  "template_headers": ["nombre", "apellido", "codigo_participante", "comite", "delegacion", "rol", "alias"],
  "limits": { "max_rows": 1000, "confirm_batch_max": 50 }
}
```

- `row` es el número de fila **como en Excel** (encabezado = 1). Muéstralo así para que el organizador lo encuentre.
- `reason`: `IN_FILE` = repetido dentro del archivo, `IN_EVENT` = ese código ya existe en el evento.
- Errores: `400` (CSV vacío, faltan encabezados, más de 1000 filas; trae `template_headers`), `413` (archivo enorme), `404` (evento).

Reglas del CSV que aplica el servidor (úsalas para los textos de ayuda):

| Columna | Obligatoria | Regla |
|---|---|---|
| `nombre`, `apellido` | Sí | Hasta 100 caracteres |
| `codigo_participante` | Sí | 3 a 50 caracteres: letras, números, `.` `_` `-`. No se puede repetir |
| `comite` | No | Código o nombre del comité (sin importar mayúsculas ni tildes). Vacío = sin comité |
| `delegacion` | No | Hasta 120 |
| `rol` | No | Vacío = participante. Acepta `participante`/`delegado` o `moderador`. Los admins **no** se importan |
| `alias` | No | Hasta 60 |

Acepta `,` o `;` como separador (Excel en español usa `;`) y archivos con BOM. El código # **no** va en el CSV: lo genera el servidor.

### `POST /admin/participants/import/confirm` (S2-05 paso 2 y S2-07)

Manda las filas `valid` del preview **en lotes de máximo 50**, uno tras otro (no en paralelo):

```json
{ "event_id": "uuid", "rows": [ /* hasta 50 objetos tal cual vinieron en preview.valid */ ] }
```

Respuesta `200` por lote:

```json
{
  "message": "Importacion procesada",
  "summary": { "requested": 50, "created": 49, "failed": 1 },
  "created": [
    {
      "row": 2, "membership_id": "uuid", "participant_code": "ana.perez", "delegation_code": "#043",
      "first_name": "Ana", "last_name": "Pérez", "role": "PARTICIPANT",
      "committee_label": "Asamblea General", "alias": "Anita",
      "initial_password": "Xk7#mP2qR9aB", "warnings": []
    }
  ],
  "failed": [ { "row": 9, "participant_code": "luis.g", "errors": ["participant_code ya existe en este evento"] } ]
}
```

- El servidor vuelve a validar cada fila. Si entre el preview y el confirm alguien creó ese código, esa fila sale en `failed` y las demás siguen.
- `400` si mandas más de 50 filas o un array vacío.
- **Las contraseñas solo vienen aquí.** Si el admin cierra la pestaña antes de descargar, se pierden y hay que usar "reiniciar contraseña" por persona.
### Endpoints del Sprint 1 que usa S2-09 (sin cambios)

| Acción | Endpoint | Body | Respuesta |
|---|---|---|---|
| Reiniciar contraseña | `POST /admin/participants/:id/reset-password` | nada | `temporary_password` (una sola vez) |
| Suspender | `POST /admin/participants/:id/suspend` | `{ "reason": "obligatorio" }` | `membership` |
| Reactivar | `POST /admin/participants/:id/reactivate` | `{ "reason": "obligatorio" }` | `membership` |
| Comités del evento (para el selector) | `GET /admin/committees?event_id=...` | | lista de comités |

## Qué construir

### S2-04 · Tabla de participantes (`/admin/events/[eventId]/participants`)

Ya tienes la página. Agrega:

1. Columnas: Nombre completo, Alias, Código #, Código de login, Comité, Rol, Estado.
2. Buscador (`q`) con debounce y filtros de comité, estado y rol.
3. Paginación con `page` / `total_pages`.
4. Botones arriba: "Nuevo participante" (ya existe) e "Importar CSV" (lleva a S2-06).
5. En el alta individual, al crear: modal con código de login, código # y contraseña inicial, botón copiar y aviso "No se vuelve a mostrar".

### S2-06 + S2-07 · Importación (`/admin/events/[eventId]/participants/import`)

Flujo en 4 pasos:

1. **Plantilla:** botón que descarga un CSV armado en el navegador con `template_headers` y una fila de ejemplo. No hace falta endpoint.
2. **Subir:** `<input type="file" accept=".csv,text/csv">`, leer con `file.text()` y mandar a `preview`. Si el texto sale con caracteres raros (Excel guardó en Windows-1252), mostrar: "Guarda el archivo como **CSV UTF-8** en Excel".
3. **Revisar:** tres pestañas con contador: Válidas, Con errores (fila + lista de errores), Duplicadas (fila + motivo). Botón "Importar N válidas" deshabilitado si N = 0. Las inválidas no se pueden importar: el organizador corrige el archivo y vuelve a subirlo.
4. **Confirmar:** partir `valid` en lotes de 50 y llamar `confirm` uno por uno, con barra de progreso ("Lote 3 de 8"). Juntar todos los `created` y `failed`.

Al terminar, pantalla de resultado:

- Resumen: creadas, fallidas.
- Tabla de fallidas con fila y error.
- **Botón grande "Descargar credenciales (CSV)"** con: nombre, apellido, alias, comité, código de login, código #, contraseña inicial. Aviso fijo: "Descárgalo ahora. Las contraseñas no se pueden volver a obtener."
- Si el usuario intenta salir sin descargar, `beforeunload` con confirmación.

Al armar el CSV de credenciales en el navegador:

- Empieza el archivo con `\uFEFF` (BOM) para que Excel muestre bien las tildes.
- Escapa comillas (`"` → `""`) y envuelve cada celda en comillas.
- Si una celda empieza con `=`, `+`, `-` o `@`, antepón `'` para evitar inyección de fórmulas en Excel.
- Genera el archivo con `Blob` + `URL.createObjectURL` y libera la URL después.

### S2-09 · Acciones por fila

Menú de acciones en cada fila de la tabla:

| Acción | UI | Endpoint |
|---|---|---|
| Cambiar comité | Modal con selector de comités del evento + motivo opcional | `PATCH .../committee` |
| Reiniciar contraseña | Confirmación → modal con la contraseña temporal y botón copiar | `POST .../reset-password` |
| Suspender | Modal con motivo **obligatorio** (solo si no está `SUSPENDED`) | `POST .../suspend` |
| Reactivar | Modal con motivo **obligatorio** (solo si está `SUSPENDED`) | `POST .../reactivate` |

Después de cada acción, refrescar la fila (o la página actual) y mostrar un toast. Si la API responde `403`, mostrar "No tienes permisos para administrar este evento".

## Funciones sugeridas en `lib/api/participants.ts`

```ts
listParticipants(eventId, { q, committeeId, status, role, page, limit })
createAccount(body)                       // ya existe: leer delegation_code y warnings, manejar 409
updateParticipant(membershipId, body)     // ya existe: ahora acepta alias
changeParticipantCommittee(membershipId, committeeId | null, reason?)
previewParticipantImport(eventId, csvText)
confirmParticipantImport(eventId, rows)   // máximo 50 por llamada
resetParticipantPassword(membershipId)
suspendParticipant(membershipId, reason)
reactivateParticipant(membershipId, reason)
```

## Cómo probar

1. Con tu cuenta `ADMIN_MUN` del evento "MUN ESEN 2026".
2. CSV de prueba con 50 filas mezclando: válidas, sin nombre, código repetido en el archivo, código que ya existe, comité inexistente, rol `admin_mun`. Es el criterio de "listo" de S2-06.
3. Cambiar de comité a tu usuario de prueba y comprobar que en el sitio de participantes ve el muro nuevo.
4. No borres cuentas de prueba creadas: suspéndelas o pide que se archiven.

Dudas del contrato: Christian.