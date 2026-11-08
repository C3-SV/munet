# Contrato backend para Sprint 1 del frontend (Sitio público / Participantes)

Todos estos endpoints requieren sesión activa mediante `requireAuth` y pertenencia válida al evento indicado (vía parámetro de ruta `:eventId` o encabezado `x-event-id`). Están destinados a la experiencia del participante y la consulta pública dentro del evento.

> **Estado:** este documento es un **contrato** (qué recibe y qué devuelve cada endpoint). `GET` y `PATCH /profiles/me` y `GET /profiles/:membershipId` ya existen en `main`; el directorio no. `alias` y `delegationCode` usan las columnas nuevas de la migración SQL 001 (tarea S1-02), **ya aplicada en Supabase el 2026-11-05**. Mientras no haya dato, ambos devuelven `null`.
>
> **Regla de presentación (decisión de MUN):** el delegado se ve con su **nombre completo y también su alias**, nunca uno en lugar del otro. Ejemplo: «Ana Pérez · alias “Anita”», o solo «Ana Pérez» si no tiene alias.

| Método y ruta | Respuesta |
| --- | --- |
| `GET /events/:eventId/directory?search=&committee_id=&page=1&limit=20` | `{ delegates, pagination: { page, limit, total, total_pages } }` |
| `GET /profiles/me` | `{ profile }` |
| `PATCH /profiles/me` | `{ message, profile }` |
| `GET /profiles/:membershipId` | `{ profile }` |

---

## 1. Directorio de delegados

* **Ruta:** `GET /events/:eventId/directory` (alternativamente `GET /directory` enviando encabezado `x-event-id`).
* **Acceso:** Cualquier miembro activo con sesión en el evento correspondiente.
* **Parámetros de consulta (Query Params):**
  * `search` *(opcional, string)*: Búsqueda flexible, sin distinguir mayúsculas ni acentos, por nombre, apellido, alias (`profiles.alias`) o nombre de delegación. La búsqueda se hace en el servidor (no en memoria) y es paginada.
  * `committee_id` *(opcional, UUID)*: Filtro para restringir los resultados a los delegados asignados a un comité específico.
  * `page` *(opcional, entero)*: Número de página (por defecto `1`).
  * `limit` *(opcional, entero)*: Elementos por página (por defecto `20`, máximo `100`).

* **Estructura de cada delegado en `delegates`** (`alias` y `delegationCode` son `string | null`; el ejemplo muestra `null`, que es el valor cuando aún no hay dato):
  ```json
  {
    "membershipId": "uuid",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "alias": null,
    "delegationName": "Francia",
    "delegationCode": null,
    "role": "PARTICIPANT",
    "institutionName": "Institución o Colegio",
    "committee": {
      "id": "uuid",
      "name": "Consejo de Seguridad",
      "code": "CS"
    },
    "avatarUrl": "https://..."
  }
  ```

* **Reglas y seguridad:**
  * **REGLA ESTRICTA DE SEGURIDAD:** El endpoint **NUNCA devuelve** `participant_code` (código de login/activación), correo electrónico ni datos de autenticación de ningún participante.
  * `firstName` y `lastName` se devuelven **siempre**. `alias` nunca los reemplaza.
  * Se excluyen automáticamente participantes suspendidos, inactivos o eliminados lógicamente (`deleted_at IS NOT NULL`).
  * Muestra delegados de **todos** los comités del evento (MUN pidió poder buscar delegados de otros comités). Esto no da acceso a los muros de esos comités.
  * Si `search` o `committee_id` no arrojan resultados, responde `200` con `delegates: []` y `total: 0`.

---

## 2. Alias en el perfil

* **Lectura (`GET /profiles/me` y `GET /profiles/:membershipId`):**
  * `GET /profiles/me`: Devuelve el perfil propio completo de la membresía activa en el evento (`x-event-id`).
  * `GET /profiles/:membershipId`: Devuelve la vista pública del perfil del delegado dentro del mismo evento. Incluye `firstName`, `lastName`, `alias`, comité, país/delegación y biografía; **omite** datos privados (`participant_code`, correo).
  * `alias` es un campo **nuevo y separado** de `display_name`. Si la persona no tiene alias, `alias` es `null` (no se rellena con el nombre completo) para que el frontend sepa si hay alias o no.
  * `displayName` se mantiene en la respuesta solo por compatibilidad mientras el frontend deja de usarlo; es una tarea del frontend, no se elimina en este sprint.

* **Edición de alias propio (`PATCH /profiles/me`):**
  * **Encabezado:** `x-event-id: <uuid>`
  * **Cuerpo recibido (JSON):**
    ```json
    {
      "alias": "Mi alias",
      "bio": "Texto de biografía (opcional)"
    }
    ```
  * **Validaciones:**
    * `alias`: texto de 1 a 60 caracteres, sin espacios al inicio ni al final, y no puede ser solo espacios.
    * Si se envía `null` o cadena vacía, el alias se borra (queda `null`). **No** se usa el nombre completo como valor de reemplazo.
    * `display_name` deja de ser el campo que edita el delegado. Si llega, se ignora.
    * Unicidad del alias dentro del evento: **por decidir** (S1-03). Mientras tanto se permite repetirlo.
    * Rechaza intentos de modificar campos protegidos (`role`, `participant_code`, `delegation_code`, `committee_id`).
  * **Respuesta (`200 OK`):**
    ```json
    {
      "message": "Perfil actualizado correctamente",
      "profile": { ... }
    }
    ```

---

## 3. Código `#` de delegación

* **Propósito:** Identificador único de la delegación dentro del evento. **Formato por decidir** (S1-03); propuesta: `#` seguido de un número con ceros, por ejemplo `#042`, asignado por orden de registro. Se genera al crear la cuenta, no lo elige el delegado.
* **Visualización:**
  * Incluido en la respuesta de cada delegado en el **Directorio** (`delegationCode`).
  * Incluido en el detalle del **Perfil propio** (`GET /profiles/me`) y **Perfil público** (`GET /profiles/:membershipId`).
* **Regla de mutación:**
  * Es un campo informativo asignado por la organización; no es editable por el participante mediante `PATCH /profiles/me`. Intentos de alterarlo desde el frontend público se ignoran o rechazan con `400`.

---

## Códigos de estado HTTP y errores comunes

* `200 OK`: Consulta o actualización realizada exitosamente.
* `400 Bad Request`: Falta de encabezado `x-event-id`, parámetros de paginación inválidos o datos de perfil con formato incorrecto `{ error: "..." }`.
* `401 Unauthorized`: Token JWT ausente, inválido o expirado.
* `403 Forbidden`: El usuario autenticado no tiene una membresía activa en el evento consultado.
* `404 Not Found`: Perfil o comité inexistente en el evento.
* `500 Internal Server Error`: Error inesperado en base de datos.
