# Evento de entrenamiento «Conoce MUNET»

Evento ficticio, en la misma base que producción, para que la gente aprenda a usar MUNET sin tocar un evento oficial. Se siembra con un script repetible y se puede reiniciar. Estado: sembrado el 21 de noviembre de 2026.

## Los tres tipos de evento

| Evento | Para qué | Quién lo gestiona |
|---|---|---|
| `DEMO - MUN ESEN 2026` | Desarrollo y pruebas del equipo técnico. | Equipo técnico |
| `Conoce MUNET` (`conoce-munet`) | Entrenamiento: conocer la plataforma con datos ficticios. | Equipo técnico, con el script |
| Eventos oficiales | Operación real. | Cada organización |

## Qué contiene

- **12 cuentas** con código `CON-…` (entrega 3 del diseño de la práctica): 1 administración (`CON-ADM`), 2 moderación (`CON-MOD1`, `CON-MOD2`) y 9 participantes (`CON-001` a `CON-006`, `CON-023`, `CON-024` y `CON-033`) en 4 comités: Asamblea General, Consejo de Seguridad, UNICEF y ECOSOC.
- Las 28 cuentas sobrantes (`CON-007` a `CON-022`, `CON-025` a `CON-032` y `CON-034` a `CON-037`) se retiran con el script de la sección siguiente. **Estado: entrega 3 implementada, pendiente de aplicar.** Hasta que la persona dueña autorice `--apply`, la base sigue con las 40 cuentas.
- Estados para practicar el ciclo de cuentas:
  - **Activas** (staff y `CON-001` a `CON-006`): entran con una contraseña conocida.
  - **Pendientes** (`CON-023` y `CON-024`): nacen sin activar, con contraseña inicial individual, para practicar la activación.
  - **Suspendida** (`CON-033`): para practicar la reactivación.
- Contenido: 2 avisos fijados, publicaciones en General y en cada comité, una encuesta con 9 votos, 13 comentarios (con respuestas), 2 conversaciones de mensajes directos y dos adjuntos de ejemplo (un PDF y una imagen PNG).
- La cuenta real de administración (`adminMUN` por defecto) se vincula al evento como `ADMIN_MUN`, para verlo en el selector y administrarlo desde el panel.

Las contraseñas **no se pueden deducir del repositorio**: se derivan con HMAC de un secreto local (variable `TRAINING_SEED_SECRET` o el archivo `.local/training-seed-secret`, que git ignora y el script crea la primera vez). Con el mismo secreto salen las mismas contraseñas, así que el reinicio las recalcula sin guardarlas; con otro secreto, `--reset` fija contraseñas nuevas para todas. Solo dan acceso a este evento y están en un Excel local, fuera del repositorio.

## Reglas que respeta

- **Prefijo `CON-` en los códigos.** Un código no puede repetirse entre eventos para personas distintas (ver RN-03). Los códigos del entrenamiento no chocan con los oficiales.
- **Aislamiento.** Solo la cuenta real de administración tiene membresía en otro evento. Las 40 cuentas del entrenamiento no ven los eventos oficiales.
- **El script nunca toca otro evento.** Si encuentra el slug `conoce-munet` con otro nombre, se detiene sin escribir.

## Cómo usar el script

Desde `apps/api`. Sin opciones solo simula y lee; no escribe nada.

```powershell
npx ts-node --files src/scripts/seed-training-event.ts
```

```powershell
npx ts-node --files src/scripts/seed-training-event.ts --apply
```

```powershell
npx ts-node --files src/scripts/seed-training-event.ts --apply --reset
```

- `--apply`: siembra lo que falte. Es idempotente: lo que ya existe se conserva.
- `--reset`: con `--apply`, borra el contenido del evento (publicaciones, comentarios, encuestas, mensajes, adjuntos y sus archivos en R2), devuelve cada cuenta a su estado inicial (pendientes sin acceso, activas con su contraseña conocida, suspendidas) y vuelve a sembrar el contenido. Las cuentas que el instructor haya creado de más no se borran.
- `--owner <código>`: cuenta real de administración que se vincula (por defecto `adminMUN`).
- `--out <ruta>`: dónde escribir el listado de credenciales (por defecto `.local/usuarios-entrenamiento.json`, ignorado por git).
- Después de un `--reset` con otro secreto hay que volver a generar el Excel: las contraseñas anteriores dejan de servir.

