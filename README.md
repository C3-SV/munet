# MUNET

MUNET es un monorepo para una plataforma de operación de eventos de Modelo de Naciones Unidas. Contiene una experiencia participante, una base de panel administrativo, una API y paquetes compartidos.

La documentación verificada comienza en [`docs/README.md`](docs/README.md). Quienes trabajen con agentes deben leer primero [`AGENTS.md`](AGENTS.md).

## Aplicaciones

| Ruta | Responsabilidad | Estado comprobado |
|---|---|---|
| `apps/web` | Interfaz Next.js para participantes y administración inicial | Funcionalidad parcial conectada a la API |
| `apps/api` | API Express, autenticación, autorización y acceso a Supabase | Implementación parcial; sin esquema SQL versionado |
| `apps/docs` | Plantilla Next.js generada | No publica la documentación oficial |

## Inicio local

Los requisitos, variables y limitaciones están en [`docs/04-desarrollo/configuracion-local.md`](docs/04-desarrollo/configuracion-local.md). En términos generales:

```bash
npm install
npm run dev
```

La API requiere configuración de Supabase. No copies valores reales a documentación ni al control de versiones.

## Estado

La auditoría del 23 de octubre de 2026 distingue lo implementado de lo histórico y lo planificado. Consulta [`docs/07-auditoria/estado-actual.md`](docs/07-auditoria/estado-actual.md) antes de asumir que una ruta o pantalla es operativa.
