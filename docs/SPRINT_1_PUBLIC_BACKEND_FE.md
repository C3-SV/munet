# Contrato backend para Sprint 1 del frontend (Sitio público / Participantes)

Todos estos endpoints requieren sesión activa mediante `requireAuth` y pertenencia válida al evento indicado (vía parámetro de ruta `:eventId` o encabezado `x-event-id`). Están destinados a la experiencia del participante y la consulta pública dentro del evento.

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
  * `search` *(opcional, string)*: Búsqueda flexible por nombre, apellido, alias (`display_name`) o nombre de delegación.
  * `committee_id` *(opcional, UUID)*: Filtro para restringir los resultados a los delegados asignados a un comité específico.
  * `page` *(opcional, entero)*: Número de página (por defecto `1`).
  * `limit` *(opcional, entero)*: Elementos por página (por defecto `20`, máximo `100`).

* **Estructura de cada delegado en `delegates`:**
  ```json
  {
    "membershipId": "uuid",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "alias": "Nombre visible o alias preferido",
    "delegationName": "Francia",
    "delegationCode": "#042",
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
  * Se excluyen automáticamente participantes suspendidos, inactivos o eliminados lógicamente (`deleted_at IS NOT NULL`).
  * Si `search` o `committee_id` no arrojan resultados, responde `200` con `delegates: []` y `total: 0`.

---

## 2. Alias en el perfil

* **Lectura (`GET /profiles/me` y `GET /profiles/:membershipId`):**
  * `GET /profiles/me`: Devuelve el perfil propio completo de la membresía activa en el evento (`x-event-id`).
  * `GET /profiles/:membershipId`: Devuelve la vista pública del perfil del delegado dentro del mismo evento. Incluye nombre, `alias` (`displayName`), comité, país/delegación y biografía; **omite** datos privados (`participant_code`, correo).

* **Edición de alias propio (`PATCH /profiles/me`):**
  * **Encabezado:** `x-event-id: <uuid>`
  * **Cuerpo recibido (JSON):**
    ```json
    {
      "display_name": "Mi Alias o Nombre de Delegado",
      "bio": "Texto de biografía (opcional)"
    }
    ```
  * **Validaciones:**
    * `display_name` (alias): Texto de 1 a 60 caracteres. No puede consistir solo de espacios en blanco.
    * Si se envía `null` o vacío, se utiliza como fallback el nombre completo (`first_name + last_name`).
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

* **Propósito:** Identificador numérico o alfanumérico visible asignado a la delegación dentro del evento (por ejemplo `#014`, `#A-12`).
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