Requiere las variables de `apps/api/.env`. Sin las variables `STORAGE_*` se omiten los adjuntos de ejemplo y el script avisa.

**Advertencia:** la lista de cuentas de `seed-training-event.ts` sigue siendo de 40. Después de retirar las 28, un `--apply` del seed volvería a crear las sobrantes con sus códigos. Antes de volver a sembrar hay que alinear esa lista con las 12 de `retire-training-extra-accounts.ts`. Además, el contenido de ejemplo (publicaciones, comentarios, votos y mensajes) aún cita a `CON-007` a `CON-009` y a otras cuentas que se retiran; la reasignación a las 6 participantes activas queda pendiente.

## Reducir de 40 a 12 cuentas

Script: `apps/api/src/scripts/retire-training-extra-accounts.ts`. Lógica pura y pruebas: `apps/api/src/seed/training-event.retire.ts` y `training-event.retire.test.cjs`.

Desde `apps/api`:

```powershell
npx ts-node --files src/scripts/retire-training-extra-accounts.ts
```

Sin opciones solo simula: lista el código CON, el id de la membresía, el id del usuario de Auth y el nombre de cada una de las 28 cuentas, y no escribe nada.

```powershell
npx ts-node --files src/scripts/retire-training-extra-accounts.ts --apply
```

`--apply` hace, para cada una de las 28: borra el usuario de acceso en Auth, deja su usuario sin `supabase_auth_user_id` y su correo en `null`, y pone `deleted_at` en la membresía (borrado lógico). Solo toca membresías de `conoce-munet` con código de la lista de 28. Antes de escribir comprueba que el evento existe con su nombre, que están las 12 que se quedan, que la selección cuadra (12 + 28 + inesperadas = total) y que ninguna cuenta a retirar comparte persona con otra cuenta ni tiene membresía en otro evento. Si algo falla, no escribe nada. Si falla el borrado en Auth de una cuenta, se detiene y reintentar es seguro.

**Aplicar `--apply` requiere la autorización expresa de la persona dueña en ese momento.** No se aplica desde un entorno de prueba ni sin revisar antes la simulación.

```powershell
npx ts-node --files src/scripts/retire-training-extra-accounts.ts --credentials
```

`--credentials` escribe `.local/usuarios-entrenamiento.json` solo con las 12 cuentas, en el mismo formato que el seed (`--out <ruta>` cambia el destino). No toca la base. Necesita el secreto del seed (variable `TRAINING_SEED_SECRET` o `.local/training-seed-secret`) y nunca crea uno nuevo: con otro secreto cambiarían las contraseñas.

## Verificación del 21 de noviembre de 2026

Con la API local y la base real:

- Sembrado: evento, 6 muros, 4 comités, 40 cuentas, 12 publicaciones, 13 comentarios, encuesta, 2 conversaciones y 2 adjuntos. 31 usuarios con acceso (30 del entrenamiento y la cuenta propia); las 10 pendientes sin acceso.
- Ciclo de cuentas por la API: las activas entran; la suspendida no (400); contraseña mala (401); activar una pendiente con contraseña inicial mala (401), correcta (200) y de nuevo (400); la contraseña inicial deja de servir tras activar; suspender sin motivo (400), suspender (200), no entra, suspender dos veces (400), reactivar (200) y entra; suspender una pendiente (400, con el mensaje de restablecer contraseña); restablecer la contraseña de una pendiente (200, `Cache-Control: no-store`) y de una suspendida (400); un participante no puede suspender (403).
- Reinicio: contenido y archivos de R2 restaurados (12 publicaciones, 2 archivos), la cuenta activada vuelve a pendiente y la reactivada a suspendida.

## Pendiente

- Probar el entrenamiento con personas reales y ajustar el contenido.
- Si se quiere un evento por sesión, parametrizar el script con otro nombre y prefijo.
- Cerrar el evento al terminar el entrenamiento depende del ciclo del evento, que sigue pendiente en [PENDIENTES.md](../PENDIENTES.md).
