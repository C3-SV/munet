# Guía para desarrolladores

## Orientación inicial

1. Lee [visión y alcance](../01-producto/vision-y-alcance.md).
2. Revisa [estado actual](../07-auditoria/estado-actual.md) para no confundir planes con código.
3. Consulta [arquitectura general](../02-arquitectura/arquitectura-general.md).
4. Configura el entorno con [configuración local](configuracion-local.md).

## Convenciones observadas

- TypeScript en web y API.
- App Router y componentes cliente en Next.js.
- Clientes HTTP por dominio en `apps/web/lib/api`.
- Rutas/controladores/servicios en la API; parte de la lógica aún reside en controladores.
- Nombres de tablas y estados en inglés; interfaz y comentarios mayormente en español.

No existe una guía formal de estilo más allá de ESLint, Prettier y Biome del root. Conserva el patrón del módulo que modifiques.

## Antes de preparar un cambio

- Ubica el requisito en [requerimientos](../01-producto/requerimientos.md).
- Comprueba la regla correspondiente en [reglas de negocio](../01-producto/reglas-de-negocio.md).
- Revisa [discrepancias](../07-auditoria/discrepancias.md) y [pendientes](../07-auditoria/pendientes.md).
- Sigue frontend, contrato, backend y tabla; no modifiques solo una capa por intuición.
- Si afecta datos, exige primero esquema/migración/RLS versionados o evidencia externa autorizada.

## Documentar un cambio

Actualiza una única fuente principal:

- regla: `01-producto/reglas-de-negocio.md`;
- contrato: `03-referencia/api.md`;
- modelo: `03-referencia/modelos-de-datos.md`;
- decisión: nuevo ADR o reemplazo del existente;
- estado: `07-auditoria/matriz-de-trazabilidad.md`.

Los demás documentos deben enlazar, no copiar bloques completos.

## Áreas de cuidado

- Autorización debe aplicarse al recurso y evento objetivo.
- El cliente Supabase del navegador solo se justifica para Realtime.
- La API opera con privilegios elevados.
- Las operaciones compuestas requieren estrategia transaccional.
- No registrar credenciales ni tokens.
- `apps/docs` no es actualmente el sitio de esta documentación.
