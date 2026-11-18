# Estado actual auditado

- **Fecha:** 2026-11-18
- **Commit de main:** `a76cb837d428c9c450824b83a88208dfbffab338`
- **Evidencia:** revisión estática de web, API y SQL, con pruebas locales descritas en [pruebas y validación](../04-desarrollo/pruebas-y-validacion.md).
- **Entornos verificados:** repositorio local. Los recorridos con Supabase, Storage y Realtime requieren un entorno aislado.

## Alcance funcional

El sitio participante conecta activación, sesión, selector de evento, perfiles con alias, muros, encuestas, comentarios y chat 1:1 con la API. El panel permite consultar y configurar eventos, crear y editar comités y gestionar cuentas individuales. La API limita la administración a la membresía del evento objetivo, con listado filtrado y creación en rutas sin evento objetivo.

La [lista de funcionalidades](../01-producto/funcionalidades.md) recoge el estado por módulo y el [manual funcional](../01-producto/manual-funcional.md) describe el uso por rol.

## Brechas que afectan la operación

1. El alta de evento usa `ADMIN`, ausente del enum del snapshot, y el controlador no crea muros general o de anuncios. Debe verificarse que un evento recién creado sea utilizable.
2. CSV tiene previsualización y confirmación en API, pendientes de conectar a la web. El cambio individual de comité ya está en la ficha. Asignaciones generales y moderación siguen como marcadores.
3. La generación de `#` depende de la migración 002. El código de login admite colisión entre eventos al dar de alta, pero el login rechaza códigos activos asociados a usuarios distintos.
4. `CLOSED` se puede guardar. El alta de comité lo respeta, pero no existe una guarda general que impida escribir en el evento cerrado.

Consulta [discrepancias](discrepancias.md) para el contraste con reglas y esquema, y [pendientes](pendientes.md) para el orden propuesto de trabajo.

## Inventario del repositorio

| Ruta | Responsabilidad |
|---|---|
| `apps/web` | Next.js. Sitio participante y panel administrativo. |
| `apps/api` | Express y TypeScript. Autorización y operaciones con Supabase. |
| `supabase` | Snapshot parcial y dos migraciones incrementales. |
| `apps/docs` | Plantilla Next.js independiente de estos documentos. |
| `packages` | Configuración compartida y componentes de ejemplo. |
| `docs` | Documentación mantenida y referencias históricas. |
